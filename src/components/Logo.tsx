type Props = { size?: number; className?: string };

export default function Logo({ size = 28, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label="Adams X API Vault"
      role="img"
    >
      <defs>
        <linearGradient id="vault-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0.65)" />
        </linearGradient>
      </defs>
      <path
        d="M32 3L7 12v18c0 14.5 10.5 26.8 25 31 14.5-4.2 25-16.5 25-31V12L32 3z"
        fill="hsl(var(--background))"
        stroke="url(#vault-shield)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="22" y="30" width="20" height="16" rx="2.5" fill="hsl(var(--primary))" />
      <path
        d="M26 30v-4a6 6 0 0112 0v4"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="37" r="2.2" fill="hsl(var(--background))" />
      <rect x="30.8" y="38.5" width="2.4" height="4" rx="1" fill="hsl(var(--background))" />
    </svg>
  );
}
