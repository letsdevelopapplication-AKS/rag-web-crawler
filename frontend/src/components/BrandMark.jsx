// Small abstract node-cluster icon used wherever the app needs a brand
// mark (auth pages, dashboard header) — deliberately not a brain/anatomy
// glyph, consistent with the node-and-connection "AI" visual language.
export default function BrandMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <g stroke="url(#brandGrad)" strokeWidth="1.4" fill="none">
        <line x1="14" y1="6" x2="6" y2="16" />
        <line x1="14" y1="6" x2="22" y2="16" />
        <line x1="6" y1="16" x2="14" y2="23" />
        <line x1="22" y1="16" x2="14" y2="23" />
        <line x1="6" y1="16" x2="22" y2="16" />
      </g>
      <g fill="url(#brandGrad)">
        <circle cx="14" cy="6" r="3" />
        <circle cx="6" cy="16" r="2.6" />
        <circle cx="22" cy="16" r="2.6" />
        <circle cx="14" cy="23" r="2.6" />
      </g>
    </svg>
  )
}
