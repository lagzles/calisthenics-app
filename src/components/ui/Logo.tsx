interface LogoMarkProps {
  size?: number
}

/**
 * Marca do aplicativo: quadrado arredondado em verde com halter escuro.
 * SVG inline — não depende de assets externos (funciona offline).
 */
export function LogoMark({ size = 44 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Calisthenics App"
      focusable="false"
    >
      <defs>
        <linearGradient id="calisthenics-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#35e77a" />
          <stop offset="1" stopColor="#12a94b" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#calisthenics-logo-gradient)" />
      <g stroke="#04160b" strokeWidth="3.4" strokeLinecap="round">
        <path d="M16 16.5v15M12.2 19v9M32 16.5v15M35.8 19v9M16 24h16" />
      </g>
    </svg>
  )
}
