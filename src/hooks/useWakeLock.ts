import { useEffect, useState } from 'react'
import {
  createWakeLockController,
  hasSecureContext,
  isDocumentVisible,
  shouldReacquire,
  type WakeLockEventLogger,
  type WakeLockState,
  type WakeLockStatus,
} from './wakeLock'

/**
 * Mantém a tela do dispositivo acesa enquanto `enabled` for `true`.
 *
 * Regras (UI/UX §9):
 * - Solicita o bloqueio ao ativar e libera ao desativar (ex.: pausar o treino).
 * - Mantém o bloqueio durante toda a sessão ativa, independentemente da fase do
 *   exercício: exercício, descanso e transições não liberam o bloqueio.
 * - Recupera o bloqueio automaticamente quando o navegador o revoga, desde que a
 *   sessão continue ativa e a página esteja visível.
 * - Reativa ao voltar ao primeiro plano, caso a sessão ainda esteja ativa.
 * - Detecta a revogação do bloqueio pelo navegador (`subscribe`).
 * - Nunca lança: se não houver suporte (ou o contexto não for seguro), o treino
 *   continua normalmente e a interface apresenta um aviso discreto.
 *
 * `enabled` deve depender **apenas do estado geral da sessão**
 * (`status === 'active'`), nunca de `currentPhase` nem de valores que mudam a
 * cada segundo.
 *
 * Devolve um estado observável (`active` · `inactive` · `unsupported` · `error`)
 * — nunca um falso sucesso quando o bloqueio não foi concedido.
 */
export function useWakeLock(enabled: boolean): WakeLockState {
  const [controller] = useState(() =>
    createWakeLockController(undefined, {
      autoRecover: true,
      isVisible: isDocumentVisible,
      log: logWakeLockEvent,
    }),
  )
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  const secureContext = hasSecureContext()

  // Observa concessão, liberação e revogação (evento `release` do navegador).
  useEffect(() => {
    if (!controller.supported) return
    return controller.subscribe(setActive)
  }, [controller])

  useEffect(() => {
    if (!controller.supported) return

    let cancelled = false

    if (enabled) {
      void controller.request().then((granted) => {
        if (cancelled) return
        setActive(granted)
        setFailed(!granted)
      })
    } else {
      void controller.release('inactive').then(() => {
        if (cancelled) return
        setActive(false)
        setFailed(false)
      })
    }

    return () => {
      cancelled = true
    }
  }, [enabled, controller])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      logWakeLockEvent({ type: 'visibility', state: document.visibilityState })
      if (!shouldReacquire(enabled, controller.supported, document.visibilityState)) return
      void controller.request().then((granted) => {
        setActive(granted)
        setFailed(!granted)
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, controller])

  useEffect(() => () => void controller.release('unmount'), [controller])

  const status: WakeLockStatus = !controller.supported
    ? 'unsupported'
    : failed
      ? 'error'
      : active
        ? 'active'
        : 'inactive'

  return { status, secureContext }
}

/**
 * Emite os eventos do Wake Lock no console apenas em desenvolvimento, para
 * diagnosticar em que momento o bloqueio é liberado. Em produção, o Vite
 * substitui `import.meta.env.DEV` por `false` e nada é registrado.
 */
const logWakeLockEvent: WakeLockEventLogger = (event) => {
  if (!import.meta.env.DEV) return
  console.debug('[wake-lock]', event.type, event)
}
