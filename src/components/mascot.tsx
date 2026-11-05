/**
 * น้องคิว — SYSRENT's own mascot: a round orange tabby who peeks over
 * cards and waves. Pure SVG, decorative only.
 */
export function Mascot({ className, wave = true }: { className?: string; wave?: boolean }) {
  return (
    <svg viewBox="0 0 260 184" overflow="visible" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mq-fur" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffd9b3" />
          <stop offset="0.55" stopColor="#f7a45e" />
          <stop offset="1" stopColor="#e8782c" />
        </radialGradient>
        <radialGradient id="mq-cream" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fffaf3" />
          <stop offset="1" stopColor="#ffe6cc" />
        </radialGradient>
        <radialGradient id="mq-eye" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#6b3b1c" />
          <stop offset="1" stopColor="#2a170c" />
        </radialGradient>
      </defs>

      {/* ears */}
      <path d="M58 70 66 14c2-8 9-9 15-4l40 34Z" fill="url(#mq-fur)" />
      <path d="M202 70 194 14c-2-8-9-9-15-4l-40 34Z" fill="url(#mq-fur)" />
      <path d="M70 58 75 25l26 22Z" fill="#ffb7b0" />
      <path d="M190 58 185 25l-26 22Z" fill="#ffb7b0" />

      {/* head */}
      <ellipse cx="130" cy="98" rx="90" ry="72" fill="url(#mq-fur)" />
      {/* tabby stripes */}
      <path d="M118 30c2 10 2 17 0 24M130 28v28M142 30c-2 10-2 17 0 24" stroke="#d9600f" strokeWidth="6" strokeLinecap="round" opacity=".55" />
      <path d="M44 92h18M42 106h18M216 92h-18M218 106h-18" stroke="#d9600f" strokeWidth="5" strokeLinecap="round" opacity=".45" />
      {/* muzzle */}
      <ellipse cx="130" cy="122" rx="44" ry="32" fill="url(#mq-cream)" />

      {/* eyes */}
      <g style={{ transformOrigin: "130px 96px", animation: "blink 5s infinite" }}>
        <ellipse cx="96" cy="96" rx="14" ry="17" fill="url(#mq-eye)" />
        <ellipse cx="164" cy="96" rx="14" ry="17" fill="url(#mq-eye)" />
        <circle cx="91" cy="89" r="5.5" fill="#fff" />
        <circle cx="159" cy="89" r="5.5" fill="#fff" />
        <circle cx="101" cy="103" r="2.5" fill="#fff" opacity=".8" />
        <circle cx="169" cy="103" r="2.5" fill="#fff" opacity=".8" />
      </g>
      {/* blush */}
      <ellipse cx="76" cy="122" rx="13" ry="7" fill="#ff8f8f" opacity=".45" />
      <ellipse cx="184" cy="122" rx="13" ry="7" fill="#ff8f8f" opacity=".45" />
      {/* nose + mouth */}
      <path d="M124 112h12l-6 7Z" fill="#f2788a" />
      <path d="M118 124c5 6 12 5 12-2 0 7 7 8 12 2" fill="none" stroke="#3d2314" strokeWidth="3" strokeLinecap="round" />

      {/* collar with booking tag */}
      <path d="M78 158c30 10 74 10 104 0" stroke="#e05a4a" strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx="130" cy="166" r="11" fill="#ffd166" stroke="#e0a21a" strokeWidth="2" />
      <path d="m125 166 3.5 3.5 6.5-7" stroke="#8a5a00" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* paws resting on the card edge */}
      <g>
        <ellipse cx="62" cy="160" rx="24" ry="14" fill="url(#mq-cream)" />
        <path d="M54 156v8M62 155v9M70 156v8" stroke="#e3b48c" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g style={wave ? { transformOrigin: "205px 168px", animation: "wave 3.2s ease-in-out infinite" } : undefined}>
        <rect x="191" y="124" width="28" height="62" rx="14" fill="url(#mq-fur)" />
        <ellipse cx="205" cy="128" rx="16" ry="14" fill="url(#mq-cream)" />
        <ellipse cx="205" cy="131" rx="6" ry="5" fill="#ffaaa6" />
        <circle cx="196" cy="122" r="3" fill="#ffaaa6" />
        <circle cx="204" cy="119" r="3" fill="#ffaaa6" />
        <circle cx="212" cy="121" r="3" fill="#ffaaa6" />
      </g>
    </svg>
  );
}
