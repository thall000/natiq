"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// --- Tunable VAD constants (adjust after real-world testing) ---
const CALIBRATION_MS = 500; // how long to sample ambient noise before arming speech detection
const BASELINE_NOISE_MULTIPLIER = 3; // effective speech threshold = measured baseline * this
const MIN_SPEECH_THRESHOLD = 0.015; // floor under the adaptive threshold, for near-silent rooms
const MIN_SPEECH_MS = 250; // must stay above threshold this long to count as real speech start (debounces clicks/coughs)
const MIN_TOTAL_SPEECH_MS = 400; // cumulative time above threshold required to treat a segment as real speech, not noise
const SEGMENT_SILENCE_MS = 600; // pause long enough to close the current segment, but not end the turn (e.g. between sentences)
const TURN_SILENCE_MS = 1200; // sustained silence, tracked at the turn level, that ends the whole turn
const TURN_SAFETY_TIMEOUT_MS = 5000; // absolute fallback: force-end the turn after this much silence, independent of TURN_SILENCE_MS
const MAX_RECORDING_MS = 60000; // failsafe cap on a single turn's length, measured from detected speech start
const RETRY_DELAY_MS = 1500; // delay before automatically re-listening after a failed transcription

const STATUS = {
  INIT: "init",
  CALIBRATING: "calibrating",
  LISTENING: "listening",
  RECORDING: "recording",
  TRANSCRIBING: "transcribing",
  MIC_ERROR: "mic_error",
  TRANSCRIBE_ERROR: "transcribe_error",
};

// useSyncExternalStore (rather than a manual mounted-flag + effect) is the React-
// sanctioned way to read a value that can differ between the server render and the
// client: it returns the server snapshot (false — the server has no URL to read)
// for the first client render too, then syncs to the real client value right after,
// without React ever seeing a mismatched render. No subscription is needed since
// this app never changes ?vaddebug= via client-side URL updates after load.
const noopSubscribe = () => () => {};
function getVadDebugClientSnapshot() {
  return (
    process.env.NODE_ENV !== "production" &&
    new URLSearchParams(window.location.search).get("vaddebug") === "1"
  );
}
function getVadDebugServerSnapshot() {
  return false;
}

function readRms(analyser, dataArray) {
  analyser.getByteTimeDomainData(dataArray);
  let sumSquares = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / dataArray.length);
}

