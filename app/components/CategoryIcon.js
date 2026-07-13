const paths = {
  telekommunikation: (
    <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
  ),
  einzelhandel: (
    <>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  "reise-tourismus": <path d="M3 11l17-8-7 17-3-7-7-2z" />,
  gastgewerbe: (
    <>
      <path d="M4 18a8 8 0 0 1 16 0z" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="12" y1="6" x2="12" y2="4" />
    </>
  ),
  autovermietung: (
    <>
      <path d="M4 16l1.5-5a2 2 0 0 1 2-1.5h9a2 2 0 0 1 2 1.5L20 16" />
      <rect x="3" y="16" width="18" height="3" rx="1" />
      <circle cx="7.5" cy="19.5" r="1.3" />
      <circle cx="16.5" cy="19.5" r="1.3" />
    </>
  ),
};

export default function CategoryIcon({ id, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[id]}
    </svg>
  );
}
