"use client";

import { useEffect, useRef, useState } from "react";

// --- Tunable VAD constants (adjust after real-world testing) ---
const CALIBRATION_MS = 500; // how long to sample ambient noise before arming speech detection
const BASELINE_NOISE_MULTIPLIER = 4; // effective speech threshold = measured noise floor * this — raised from 3 for constant broadband noise (fan/AC): the floor itself has more moment-to-moment variance than a quiet room, so a bit more headroom avoids spurious threshold-crossings from that variance. Real speech (even soft, with AGC off) is normally many multiples of the ambient floor once noiseSuppression is genuinely active, so this shouldn't meaningfully risk missing real speech — but it's a starting point: use the "Calibrate check" tool in the ?vaddebug=1 overlay with real-tester data to confirm/tune.
const MIN_SPEECH_THRESHOLD = 0.015; // floor under the adaptive threshold, for near-silent rooms
const NOISE_FLOOR_RISE_TIME_CONSTANT_MS = 8000; // how slowly the rolling noise floor follows an UPWARD non-speech RMS reading — deliberately slow so a single transient (cough, door slam, brief consonant dip) can't ratchet the floor (and threshold) up
const NOISE_FLOOR_FALL_TIME_CONSTANT_MS = 1000; // how quickly the floor follows a DOWNWARD reading — fast, so if a transient does nudge it up, it recovers in ~1s instead of staying inflated for the rest of the turn
const NOISE_FLOOR_CONFIRM_MS = 300; // a below-threshold frame only counts as "confirmed non-speech" (and is allowed to feed the floor) once the dip has lasted this long — shorter dips are ordinary mid-word/inter-word pauses, not real silence, and must never pollute the floor (this is what let constant fan/AC noise + natural speech dips ratchet the threshold up mid-sentence and cause dropouts)
const MIN_SPEECH_MS = 250; // must stay above threshold this long to count as real speech start (debounces clicks/coughs)
const MIN_TOTAL_SPEECH_MS = 400; // cumulative time above threshold required to treat a segment as real speech, not noise
const SEGMENT_SILENCE_MS = 600; // pause long enough to close the current segment, but not end the turn (e.g. between sentences)
const TURN_SILENCE_MS = 2500; // sustained silence, tracked at the turn level, that ends the whole turn — tune this one constant as real-tester data comes in; 1200ms cut off German learners' natural 1.5-2.5s mid-sentence word-searching pauses
const TURN_SAFETY_TIMEOUT_MS = 8000; // absolute fallback: force-end the turn after this much silence, independent of TURN_SILENCE_MS — raised proportionally with TURN_SILENCE_MS so it can't fire during a normal long thinking pause
const MAX_RECORDING_MS = 60000; // failsafe cap on a single turn's length, measured from detected speech start
const RETRY_DELAY_MS = 1500; // delay before automatically re-listening after a failed transcription
const CALIB_CHECK_DURATION_MS = 10000; // length of each side of the debug overlay's manual "Calibrate check" (silent vs. speaking) sample

