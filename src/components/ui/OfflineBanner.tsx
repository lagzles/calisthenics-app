import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { WifiOffIcon } from './icons'
import styles from './OfflineBanner.module.css'

/**
 * Aviso discreto exibido quando o dispositivo está sem conexão.
 * O app continua utilizável offline (Service Worker).
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className={styles.banner} role="status">
      <WifiOffIcon size={16} />
      <span>Você está offline — o app continua funcionando.</span>
    </div>
  )
}
