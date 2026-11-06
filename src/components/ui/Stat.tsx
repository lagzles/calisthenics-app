import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './Stat.module.css'

interface StatProps {
  label: string
  value: ReactNode
  hint?: string
  className?: string
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div className={cx(styles.stat, className)}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
