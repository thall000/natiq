import { Source_Serif_4, Source_Sans_3, Aref_Ruqaa } from "next/font/google";
import Link from "next/link";
import Logo from "./components/Logo";
import ThemeToggle from "./components/ThemeToggle";
import "./globals.css";

// Runs before paint so a stored theme preference applies immediately, with no flash
// of the wrong theme. Falls back to the CSS prefers-color-scheme media query when
// nothing is stored yet.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (err) {}
})();
`;

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const arefRuqaa = Aref_Ruqaa({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: "700",
});

export const metadata = {
  title: "Natiq — Speaking Practice",
  description:
    "Practice confident spoken German for customer service job interviews.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${sourceSans.variable} ${arefRuqaa.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <header style={{ padding: "1.75rem 1.5rem 1.25rem" }}>
          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Link href="/" style={{ display: "inline-block" }}>
              <Logo variant="compact" />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
