import { Outlet } from 'react-router-dom'
import { BottomNav } from '../navigation/BottomNav'
import { OfflineBanner } from '../ui/OfflineBanner'
import styles from './AppLayout.module.css'

/**
 * Estrutura base das telas com navegação principal (Início, Treinos, Histórico).
 * O modo de execução do treino será uma interface independente, fora deste layout.
 */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <OfflineBanner />
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
