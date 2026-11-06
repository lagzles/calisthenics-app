import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import { cx } from '../../utils/cx'
import { DumbbellIcon, HistoryIcon, HomeIcon } from '../ui/icons'
import type { IconProps } from '../ui/icons'
import styles from './BottomNav.module.css'

interface NavItem {
  to: string
  label: string
  Icon: ComponentType<IconProps>
  end?: boolean
}

const items: NavItem[] = [
  { to: '/', label: 'Início', Icon: HomeIcon, end: true },
  { to: '/treinos', label: 'Treinos', Icon: DumbbellIcon },
  { to: '/historico', label: 'Histórico', Icon: HistoryIcon },
]

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <ul className={styles.list}>
        {items.map(({ to, label, Icon, end }) => (
          <li key={to} className={styles.item}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cx(styles.link, isActive && styles.active)}
            >
              <span className={styles.icon}>
                <Icon size={22} />
              </span>
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
