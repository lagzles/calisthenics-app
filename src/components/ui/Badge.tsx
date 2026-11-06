import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './Badge.module.css'

type BadgeVariant = 'primary' | 'rest' | 'neutral'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return <span className={cx(styles.badge, styles[variant], className)}>{children}</span>
}
