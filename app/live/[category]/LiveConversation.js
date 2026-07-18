"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import HandsFreeRecorder from "./HandsFreeRecorder";
import FeedbackDisplay from "../../components/FeedbackDisplay";

const PHASE = {
  INTRO: "intro",
  AI_LOADING: "ai_loading",
  AI_SPEAKING: "ai_speaking",
  USER_TURN: "user_turn",
  ENDING: "ending",
  ENDED: "ended",
};

// [leak-check]/[speak-check] instrumentation is dev-only diagnostic noise for
// tracking down mic-leak and audio-overlap bugs — silent in production builds.
const isDev = process.env.NODE_ENV !== "production";
const devLog = isDev ? (...args) => console.log(...args) : () => {};
const devWarn = isDev ? (...args) => console.error(...args) : () => {};

// Keeps the punctuation attached to each sentence; a trailing fragment with no
// sentence-ending punctuation is kept as its own entry.
function splitIntoSentences(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [trimmed];
}

async function synthesizeSentence(text) {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Speech synthesis request failed");
  const audioBlob = await res.blob();
  return URL.createObjectURL(audioBlob);
}

// Voice list loads asynchronously in some browsers (Chrome fires "voiceschanged" after an
// initial empty getVoices() call) — wait for it once, bounded, rather than risk silently
// missing an available German voice on the very first utterance of a session.
function pickGermanVoice(synth) {
  return new Promise((resolve) => {
    const fromList = (voices) => voices.find((v) => v.lang?.toLowerCase().startsWith("de")) || null;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(fromList(existing));
      return;
    }
    const timer = setTimeout(() => resolve(fromList(synth.getVoices())), 300);
    synth.onvoiceschanged = () => {
      clearTimeout(timer);
      resolve(fromList(synth.getVoices()));
    };
  });
}

// Used when ttsMode is "browser" — either forced explicitly, or as a runtime fallback when
// "edge" (Vercel's default TTS backend) fails entirely for a turn. window.speechSynthesis
// has no network/synthesis delay, so sentences are simply spoken one after another — no
// need for the fetch-ahead-of-playback pipeline the server-side modes use. Mirrors speak()'s
// onAudioStart/onDone contract so requestNextLine doesn't need to know which backend is
// active.
function speakBrowser(synth, text, onAudioStart, onDone) {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    onDone();
    return () => {};
  }

  let cancelled = false;

  (async () => {
    const voice = await pickGermanVoice(synth);
    if (cancelled) return;

    let audioStartFired = false;
    const speakNext = (i) => {
      if (cancelled) return;
      if (i >= sentences.length) {
        onDone();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(sentences[i]);
      utterance.lang = "de-DE";
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (!audioStartFired) {
          audioStartFired = true;
          onAudioStart();
        }
      };
      utterance.onend = () => speakNext(i + 1);
      utterance.onerror = () => speakNext(i + 1);
      synth.speak(utterance);
    };
    speakNext(0);
  })();

  return () => {
    cancelled = true;
    synth.cancel();
  };
}

