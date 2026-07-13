"use client";

import { useId } from "react";

export function LatticePattern({ color = "var(--accent-grammar)", opacity = 0.12 }) {
  const id = `natiq-lattice-${useId()}`;
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        color,
        opacity,
      }}
    >
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <rect x="4" y="4" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" />
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            transform="rotate(45 24 24)"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export default function Logo({ variant = "compact" }) {
  const isHero = variant === "hero";

  const wordmark = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isHero ? "0.5rem" : "0.25rem",
        animation: isHero ? undefined : "logo-in 400ms ease-out",
      }}
    >
      <span
        lang="ar"
        dir="rtl"
        style={{
          fontFamily: "var(--font-arabic)",
          fontWeight: 700,
          fontSize: isHero ? "4rem" : "2.4rem",
          color: "var(--foreground)",
          lineHeight: 1,
        }}
      >
        ناطق
      </span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
          fontSize: isHero ? "1rem" : "0.85rem",
          letterSpacing: "0.35em",
          color: "var(--muted)",
        }}
      >
        NATIQ
      </span>
    </div>
  );

  if (!isHero) {
    return wordmark;
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3.5rem 2rem",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        background: "var(--surface-accent)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <LatticePattern />
      <div style={{ position: "relative", zIndex: 1 }}>{wordmark}</div>
    </div>
  );
}
