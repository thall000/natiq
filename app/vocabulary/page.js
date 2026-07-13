"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vocabularySections } from "../vocabulary";
import { translations } from "../vocabulary-translations";

function TranslationPopover({ word }) {
  const t = translations[word];
  if (!t) return null;
  return (
    <div className="vocab-popover" onClick={(e) => e.stopPropagation()}>
      <p style={{ fontWeight: 600 }}>{word}</p>
      <p style={{ color: "var(--muted)" }}>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          EN{" "}
        </span>
        {t.en}
      </p>
      <p style={{ color: "var(--muted)" }} dir="rtl">
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }} dir="ltr">
          AR{" "}
        </span>
        {t.ar}
      </p>
    </div>
  );
}

function WordGroup({ sectionId, category, title, words, activeKey, onToggle }) {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3
        style={{
          fontSize: "0.85rem",
          color: "var(--muted)",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </h3>
      <div className="vocab-nav">
        {words.map((word, i) => {
          const key = `${sectionId}-${category}-${i}`;
          const isActive = activeKey === key;
          return (
            <div key={key} style={{ display: "contents" }}>
              <button
                type="button"
                className="vocab-chip"
                aria-expanded={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(isActive ? null : key);
                }}
              >
                {word}
              </button>
              {isActive && (
                <div style={{ flexBasis: "100%" }}>
                  <TranslationPopover word={word} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhraseGroup({ sectionId, phrases, activeKey, onToggle }) {
  return (
    <div className="card">
      <h3
        style={{
          fontSize: "0.85rem",
          color: "var(--muted)",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Phrasen
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {phrases.map((phrase, i) => {
          const key = `${sectionId}-phrasen-${i}`;
          const isActive = activeKey === key;
          return (
            <div key={key}>
              <button
                type="button"
                className="vocab-phrase"
                aria-expanded={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(isActive ? null : key);
                }}
              >
                „{phrase}&rdquo;
              </button>
              {isActive && <TranslationPopover word={phrase} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (!activeKey) return;
    const closePopover = () => setActiveKey(null);
    document.addEventListener("click", closePopover);
    return () => document.removeEventListener("click", closePopover);
  }, [activeKey]);

  return (
    <main className="page">
      <Link
        href="/"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zur Startseite
      </Link>

      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Customer Care Bible</h1>
        <p style={{ color: "var(--muted)" }}>
          Wortschatz für deutschsprachige Kundenservice-Gespräche — allgemeine Grundlagen
          und Begriffe je Branche. Tippen Sie auf ein Wort für die Übersetzung.
        </p>
      </header>

      <nav className="vocab-nav" style={{ marginBottom: "3rem" }}>
        {vocabularySections.map((section) => (
          <a key={section.id} href={`#${section.id}`} style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
            {section.title}
          </a>
        ))}
      </nav>

      {vocabularySections.map((section) => (
        <section key={section.id} id={section.id} className="vocab-section" style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1.25rem" }}>{section.title}</h2>
          <WordGroup
            sectionId={section.id}
            category="nomen"
            title="Nomen"
            words={section.nomen}
            activeKey={activeKey}
            onToggle={setActiveKey}
          />
          <WordGroup
            sectionId={section.id}
            category="verben"
            title="Verben"
            words={section.verben}
            activeKey={activeKey}
            onToggle={setActiveKey}
          />
          <WordGroup
            sectionId={section.id}
            category="adjektive"
            title="Adjektive"
            words={section.adjektive}
            activeKey={activeKey}
            onToggle={setActiveKey}
          />
          <PhraseGroup
            sectionId={section.id}
            phrases={section.phrasen}
            activeKey={activeKey}
            onToggle={setActiveKey}
          />
        </section>
      ))}
    </main>
  );
}
