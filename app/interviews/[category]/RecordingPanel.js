"use client";

import { useState, useRef, useCallback } from "react";
import FeedbackDisplay from "../../components/FeedbackDisplay";
import { fetchWithRateLimitRetry } from "../../../lib/clientApiError";

// Shown instead of a failure message when Groq's daily/rolling token limit is hit —
// a calm, expected-to-recover state, not something broken. See lib/groq.js /
// lib/clientApiError.js for how routes signal this distinctly from a real error.
const RATE_LIMITED_MESSAGE =
  "Gerade sind viele Übungen gleichzeitig aktiv — bitte versuchen Sie es in ein paar Minuten erneut.";

const STATUS = {
  IDLE: "idle",
  RECORDING: "recording",
  TRANSCRIBING: "transcribing",
  RECORDED: "recorded",
  FEEDBACK_LOADING: "feedback_loading",
  FEEDBACK_READY: "feedback_ready",
  ERROR: "error",
};

export default function RecordingPanel({ scenario, onAdvance, advanceLabel, onTranscriptReady, onFeedbackReady }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorIsInfo, setErrorIsInfo] = useState(false);
  const [referenceRevealed, setReferenceRevealed] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    setErrorMessage("");
    setErrorIsInfo(false);
    setFeedback(null);
    setTranscript("");
    setAudioUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus(STATUS.TRANSCRIBING);

        try {
          const body = new FormData();
          body.append("audio", blob, "recording.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body });
          if (!res.ok) throw new Error("Transcription request failed");
          const data = await res.json();
          setTranscript(data.transcript);
          setStatus(STATUS.RECORDED);
          onTranscriptReady?.(data.transcript);
        } catch (err) {
          setErrorMessage(
            "Transkription fehlgeschlagen. Bitte versuchen Sie es erneut."
          );
          setErrorIsInfo(false);
          setStatus(STATUS.ERROR);
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      setStatus(STATUS.RECORDING);
    } catch (err) {
      setErrorMessage("Mikrofonzugriff wurde verweigert oder ist nicht verfügbar.");
      setErrorIsInfo(false);
      setStatus(STATUS.ERROR);
    }
  }, [onTranscriptReady]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopStream();
  }, []);

  const getFeedback = useCallback(async () => {
    setStatus(STATUS.FEEDBACK_LOADING);
    setErrorMessage("");
    setErrorIsInfo(false);
    try {
      const result = await fetchWithRateLimitRetry("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, scenarioPrompt: scenario.prompt }),
      });

      if (!result.ok) {
        if (result.rateLimited) {
          setErrorMessage(RATE_LIMITED_MESSAGE);
          setErrorIsInfo(true);
        } else {
          setErrorMessage("Feedback konnte nicht geladen werden. Bitte versuchen Sie es erneut.");
          setErrorIsInfo(false);
        }
        setStatus(STATUS.RECORDED);
        return;
      }

      const data = result.data;
      setFeedback(data.feedback);
      setStatus(STATUS.FEEDBACK_READY);
      onFeedbackReady?.({ transcript, feedback: data.feedback });
    } catch (err) {
      setErrorMessage(
        "Feedback konnte nicht geladen werden. Bitte versuchen Sie es erneut."
      );
      setErrorIsInfo(false);
      setStatus(STATUS.RECORDED);
    }
  }, [transcript, scenario.prompt, onFeedbackReady]);

  const reset = () => {
    setStatus(STATUS.IDLE);
    setTranscript("");
    setAudioUrl(null);
    setFeedback(null);
    setErrorMessage("");
    setErrorIsInfo(false);
    setReferenceRevealed(false);
  };

  const handleStartClick = () => {
    setReferenceRevealed(false);
    startRecording();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {status === STATUS.IDLE && scenario.referenceAnswer && !referenceRevealed && (
        <button
          className="btn btn-secondary"
          onClick={() => setReferenceRevealed(true)}
          style={{ alignSelf: "flex-start" }}
        >
          So würde ein Muttersprachler antworten
        </button>
      )}

      {status === STATUS.IDLE && referenceRevealed && (
        <div
          className="card fade-in"
          style={{ borderLeft: "3px solid var(--accent-reference)", background: "var(--background)" }}
        >
          <h3
            style={{
              fontSize: "0.95rem",
              color: "var(--accent-reference)",
              marginBottom: "0.5rem",
            }}
          >
            So würde ein Muttersprachler antworten
          </h3>
          <p style={{ fontStyle: "italic", whiteSpace: "pre-wrap" }}>
            {scenario.referenceAnswer}
          </p>
        </div>
      )}

      {status === STATUS.IDLE && (
        <button className="btn" onClick={handleStartClick} style={{ alignSelf: "flex-start" }}>
          {referenceRevealed ? "Bereit? Jetzt aufnehmen" : "● Aufnahme starten"}
        </button>
      )}

      {status === STATUS.RECORDING && (
        <button
          className="btn"
          onClick={stopRecording}
          style={{ alignSelf: "flex-start", background: "#a34a3f", color: "#fff" }}
        >
          ■ Aufnahme beenden
        </button>
      )}

      {status === STATUS.RECORDING && (
        <p className="fade-in" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Aufnahme läuft … sprechen Sie jetzt.
        </p>
      )}

      {status === STATUS.TRANSCRIBING && (
        <p className="fade-in" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Transkription läuft …
        </p>
      )}

      {audioUrl && <audio controls src={audioUrl} style={{ width: "100%" }} />}

      {transcript && (
        <div className="card fade-in">
          <h3
            style={{
              fontSize: "0.95rem",
              color: "var(--muted)",
              marginBottom: "0.5rem",
            }}
          >
            Transkript
          </h3>
          <p>{transcript}</p>
        </div>
      )}

      {status === STATUS.RECORDED && transcript && !onTranscriptReady && (
        <button className="btn" onClick={getFeedback} style={{ alignSelf: "flex-start" }}>
          Feedback erhalten
        </button>
      )}

      {status === STATUS.FEEDBACK_LOADING && (
        <p className="fade-in" style={{ color: "var(--muted)" }}>Feedback wird erstellt …</p>
      )}

      {feedback && <FeedbackDisplay feedback={feedback} />}

      {errorMessage && (
        <p className={`fade-in ${errorIsInfo ? "form-info" : "form-error"}`}>{errorMessage}</p>
      )}

      {status === STATUS.RECORDED && !onTranscriptReady && (
        <button className="btn btn-secondary" onClick={reset} style={{ alignSelf: "flex-start" }}>
          Neue Aufnahme
        </button>
      )}

      {status === STATUS.FEEDBACK_READY && (
        onAdvance ? (
          <button className="btn" onClick={onAdvance} style={{ alignSelf: "flex-start" }}>
            {advanceLabel ?? "Nächste Frage"}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={reset} style={{ alignSelf: "flex-start" }}>
            Neue Aufnahme
          </button>
        )
      )}
    </div>
  );
}