// `stream` and `audioContext` are owned by the parent (LiveConversation) for the
// WHOLE conversation — created once, reused across every turn, closed only when the
// conversation ends. This component only sets up/tears down the per-turn source node,
// analyser, and MediaRecorder(s); it never acquires or releases the mic itself. That
// removes the async getUserMedia()/AudioContext acquisition on every mount entirely,
// which is what made the old per-turn approach racy under React Strict Mode's
// dev-only double-invoke (mount -> cleanup -> mount again): startTurn() no longer has
// any await before touching shared state, so there's no gap left for a second
// invocation to race against.
export default function HandsFreeRecorder({ stream, audioContext, onTranscriptReady }) {
  const [status, setStatus] = useState(STATUS.INIT);

  // Per-turn: the audio graph nodes tied to the shared stream/context, torn down
  // (disconnected) at the end of every turn but never the stream/context themselves.
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafRef = useRef(null);

  // Live mic-level bars: updated directly via refs (not React state) so the meter
  // can repaint every animation frame without triggering a re-render per frame.
  const barRefs = useRef([]);

  function updateBars(rms) {
    const bars = barRefs.current;
    if (!bars.length) return;
    const amplified = Math.min(1, rms * 14);
    const now = performance.now();
    bars.forEach((bar, i) => {
      if (!bar) return;
      const variance = 0.65 + 0.35 * Math.sin(i * 1.7 + now / 180);
      const height = Math.max(0.12, Math.min(1, 0.12 + amplified * variance));
      bar.style.transform = `scaleY(${height})`;
    });
  }
  const retryTimeoutRef = useRef(null);
  const lastMonitorTimeRef = useRef(null);
  const stoppedRef = useRef(false);
  const activeRef = useRef(true);

  // Ambient-noise calibration, run once per turn before speech detection is armed.
  const calibrationStartTimeRef = useRef(null);
  const calibrationSumRef = useRef(0);
  const calibrationCountRef = useRef(0);
  const effectiveThresholdRef = useRef(MIN_SPEECH_THRESHOLD);

  // Dev-only debug overlay (?vaddebug=1): purely a passive readout of the values
  // already computed below (rms, threshold, current state) — it never feeds back
  // into VAD behavior. DOM refs updated directly per frame, same reasoning as
  // barRefs/updateBars, so it can repaint every animation frame without a re-render.
  // vadDebugEnabled comes from useSyncExternalStore (see getVadDebug*Snapshot above)
  // so the first client render matches the server (both false) and only flips to the
  // real value right after — no hydration mismatch.
  //
  // vadDebugEnabledRef mirrors that same boolean into a ref for updateDebugOverlay(),
  // which is invoked from calibrate()/monitor() — a self-perpetuating
  // requestAnimationFrame chain kicked off once from a mount-only effect, whose
  // closures are frozen at that first render and never recreated from later
  // re-renders. Reading the state value directly from inside that frozen chain would
  // forever see whatever it was on the render that kicked the chain off; a ref's
  // `.current` is always read fresh regardless of which render's closure is
  // executing it.
  const vadDebugEnabled = useSyncExternalStore(
    noopSubscribe,
    getVadDebugClientSnapshot,
    getVadDebugServerSnapshot
  );
  const vadDebugEnabledRef = useRef(false);
  useEffect(() => {
    vadDebugEnabledRef.current = vadDebugEnabled;
  }, [vadDebugEnabled]);
  const debugRmsRef = useRef(null);
  const debugThresholdRef = useRef(null);
  const debugBarRef = useRef(null);

  function updateDebugOverlay(rms, threshold) {
    if (!vadDebugEnabledRef.current) return;
    if (debugRmsRef.current) debugRmsRef.current.textContent = rms.toFixed(4);
    if (debugThresholdRef.current) debugThresholdRef.current.textContent = threshold.toFixed(4);
    if (debugBarRef.current) {
      const pct = Math.max(0, Math.min(100, (rms / (threshold * 2)) * 100));
      debugBarRef.current.style.width = `${pct}%`;
      debugBarRef.current.style.background = rms > threshold ? "#e05d44" : "#4caf50";
    }
  }

  // Turn-level speech/silence state. Deliberately untouched by segment boundaries,
  // so a segment closing (or a brand-new, still-empty segment) can never reset it.
  const hasSpokenInTurnRef = useRef(false);
  const turnBelowThresholdSinceRef = useRef(null);
  const turnSpeechStartTimeRef = useRef(null);
  const lastSpeechAtRef = useRef(null);
  const completedSegmentCountRef = useRef(0);
  const segmentPromisesRef = useRef([]);

  // Segment-level: reset every time a new segment starts.
  const currentRecorderRef = useRef(null);
  const segmentHasSpokenRef = useRef(false);
  const segmentAboveThresholdSinceRef = useRef(null);
  const segmentBelowThresholdSinceRef = useRef(null);
  const segmentSpeechDurationRef = useRef(0);

  useEffect(() => {
    activeRef.current = true;
    startTurn();

    return () => {
      activeRef.current = false;
      stoppedRef.current = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function teardown() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (currentRecorderRef.current && currentRecorderRef.current.state !== "inactive") {
      currentRecorderRef.current.stop();
    }
    currentRecorderRef.current = null;
    if (sourceRef.current) sourceRef.current.disconnect();
    sourceRef.current = null;
    if (analyserRef.current) analyserRef.current.disconnect();
    analyserRef.current = null;
    dataArrayRef.current = null;
    updateBars(0);
    // NOTE: stream/audioContext are NOT stopped/closed here — they're owned by the
    // parent for the whole conversation, not per-turn.
  }

  function startTurn() {
    stoppedRef.current = false;
    hasSpokenInTurnRef.current = false;
    turnBelowThresholdSinceRef.current = null;
    turnSpeechStartTimeRef.current = null;
    lastSpeechAtRef.current = null;
    completedSegmentCountRef.current = 0;
    segmentPromisesRef.current = [];
    lastMonitorTimeRef.current = null;
    calibrationStartTimeRef.current = null;
    calibrationSumRef.current = 0;
    calibrationCountRef.current = 0;
    setStatus(STATUS.INIT);

    if (!stream || !audioContext) {
      setStatus(STATUS.MIC_ERROR);
      return;
    }

    try {
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.fftSize);

      setStatus(STATUS.CALIBRATING);
      rafRef.current = requestAnimationFrame(calibrate);
    } catch (err) {
      setStatus(STATUS.MIC_ERROR);
    }
  }

  // Samples ambient noise for CALIBRATION_MS before speech detection is armed, so
  // the effective threshold adapts to each user's mic and room instead of relying
  // on one hardcoded value.
  function calibrate() {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !dataArray || stoppedRef.current) return;

    const rms = readRms(analyser, dataArray);
    updateBars(rms);
    updateDebugOverlay(rms, effectiveThresholdRef.current);
    const now = performance.now();
    if (calibrationStartTimeRef.current === null) {
      calibrationStartTimeRef.current = now;
    }
    calibrationSumRef.current += rms;
    calibrationCountRef.current += 1;

    if (now - calibrationStartTimeRef.current >= CALIBRATION_MS) {
      finishCalibration();
      return;
    }

    rafRef.current = requestAnimationFrame(calibrate);
  }

  function finishCalibration() {
    const count = calibrationCountRef.current;
    const baseline = count > 0 ? calibrationSumRef.current / count : 0;
    const threshold = Math.max(baseline * BASELINE_NOISE_MULTIPLIER, MIN_SPEECH_THRESHOLD);
    effectiveThresholdRef.current = threshold;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[HandsFreeRecorder] Ambient noise baseline: ${baseline.toFixed(4)} RMS -> speech threshold: ${threshold.toFixed(4)} RMS`
      );
    }

    lastMonitorTimeRef.current = null;
    startSegment();
    setStatus(STATUS.LISTENING);
    rafRef.current = requestAnimationFrame(monitor);
  }

  // Starts a new segment's recorder on the shared conversation-level stream.
  // Segment-level state resets here; turn-level state (hasSpokenInTurnRef,
  // turnBelowThresholdSinceRef, etc.) is untouched, so the turn-end timer keeps
  // counting straight through this.
  function startSegment() {
    segmentHasSpokenRef.current = false;
    segmentAboveThresholdSinceRef.current = null;
    segmentBelowThresholdSinceRef.current = null;
    segmentSpeechDurationRef.current = 0;

    const recorder = new MediaRecorder(stream);
    recorder.chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recorder.chunks.push(e.data);
    };
    currentRecorderRef.current = recorder;
    recorder.start();
  }

  // Stops the current segment's recorder. If the segment never contained real
  // speech (including a brand-new segment opened right before the turn ended),
  // it's discarded with no transcription request. Otherwise it's queued for
  // transcription and its promise is tracked for stitching at turn-end.
  function closeCurrentSegment() {
    const recorder = currentRecorderRef.current;
    if (!recorder) return;
    currentRecorderRef.current = null;

    const hadRealSpeech =
      segmentHasSpokenRef.current && segmentSpeechDurationRef.current >= MIN_TOTAL_SPEECH_MS;

    if (!hadRealSpeech) {
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }

    completedSegmentCountRef.current += 1;
    const promise = new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(recorder.chunks, { type: "audio/webm" });
          const body = new FormData();
          body.append("audio", blob, "segment.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body });
          if (!res.ok) throw new Error("Transcription request failed");
          const data = await res.json();
          resolve(data.transcript);
        } catch (err) {
          reject(err);
        }
      };
    });
    segmentPromisesRef.current.push(promise);
    if (recorder.state !== "inactive") recorder.stop();
  }

  function monitor() {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !dataArray || stoppedRef.current) return;

    const rms = readRms(analyser, dataArray);
    updateBars(rms);
    updateDebugOverlay(rms, effectiveThresholdRef.current);
    const now = performance.now();
    const frameDelta = lastMonitorTimeRef.current === null ? 0 : now - lastMonitorTimeRef.current;
    lastMonitorTimeRef.current = now;

    if (rms > effectiveThresholdRef.current) {
      segmentSpeechDurationRef.current += frameDelta;
      segmentBelowThresholdSinceRef.current = null;
      turnBelowThresholdSinceRef.current = null;
      lastSpeechAtRef.current = now;

      if (!segmentHasSpokenRef.current) {
        if (segmentAboveThresholdSinceRef.current === null) {
          segmentAboveThresholdSinceRef.current = now;
        } else if (now - segmentAboveThresholdSinceRef.current >= MIN_SPEECH_MS) {
          segmentHasSpokenRef.current = true;
          if (!hasSpokenInTurnRef.current) {
            hasSpokenInTurnRef.current = true;
            turnSpeechStartTimeRef.current = now;
          }
          setStatus(STATUS.RECORDING);
        }
      }
    } else {
      segmentAboveThresholdSinceRef.current = null;

      // Segment-level pause (shorter threshold): close this segment and open the
      // next one, without affecting the turn-level silence timer below.
      if (segmentHasSpokenRef.current) {
        if (segmentBelowThresholdSinceRef.current === null) {
          segmentBelowThresholdSinceRef.current = now;
        } else if (now - segmentBelowThresholdSinceRef.current >= SEGMENT_SILENCE_MS) {
          closeCurrentSegment();
          startSegment();
        }
      }

      // Turn-level pause (longer threshold): keyed off whether the TURN has ever
      // heard real speech, not the current segment. This is what lets the turn end
      // even when the just-opened segment is still completely empty.
      if (hasSpokenInTurnRef.current) {
        if (turnBelowThresholdSinceRef.current === null) {
          turnBelowThresholdSinceRef.current = now;
        } else if (now - turnBelowThresholdSinceRef.current >= TURN_SILENCE_MS) {
          endTurn();
          return;
        }
      }
    }

    // Safety fallback: computed independently of turnBelowThresholdSinceRef, so a
    // bug in the primary turn-silence path above can never trap the user forever.
    if (
      completedSegmentCountRef.current > 0 &&
      lastSpeechAtRef.current !== null &&
      now - lastSpeechAtRef.current >= TURN_SAFETY_TIMEOUT_MS
    ) {
      endTurn();
      return;
    }

    if (hasSpokenInTurnRef.current && now - turnSpeechStartTimeRef.current >= MAX_RECORDING_MS) {
      endTurn();
      return;
    }

    rafRef.current = requestAnimationFrame(monitor);
  }

  function endTurn() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    closeCurrentSegment();

    if (sourceRef.current) sourceRef.current.disconnect();
    sourceRef.current = null;
    if (analyserRef.current) analyserRef.current.disconnect();
    analyserRef.current = null;
    // stream/audioContext stay open — owned by the parent for the whole conversation.

    finishTurn();
  }

  async function finishTurn() {
    if (!activeRef.current) return;

    const pending = segmentPromisesRef.current;
    if (pending.length === 0) {
      // No segment in this turn ever contained real speech — background noise
      // or a brief blip. Discard and quietly resume listening.
      startTurn();
      return;
    }

    setStatus(STATUS.TRANSCRIBING);

    try {
      const transcripts = await Promise.all(pending);
      if (!activeRef.current) return;
      const stitched = transcripts
        .map((t) => (t || "").trim())
        .filter(Boolean)
        .join(" ");
      if (!stitched) {
        startTurn();
        return;
      }
      onTranscriptReady?.(stitched);
    } catch (err) {
      if (!activeRef.current) return;
      setStatus(STATUS.TRANSCRIBE_ERROR);
      retryTimeoutRef.current = setTimeout(() => {
        if (activeRef.current) startTurn();
      }, RETRY_DELAY_MS);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {status === STATUS.INIT && (
        <p className="fade-in" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Mikrofon wird aktiviert …</p>
      )}

      {(status === STATUS.CALIBRATING || status === STATUS.LISTENING || status === STATUS.RECORDING) && (
        <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="mic-bars">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="mic-bar" ref={(el) => (barRefs.current[i] = el)} />
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            {status === STATUS.CALIBRATING && "Kalibrierung …"}
            {status === STATUS.LISTENING && "Hören zu … sprechen Sie, wenn Sie bereit sind."}
            {status === STATUS.RECORDING && "Sie sprechen …"}
          </p>
        </div>
      )}

      {status === STATUS.TRANSCRIBING && (
        <p className="fade-in" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Transkription läuft …</p>
      )}
      {status === STATUS.MIC_ERROR && (
        <p className="fade-in form-error">
          Mikrofonzugriff wurde verweigert oder ist nicht verfügbar.
        </p>
      )}
      {status === STATUS.TRANSCRIBE_ERROR && (
        <p className="fade-in form-error">
          Transkription fehlgeschlagen. Wir hören gleich erneut zu …
        </p>
      )}

      {vadDebugEnabled && (
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "0.75rem",
            padding: "0.6rem 0.75rem",
            borderRadius: "6px",
            minWidth: "180px",
          }}
        >
          <div style={{ marginBottom: "0.35rem", opacity: 0.7 }}>VAD debug (?vaddebug=1)</div>
          <div style={{ height: "6px", background: "#333", borderRadius: "3px", marginBottom: "0.35rem", overflow: "hidden" }}>
            <div ref={debugBarRef} style={{ height: "100%", width: "0%", background: "#4caf50" }} />
          </div>
          <div>rms: <span ref={debugRmsRef}>0.0000</span></div>
          <div>threshold: <span ref={debugThresholdRef}>0.0000</span></div>
          <div>state: {status}</div>
        </div>
      )}
    </div>
  );
}
