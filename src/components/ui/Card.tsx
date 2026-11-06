import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './Card.module.css'

type CardVariant = 'default' | 'accent'

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant
  children: ReactNode
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <section className={cx(styles.card, styles[variant], className)} {...props}>
      {children}
    </section>
  )
}
