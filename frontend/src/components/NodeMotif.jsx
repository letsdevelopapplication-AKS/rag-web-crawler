// Abstract neuron/synapse line-art used as a subtle background accent on
// auth-style pages (Register / Dashboard login). Intentionally not literal
// brain/anatomy clipart — node-and-connection line art is the established
// "AI" visual cue for clean B2B SaaS.
export default function NodeMotif({ className = '' }) {
  return (
    <svg
      className={`node-motif ${className}`}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <g stroke="url(#nodeGrad)" strokeWidth="1" fill="none">
        <line x1="40" y1="60" x2="160" y2="40" />
        <line x1="160" y1="40" x2="260" y2="100" />
        <line x1="260" y1="100" x2="360" y2="50" />
        <line x1="40" y1="60" x2="120" y2="160" />
        <line x1="120" y1="160" x2="260" y2="100" />
        <line x1="120" y1="160" x2="220" y2="240" />
        <line x1="220" y1="240" x2="340" y2="220" />
        <line x1="260" y1="100" x2="340" y2="220" />
      </g>
      <g fill="url(#nodeGrad)">
        <circle cx="40" cy="60" r="4" />
        <circle cx="160" cy="40" r="3" />
        <circle cx="260" cy="100" r="5" />
        <circle cx="360" cy="50" r="3" />
        <circle cx="120" cy="160" r="4" />
        <circle cx="220" cy="240" r="3" />
        <circle cx="340" cy="220" r="4" />
      </g>
    </svg>
  )
}
