"use client";

export default function ThemeToggle() {
  const toggle = () => {
    const current =
      document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (err) {
      // localStorage unavailable (private browsing etc.) — theme just won't persist.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label="Farbschema wechseln"
    >
      <span className="theme-icon-sun" aria-hidden="true">
        ☀️
      </span>
      <span className="theme-icon-moon" aria-hidden="true">
        🌙
      </span>
    </button>
  );
}
