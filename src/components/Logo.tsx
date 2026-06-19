// The Claudio mark: a soft rounded tile with an open "C" ring, drawn in the brand
// gradient. Pure SVG so it scales crisply for the home header and the splash.

export function Logo({ size = 32, rounded = true }: { size?: number; rounded?: boolean }) {
  const r = rounded ? 22 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden role="img" style={{ display: "block" }}>
      <defs>
        <linearGradient id="claudio-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx={r} fill="url(#claudio-grad)" />
      {/* Open "C" ring */}
      <path
        d="M70 31 A24 24 0 1 0 70 69"
        stroke="#fff"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