export default function LiveConversation({ scenarioPrompt, categoryId, scenarioTitle, ttsMode }) {
  const { data: authSession } = useSession();
  const [phase, setPhase] = useState(PHASE.INTRO);
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [audioStarted, setAudioStarted] = useState(false);
  const endedRef = useRef(false);
  const audioRef = useRef(null);
  const cancelPlaybackRef = useRef(null);

  // The mic AudioContext + getUserMedia stream for the WHOLE conversation, created
  // once (on "Gespräch starten") and reused for every turn until the conversation
  // ends — not recreated per turn. This is what HandsFreeRecorder now receives as
  // props instead of acquiring its own, removing the per-turn acquire/release cycle
  // (and the whole category of mount/unmount races that came with it) entirely.
  // `mic` (state) is what gets passed to render; `micRef` mirrors it for imperative
  // access from releaseMic()/ensureMicReady(), which must never read refs at render time.
  const [mic, setMic] = useState(null); // { stream, audioContext, appliedMicSettings } | null
  const micRef = useRef(null);
  const micReadyPromiseRef = useRef(null);

  const ensureMicReady = useCallback(() => {
    if (micRef.current) {
      return Promise.resolve();
    }
    if (!micReadyPromiseRef.current) {
      micReadyPromiseRef.current = (async () => {
        // autoGainControl is deliberately off: the browser's AGC keeps boosting mic
        // gain after the user stops speaking, which lifts the ambient noise floor
        // above the calibrated silence threshold and turn-end silence never
        // accumulates (see the rolling noise-floor tracking in HandsFreeRecorder,
        // which is the defense-in-depth for cases where a device ignores this
        // constraint and applies AGC anyway).
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Browsers can silently ignore constraints (some devices force AGC on
        // regardless, for example), so read back what was actually granted rather
        // than assume the request was honored. Surfaced in the ?vaddebug=1 overlay.
        const [track] = stream.getAudioTracks();
        const appliedMicSettings = track ? track.getSettings() : null;
        devLog("[leak-check] Mic constraints actually applied:", appliedMicSettings);
        const value = { stream, audioContext, appliedMicSettings };
        micRef.current = value;
        setMic(value);
        devLog("[leak-check] Conversation mic ready: 1 AudioContext + 1 getUserMedia stream created for the whole conversation");
      })();
    }
    return micReadyPromiseRef.current;
  }, []);

  const releaseMic = useCallback(() => {
    micReadyPromiseRef.current = null;
    const current = micRef.current;
    if (current) {
      const tracks = current.stream.getTracks();
      tracks.forEach((t) => t.stop());
      devLog(`[leak-check] Conversation mic released: stopped ${tracks.length} track(s)`);
      if (current.audioContext.state !== "closed") {
        current.audioContext
          .close()
          .then(() => devLog("[leak-check] Conversation AudioContext closed"))
          .catch((err) => devWarn(`[leak-check] Conversation AudioContext close() failed: ${err.message}`));
      }
    }
    micRef.current = null;
    setMic(null);
  }, []);

  const stopSpeaking = useCallback(() => {
    cancelPlaybackRef.current?.();
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
      releaseMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  // "piper" and "edge" both go through /api/speak and share this fetch-ahead pipeline
  // (sentence 1 plays as soon as its audio is ready, while sentence 2 is already
  // synthesizing in the background, and so on — identical from here on regardless of which
  // server-side backend produced the audio). "browser" bypasses this pipeline entirely (see
  // speakBrowser() below). onDone only fires once the final sentence's audio has finished,
  // or — if every sentence's synthesis failed while ttsMode is "edge" — after falling back
  // to speakBrowser() for the whole reply.
  const speak = useCallback(async (text, onAudioStart, onDone) => {
    if (ttsMode === "browser") {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
        setErrorMessage("Der Kunde konnte nicht vorgelesen werden.");
        onDone();
        return;
      }
      devLog("[speak-check] speak() using browser speechSynthesis");
      cancelPlaybackRef.current = speakBrowser(synth, text, onAudioStart, onDone);
      return;
    }

    const sentences = splitIntoSentences(text);
    devLog(`[speak-check] speak() called with ${sentences.length} sentence(s):`, sentences);
    if (sentences.length === 0) {
      onDone();
      return;
    }

    let cancelled = false;
    let audioStartFired = false;
    let playedAny = false;
    let currentlyPlayingIndex = null; // [speak-check] tracks whether a prior clip is still active
    const audioUrlPromises = new Array(sentences.length);

    for (let i = 0; i < sentences.length && !cancelled; i++) {
      if (!audioUrlPromises[i]) {
        audioUrlPromises[i] = synthesizeSentence(sentences[i]);
      }
      if (i + 1 < sentences.length && !audioUrlPromises[i + 1]) {
        audioUrlPromises[i + 1] = synthesizeSentence(sentences[i + 1]);
      }

      let audioUrl;
      try {
        audioUrl = await audioUrlPromises[i];
      } catch (err) {
        console.error(`[speak] Synthesis failed for sentence ${i + 1}/${sentences.length}: ${err.message}`);
        continue;
      }
      if (cancelled) {
        URL.revokeObjectURL(audioUrl);
        break;
      }

      playedAny = true;
      await new Promise((resolve) => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        const finish = (eventName) => {
          devLog(
            `[speak-check] sentence ${i + 1}/${sentences.length} ${eventName} at t=${performance.now().toFixed(0)}ms`
          );
          if (currentlyPlayingIndex === i) currentlyPlayingIndex = null;
          URL.revokeObjectURL(audioUrl);
          cancelPlaybackRef.current = null;
          resolve();
        };
        cancelPlaybackRef.current = () => {
          cancelled = true;
          finish("cancelled");
        };
        audio.onplaying = () => {
          devLog(
            `[speak-check] sentence ${i + 1}/${sentences.length} onplaying at t=${performance.now().toFixed(0)}ms`
          );
          if (!audioStartFired) {
            audioStartFired = true;
            onAudioStart();
          }
        };
        audio.onended = () => finish("onended");
        audio.onerror = () => finish("onerror");

        if (currentlyPlayingIndex !== null) {
          devWarn(
            `[speak-check] OVERLAP DETECTED: about to play() sentence ${i + 1} while sentence ` +
              `${currentlyPlayingIndex + 1} has not fired onended/onerror yet`
          );
        }
        currentlyPlayingIndex = i;
        devLog(
          `[speak-check] sentence ${i + 1}/${sentences.length} play() called at t=${performance.now().toFixed(0)}ms`
        );
        audio.play().catch(() => finish("play-error"));
      });
    }

    if (!playedAny) {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (ttsMode === "edge" && synth) {
        devWarn("[speak-check] Edge TTS failed entirely for this turn; falling back to browser speechSynthesis.");
        cancelPlaybackRef.current = speakBrowser(synth, text, onAudioStart, onDone);
        return;
      }
      setErrorMessage("Der Kunde konnte nicht vorgelesen werden.");
    }
    onDone();
  }, [ttsMode]);

  const requestNextLine = useCallback(
    async (history) => {
      setPhase(PHASE.AI_LOADING);
      setErrorMessage("");
      try {
        const res = await fetch("/api/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioPrompt, messages: history }),
        });
        if (!res.ok) throw new Error("Conversation request failed");
        const data = await res.json();
        if (endedRef.current) return;

        const nextMessages = [...history, { role: "assistant", content: data.line }];
        setMessages(nextMessages);
        setPhase(PHASE.AI_SPEAKING);
        setAudioStarted(false);
        speak(
          data.line,
          () => setAudioStarted(true),
          () => {
            if (!endedRef.current) setPhase(PHASE.USER_TURN);
          }
        );
      } catch (err) {
        if (endedRef.current) return;
        setErrorMessage("Der Kunde konnte nicht antworten. Bitte versuchen Sie es erneut.");
        setPhase(PHASE.USER_TURN);
      }
    },
    [scenarioPrompt, speak]
  );

  const handleStart = async () => {
    setErrorMessage("");
    try {
      await ensureMicReady();
    } catch (err) {
      setErrorMessage("Mikrofonzugriff wurde verweigert oder ist nicht verfügbar.");
      return;
    }
    requestNextLine([]);
  };

  const handleUserTranscript = useCallback(
    (transcript) => {
      const nextMessages = [...messages, { role: "user", content: transcript }];
      setMessages(nextMessages);
      requestNextLine(nextMessages);
    },
    [messages, requestNextLine]
  );

  const endConversation = useCallback(async () => {
    endedRef.current = true;
    stopSpeaking();
    releaseMic();
    setPhase(PHASE.ENDING);
    setErrorMessage("");
    try {
      const res = await fetch("/api/conversation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioPrompt, messages }),
      });
      if (!res.ok) throw new Error("Conversation feedback failed");
      const data = await res.json();
      setFeedback(data.feedback);
      setPhase(PHASE.ENDED);

      if (authSession?.user) {
        fetch("/api/progress/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: categoryId,
            scenarioTitle,
            scenarioPrompt,
            score: data.feedback?.score,
            feedback: data.feedback,
          }),
        }).catch(() => {
          // Best-effort save — a failed save shouldn't block showing the feedback.
        });
      }
    } catch (err) {
      setErrorMessage("Feedback konnte nicht geladen werden. Bitte versuchen Sie es erneut.");
      setPhase(PHASE.ENDED);
    }
  }, [scenarioPrompt, messages, stopSpeaking, releaseMic, authSession, categoryId, scenarioTitle]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {phase === PHASE.INTRO && (
        <div className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <h3 style={{ fontSize: "0.95rem", color: "var(--accent)", marginBottom: "0.5rem" }}>
            Regeln
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Sprechen Sie einfach los, wenn Sie bereit sind — die App erkennt automatisch, wenn
            Sie fertig sind, und schickt Ihre Antwort weiter. Es ist kein Aufnahme-Button nötig.
          </p>
        </div>
      )}

      {phase === PHASE.INTRO && (
        <button className="btn" onClick={handleStart} style={{ alignSelf: "flex-start" }}>
          Gespräch starten
        </button>
      )}

      {messages.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {messages.map((m, i) => (
            <div
              key={i}
              className="card fade-in"
              style={{
                alignSelf: m.role === "assistant" ? "flex-start" : "flex-end",
                maxWidth: "85%",
                borderLeft:
                  m.role === "assistant"
                    ? "3px solid var(--accent-phrasing)"
                    : "3px solid var(--accent)",
              }}
            >
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.35rem" }}>
                {m.role === "assistant" ? "Kunde" : "Sie"}
              </p>
              <p>{m.content}</p>
            </div>
          ))}
        </div>
      )}

      {phase === PHASE.AI_LOADING && (
        <p className="fade-in" style={{ color: "var(--muted)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          Der Kunde antwortet
          <span className="speaking-indicator">
            <span />
            <span />
            <span />
          </span>
        </p>
      )}

      {phase === PHASE.AI_SPEAKING && (
        <p className="fade-in" style={{ color: "var(--muted)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {audioStarted ? "Der Kunde spricht" : "Kunde spricht gleich"}
          {audioStarted && (
            <span className="speaking-indicator">
              <span />
              <span />
              <span />
            </span>
          )}
        </p>
      )}

      {phase === PHASE.USER_TURN && mic && (
        <HandsFreeRecorder
          key={messages.length}
          stream={mic.stream}
          audioContext={mic.audioContext}
          onTranscriptReady={handleUserTranscript}
          appliedMicSettings={mic.appliedMicSettings}
        />
      )}

      {errorMessage && <p className="fade-in form-error">{errorMessage}</p>}

      {phase !== PHASE.INTRO && phase !== PHASE.ENDING && phase !== PHASE.ENDED && (
        <button
          className="btn btn-secondary"
          onClick={endConversation}
          style={{ alignSelf: "flex-start" }}
        >
          Gespräch beenden
        </button>
      )}

      {phase === PHASE.ENDING && (
        <p className="fade-in" style={{ color: "var(--muted)" }}>Feedback wird erstellt …</p>
      )}

      {feedback && <FeedbackDisplay feedback={feedback} />}
    </div>
  );
}
