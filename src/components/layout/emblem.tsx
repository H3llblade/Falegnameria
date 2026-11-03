/** Emblema originale della bottega: sega e martello incrociati in un cartiglio */
export function Emblem({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="emb-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2c58a" />
          <stop offset=".5" stopColor="#b18a4c" />
          <stop offset="1" stopColor="#7f6034" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#emb-brass)" stroke="#29231c" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="25.5" fill="#35251b" stroke="#29231c" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#b18a4c" strokeWidth=".6" strokeDasharray="1.2 1.6" />
      {/* sega a mano */}
      <g transform="rotate(-38 32 32)">
        <path d="M14 29h30l4 2.2-4 2.2H14z" fill="#d9cdb4" stroke="#29231c" strokeWidth=".6" />
        <path d="M14 33.4l1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6" fill="none" stroke="#29231c" strokeWidth=".6" />
        <rect x="6" y="27.5" width="9" height="7.5" rx="2" fill="#8d6947" stroke="#29231c" strokeWidth=".7" />
        <ellipse cx="10.4" cy="31.2" rx="2.2" ry="1.6" fill="#35251b" />
      </g>
      {/* martello */}
      <g transform="rotate(40 32 32)">
        <rect x="30.6" y="16" width="2.8" height="32" rx="1" fill="#8d6947" stroke="#29231c" strokeWidth=".7" />
        <path d="M24 13h16v5.5H24z" fill="#b8b2a4" stroke="#29231c" strokeWidth=".7" />
        <path d="M40 13l4-2v9.5l-4-2z" fill="#9c968a" stroke="#29231c" strokeWidth=".6" />
      </g>
      <text x="32" y="56" textAnchor="middle" fontSize="5.2" fill="#d2b073" fontFamily="Georgia, serif" letterSpacing=".6">
        1900
      </text>
    </svg>
  );
}