const STATUS = {
  INIT: "init",
  CALIBRATING: "calibrating",
  LISTENING: "listening",
  RECORDING: "recording",
  TRANSCRIBING: "transcribing",
  MIC_ERROR: "mic_error",
  TRANSCRIBE_ERROR: "transcribe_error",
};

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
export default function HandsFreeRecorder({ stream, audioContext, onTranscriptReady, appliedMicSettings }) {
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
  // Samples are kept (not just summed) so the baseline can be taken as a median —
  // see finishCalibration() for why.
  const calibrationStartTimeRef = useRef(null);
  const calibrationSamplesRef = useRef([]);
  const effectiveThresholdRef = useRef(MIN_SPEECH_THRESHOLD);

  // Rolling noise-floor estimate, seeded from calibration but kept live for the rest
  // of the turn (an asymmetric EMA over *confirmed* non-speech frames — see
  // NOISE_FLOOR_RISE_TIME_CONSTANT_MS / NOISE_FLOOR_FALL_TIME_CONSTANT_MS /
  // NOISE_FLOOR_CONFIRM_MS). This is what lets the threshold keep tracking ambient
  // drift after calibration ends, instead of being pinned to a single one-time
  // measurement.
  const noiseFloorRef = useRef(MIN_SPEECH_THRESHOLD / BASELINE_NOISE_MULTIPLIER);
  // How long the current run of below-threshold frames has lasted, regardless of
  // segment/turn boundaries — reset the instant a speech frame occurs. Only once this
  // exceeds NOISE_FLOOR_CONFIRM_MS is a frame "confirmed" non-speech and allowed to
  // feed the floor EMA.
  const nonSpeechRunStartRef = useRef(null);

  // Dev-only debug overlay (?vaddebug=1). The live numbers (bar/rms/threshold/floor)
  // are DOM refs updated directly per frame, same reasoning as barRefs/updateBars —
  // this repaints every animation frame and must not go through React state/re-render.
  // The event log and calibrate-check results update far less often, so those use
  // normal React state.
  const [vadDebugEnabled] = useState(
    () =>
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("vaddebug") === "1"
  );
  const debugRmsRef = useRef(null);
  const debugThresholdRef = useRef(null);
  const debugFloorRef = useRef(null);
  const debugBarRef = useRef(null);

  function updateDebugOverlay(rms, threshold, floor) {
    if (!vadDebugEnabled) return;
    if (debugRmsRef.current) debugRmsRef.current.textContent = rms.toFixed(4);
    if (debugThresholdRef.current) debugThresholdRef.current.textContent = threshold.toFixed(4);
    if (debugFloorRef.current) debugFloorRef.current.textContent = floor.toFixed(4);
    if (debugBarRef.current) {
      const pct = Math.max(0, Math.min(100, (rms / (threshold * 2)) * 100));
      debugBarRef.current.style.width = `${pct}%`;
      debugBarRef.current.style.background = rms > threshold ? "#e05d44" : "#4caf50";
    }
  }

  // VAD state-transition log: every speech-start, segment-end, turn-end, and
  // force-end, with the timestamp and the RMS value that triggered it. Printed to
  // the console immediately (so it survives even if the overlay isn't being watched)
  // and kept in state for the overlay's scrollable list (capped, so a long
  // conversation doesn't grow this unboundedly).
  const [vadEventLog, setVadEventLog] = useState([]);
  function logVadEvent(event, rms, detail) {
    const entry = { t: performance.now(), event, rms, detail };
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[VAD] ${event}${detail ? ` (${detail})` : ""} at t=${entry.t.toFixed(0)}ms rms=${rms.toFixed(4)}`
      );
    }
    if (vadDebugEnabled) {
      setVadEventLog((prev) => [...prev.slice(-19), entry]);
    }
  }

  // Manual "Calibrate check": the user presses once while silent (fan/AC only) and
  // once while speaking normally, each capturing 10s of min/max/avg RMS off the same
  // analyser the real VAD uses, so the two ranges can be compared side by side to see
  // whether a safe threshold actually exists between them.
  const [calibCheck, setCalibCheck] = useState({ phase: "idle", silent: null, speech: null });
  const calibCheckRafRef = useRef(null);

  function runCalibCheck(kind) {
    if (!analyserRef.current || !dataArrayRef.current) return;
    setCalibCheck((prev) => ({ ...prev, phase: kind === "silent" ? "recording-silent" : "recording-speech" }));

    const startedAt = performance.now();
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    const tick = () => {
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      if (!analyser || !dataArray) {
        // Turn ended mid-check (e.g. the conversation moved on) — abort quietly.
        setCalibCheck((prev) => ({ ...prev, phase: "idle" }));
        return;
      }
      const rms = readRms(analyser, dataArray);
      min = Math.min(min, rms);
      max = Math.max(max, rms);
      sum += rms;
      count += 1;

      if (performance.now() - startedAt >= CALIB_CHECK_DURATION_MS) {
        const result = { min, max, avg: count > 0 ? sum / count : 0 };
        setCalibCheck((prev) => ({ ...prev, phase: "idle", [kind]: result }));
        return;
      }
      calibCheckRafRef.current = requestAnimationFrame(tick);
    };
    calibCheckRafRef.current = requestAnimationFrame(tick);
  }

  function handleCalibCheckClick() {
    if (calibCheck.phase !== "idle") return;
    if (!calibCheck.silent) {
      runCalibCheck("silent");
    } else if (!calibCheck.speech) {
      runCalibCheck("speech");
    } else {
      setCalibCheck({ phase: "idle", silent: null, speech: null });
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
      if (calibCheckRafRef.current) cancelAnimationFrame(calibCheckRafRef.current);
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
    calibrationSamplesRef.current = [];
    noiseFloorRef.current = MIN_SPEECH_THRESHOLD / BASELINE_NOISE_MULTIPLIER;
    nonSpeechRunStartRef.current = null;
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

      // Start recording BEFORE calibration, not after: previously the first segment's
      // MediaRecorder only started once finishCalibration() ran, so anyone who began
      // speaking during the 500ms calibration window (very plausible — people often
      // reply the instant they're ready) had that speech silently lost, with no
      // recorder running to capture it at all. Now the segment spans calibration too,
      // so that audio is captured regardless. The calibration baseline itself is
      // still protected from being skewed by such overlap — see finishCalibration().
      startSegment();

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
    updateDebugOverlay(rms, effectiveThresholdRef.current, noiseFloorRef.current);
    const now = performance.now();
    if (calibrationStartTimeRef.current === null) {
      calibrationStartTimeRef.current = now;
    }
    calibrationSamplesRef.current.push(rms);

    if (now - calibrationStartTimeRef.current >= CALIBRATION_MS) {
      finishCalibration();
      return;
    }

    rafRef.current = requestAnimationFrame(calibrate);
  }

  function finishCalibration() {
    const samples = calibrationSamplesRef.current;
    // Median, not mean: since recording now starts before calibration (see
    // startTurn()), an eager speaker's utterance can overlap this window. A mean
    // would let that speech drag the whole baseline (and therefore the threshold)
    // up for the rest of the turn; a median ignores it as long as it's a minority
    // of the 500ms window, which it normally is.
    const sorted = [...samples].sort((a, b) => a - b);
    const baseline = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
    const threshold = Math.max(baseline * BASELINE_NOISE_MULTIPLIER, MIN_SPEECH_THRESHOLD);
    effectiveThresholdRef.current = threshold;
    noiseFloorRef.current = baseline;
    nonSpeechRunStartRef.current = null;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[HandsFreeRecorder] Ambient noise baseline (median): ${baseline.toFixed(4)} RMS -> speech threshold: ${threshold.toFixed(4)} RMS`
      );
    }

    lastMonitorTimeRef.current = null;
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
  function closeCurrentSegment(rms) {
    const recorder = currentRecorderRef.current;
    if (!recorder) return;
    currentRecorderRef.current = null;

    const hadRealSpeech =
      segmentHasSpokenRef.current && segmentSpeechDurationRef.current >= MIN_TOTAL_SPEECH_MS;

    if (!hadRealSpeech) {
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }

    logVadEvent("segment-end", rms);
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
    const now = performance.now();
    const frameDelta = lastMonitorTimeRef.current === null ? 0 : now - lastMonitorTimeRef.current;
    lastMonitorTimeRef.current = now;

    if (rms > effectiveThresholdRef.current) {
      updateDebugOverlay(rms, effectiveThresholdRef.current, noiseFloorRef.current);
      nonSpeechRunStartRef.current = null; // any speech frame resets floor-confirm timing
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
          logVadEvent("speech-start", rms);
        }
      }
    } else {
      segmentAboveThresholdSinceRef.current = null;

      // Only feed the rolling noise floor once this below-threshold run has lasted
      // NOISE_FLOOR_CONFIRM_MS: a brief inter-word/consonant dip mid-sentence is NOT
      // "confirmed non-speech" and must never pollute the floor. Only a genuinely
      // sustained pause counts.
      if (nonSpeechRunStartRef.current === null) {
        nonSpeechRunStartRef.current = now;
      }
      const confirmedNonSpeech = now - nonSpeechRunStartRef.current >= NOISE_FLOOR_CONFIRM_MS;

      if (confirmedNonSpeech && frameDelta > 0) {
        // Asymmetric EMA: adapt DOWN fast (recover quickly if a transient — cough,
        // door slam, its decay tail — briefly nudged the floor up) but UP slow (so
        // that same transient can't ratchet the floor, and the threshold, upward in
        // the first place).
        const risingUp = rms > noiseFloorRef.current;
        const timeConstant = risingUp ? NOISE_FLOOR_RISE_TIME_CONSTANT_MS : NOISE_FLOOR_FALL_TIME_CONSTANT_MS;
        const emaAlpha = 1 - Math.exp(-frameDelta / timeConstant);
        noiseFloorRef.current += emaAlpha * (rms - noiseFloorRef.current);
        effectiveThresholdRef.current = Math.max(
          noiseFloorRef.current * BASELINE_NOISE_MULTIPLIER,
          MIN_SPEECH_THRESHOLD
        );
      }
      updateDebugOverlay(rms, effectiveThresholdRef.current, noiseFloorRef.current);

      // Segment-level pause (shorter threshold): close this segment and open the
      // next one, without affecting the turn-level silence timer below.
      if (segmentHasSpokenRef.current) {
        if (segmentBelowThresholdSinceRef.current === null) {
          segmentBelowThresholdSinceRef.current = now;
        } else if (now - segmentBelowThresholdSinceRef.current >= SEGMENT_SILENCE_MS) {
          closeCurrentSegment(rms);
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
          endTurn("turn-end", rms);
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
      endTurn("force-end", rms, "safety-timeout");
      return;
    }

    if (hasSpokenInTurnRef.current && now - turnSpeechStartTimeRef.current >= MAX_RECORDING_MS) {
      endTurn("force-end", rms, "max-duration");
      return;
    }

    rafRef.current = requestAnimationFrame(monitor);
  }

  function endTurn(reason, rms, detail) {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    logVadEvent(reason, rms, detail);
    closeCurrentSegment(rms);

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
            background: "rgba(0,0,0,0.9)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "0.72rem",
            padding: "0.6rem 0.75rem",
            borderRadius: "6px",
            width: "260px",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <div style={{ marginBottom: "0.35rem", opacity: 0.7 }}>VAD debug (?vaddebug=1)</div>
          <div style={{ height: "6px", background: "#333", borderRadius: "3px", marginBottom: "0.35rem", overflow: "hidden" }}>
            <div ref={debugBarRef} style={{ height: "100%", width: "0%", background: "#4caf50" }} />
          </div>
          <div>rms: <span ref={debugRmsRef}>0.0000</span></div>
          <div>threshold: <span ref={debugThresholdRef}>0.0000</span></div>
          <div>noise floor: <span ref={debugFloorRef}>0.0000</span></div>

          <div style={{ marginTop: "0.5rem", borderTop: "1px solid #444", paddingTop: "0.35rem" }}>
            <div style={{ opacity: 0.7, marginBottom: "0.2rem" }}>applied mic constraints:</div>
            {appliedMicSettings ? (
              <div>
                echoCancellation: {String(appliedMicSettings.echoCancellation)}
                <br />
                noiseSuppression: {String(appliedMicSettings.noiseSuppression)}
                <br />
                autoGainControl: {String(appliedMicSettings.autoGainControl)}
              </div>
            ) : (
              <div>(unavailable)</div>
            )}
          </div>

          <div style={{ marginTop: "0.5rem", borderTop: "1px solid #444", paddingTop: "0.35rem" }}>
            <div style={{ opacity: 0.7, marginBottom: "0.2rem" }}>Calibrate check (10s each):</div>
            <button
              onClick={handleCalibCheckClick}
              disabled={calibCheck.phase !== "idle"}
              style={{
                width: "100%",
                fontSize: "0.68rem",
                padding: "0.3rem",
                marginBottom: "0.35rem",
                cursor: calibCheck.phase === "idle" ? "pointer" : "default",
              }}
            >
              {calibCheck.phase === "recording-silent" && "Aufnahme läuft — bitte still sein …"}
              {calibCheck.phase === "recording-speech" && "Aufnahme läuft — bitte normal sprechen …"}
              {calibCheck.phase === "idle" &&
                !calibCheck.silent &&
                "1) Stille aufnehmen (10s, nur Lüfter/Klimaanlage)"}
              {calibCheck.phase === "idle" &&
                calibCheck.silent &&
                !calibCheck.speech &&
                "2) Jetzt normal sprechen (10s)"}
              {calibCheck.phase === "idle" && calibCheck.silent && calibCheck.speech && "Zurücksetzen & erneut prüfen"}
            </button>
            {calibCheck.silent && (
              <div>
                silent: min {calibCheck.silent.min.toFixed(4)} / avg {calibCheck.silent.avg.toFixed(4)} / max{" "}
                {calibCheck.silent.max.toFixed(4)}
              </div>
            )}
            {calibCheck.speech && (
              <div>
                speech: min {calibCheck.speech.min.toFixed(4)} / avg {calibCheck.speech.avg.toFixed(4)} / max{" "}
                {calibCheck.speech.max.toFixed(4)}
              </div>
            )}
            {calibCheck.silent && calibCheck.speech && (
              <div
                style={{
                  marginTop: "0.2rem",
                  fontWeight: "bold",
                  color: calibCheck.silent.max >= calibCheck.speech.min ? "#e05d44" : "#4caf50",
                }}
              >
                {calibCheck.silent.max >= calibCheck.speech.min
                  ? "OVERLAP — no safe threshold exists between these ranges"
                  : "OK — clear gap between silence and speech"}
              </div>
            )}
          </div>

          <div style={{ marginTop: "0.5rem", borderTop: "1px solid #444", paddingTop: "0.35rem" }}>
            <div style={{ opacity: 0.7, marginBottom: "0.2rem" }}>event log:</div>
            <div style={{ maxHeight: "140px", overflowY: "auto" }}>
              {vadEventLog.length === 0 && <div style={{ opacity: 0.5 }}>(none yet)</div>}
              {vadEventLog
                .slice()
                .reverse()
                .map((e, i) => (
                  <div key={i}>
                    {(e.t / 1000).toFixed(1)}s {e.event}
                    {e.detail ? ` (${e.detail})` : ""} rms={e.rms.toFixed(4)}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
