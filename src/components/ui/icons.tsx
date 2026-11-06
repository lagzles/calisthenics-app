import type { SVGProps } from 'react'

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.6 12 3.8l8.5 6.8" />
      <path d="M5.7 9.7V19a1.4 1.4 0 0 0 1.4 1.4h9.8a1.4 1.4 0 0 0 1.4-1.4V9.7" />
      <path d="M9.7 20.4v-5.1h4.6v5.1" />
    </Svg>
  )
}

export function DumbbellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.6 6.6v10.8M3.6 9.2v5.6M17.4 6.6v10.8M20.4 9.2v5.6M6.6 12h10.8" />
    </Svg>
  )
}

export function HistoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.6a8.4 8.4 0 1 1-8.3 7.1" />
      <path d="M3.5 4.4v4.1h4.1" />
      <path d="M12 7.6V12l3.1 1.9" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3 1.8" />
    </Svg>
  )
}

export function LayersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.6 3.6 8 12 12.4 20.4 8 12 3.6Z" />
      <path d="M3.6 12.5 12 16.9l8.4-4.4" />
      <path d="M3.6 16.6 12 21l8.4-4.4" />
    </Svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.6" y="5" width="16.8" height="15.4" rx="2.6" />
      <path d="M3.6 9.6h16.8M8.2 3.4v3.2M15.8 3.4v3.2" />
    </Svg>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.4c2.9 2.8 4.8 5.3 4.8 8.2a4.8 4.8 0 0 1-9.6 0c0-1.5.5-2.7 1.3-3.8.4 1 .9 1.7 1.8 2.2.2-2.5.7-4.6 1.7-6.6Z" />
    </Svg>
  )
}

export function TargetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.6 6 15.6 12l-6 6" />
    </Svg>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Svg>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5 9.8 17.3 19 6.7" />
    </Svg>
  )
}

export function WifiOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 2.8 21.2 21.2" />
      <path d="M5.2 11.6A10 10 0 0 1 8.1 10" />
      <path d="M12.6 8.1a10 10 0 0 1 6.2 2.1" />
      <path d="M8.5 15.4a5 5 0 0 1 5.7-1.1" />
      <path d="M12 18.6h.01" />
      <path d="M16.5 12.2a10 10 0 0 1 2.1 1.3" />
    </Svg>
  )
}

export function PlayIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8 5.4v13.2a1 1 0 0 0 1.53.85l10.2-6.6a1 1 0 0 0 0-1.7l-10.2-6.6A1 1 0 0 0 8 5.4Z" />
    </svg>
  )
}

export function PauseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  )
}

export function SkipForwardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 5.6v12.8l9.2-6.4L6 5.6Z" />
      <path d="M18.5 5.6v12.8" />
    </Svg>
  )
}

export function XIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
    </Svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.2 21 19.4H3L12 4.2Z" />
      <path d="M12 9.8v4.2" />
      <path d="M12 16.6h.01" />
    </Svg>
  )
}
