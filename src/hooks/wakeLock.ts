/**
 * Controle da Screen Wake Lock API (`navigator.wakeLock`).
 *
 * Isolado da camada React para ser testável sem DOM: o controlador conhece
 * apenas a API do navegador e devolve um resultado booleano, nunca lançando.
 *
 * O bloqueio pertence à **sessão**, não à fase do exercício: enquanto a sessão
 * estiver ativa (exercício, descanso ou transição), ele deve permanecer retido.
 * Se o navegador revogar o bloqueio — por mudança de visibilidade, decisão do
 * SO ou qualquer outro motivo — e a sessão ainda o desejar com a página visível,
 * o controlador **re-solicita** (`autoRecover`). Sem isso, um único `release`
 * disparado pelo navegador deixaria a tela sem proteção até o fim da sessão.
 *
 * A API exige **contexto seguro** (HTTPS ou localhost). Em HTTP puro — inclusive
 * pelo IP local da máquina — `navigator.wakeLock` não é exposto pelo navegador,
 * então o bloqueio é considerado indisponível (`unsupported`).
 */

import type { WorkoutSessionStatus } from '../features/workouts/domain/types'

export interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockApiLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

/** Motivo pelo qual liberamos o bloqueio deliberadamente. */
export type WakeLockReleaseReason = 'inactive' | 'unmount'

/**
 * Eventos de diagnóstico do Wake Lock. Permitem identificar exatamente quando o
 * bloqueio é solicitado, concedido, recusado, liberado (e por quê) ou revogado
 * pelo navegador — sem depender de logs espalhados pelo código.
 */
export type WakeLockLogEvent =
  | { type: 'request' }
  | { type: 'granted' }
  | { type: 'denied'; error: unknown }
  | { type: 'released'; reason: WakeLockReleaseReason }
  | { type: 'revoked' }
  | { type: 'reacquired' }
  | { type: 'visibility'; state: DocumentVisibilityState }

/** Destino dos eventos de diagnóstico. Por padrão, não faz nada. */
export type WakeLockEventLogger = (event: WakeLockLogEvent) => void

export interface WakeLockController {
  /** Indica se o navegador oferece a API. */
  readonly supported: boolean
  /** Solicita o bloqueio. Devolve `true` se concedido. */
  request(): Promise<boolean>
  /** Libera o bloqueio, se houver. */
  release(reason?: WakeLockReleaseReason): Promise<void>
  /** Indica se o bloqueio está ativo no momento. */
  isActive(): boolean
  /**
   * Observa mudanças no bloqueio (concedido, liberado por nós, revogado pelo
   * navegador). Devolve a função para cancelar a assinatura.
   */
  subscribe(listener: (active: boolean) => void): () => void
}

export interface WakeLockControllerOptions {
  /**
   * Re-solicita o bloqueio quando o navegador o revoga enquanto ainda o
   * desejamos e a página segue visível. Fecha a lacuna em que o bloqueio era
   * perdido de forma silenciosa no meio da sessão.
   */
  autoRecover?: boolean
  /** Visibilidade atual do documento (padrão: lê `document`). */
  isVisible?: () => boolean
  /** Instrumentação de diagnóstico (padrão: no-op). */
  log?: WakeLockEventLogger
}

/** Estado observável do bloqueio de tela. */
export type WakeLockStatus = 'active' | 'inactive' | 'unsupported' | 'error'

export interface WakeLockState {
  /** Situação atual do bloqueio. */
  status: WakeLockStatus
  /**
   * `false` quando a página não está em contexto seguro. A API exige HTTPS ou
   * localhost; em HTTP puro por IP a ausência de contexto é a causa raiz.
   */
  secureContext: boolean
}

const SCREEN = 'screen' as const

/** Lê a API do navegador, se disponível. */
export function getWakeLockApi(): WakeLockApiLike | null {
  if (typeof navigator === 'undefined') return null
  const api = (navigator as Navigator & { wakeLock?: WakeLockApiLike }).wakeLock
  return api && typeof api.request === 'function' ? api : null
}

export function isWakeLockSupported(): boolean {
  return getWakeLockApi() !== null
}

/**
 * Indica se a página está em contexto seguro (`window.isSecureContext`).
 * Sem janela (SSR/testes em Node), assume `true` para não gerar falso aviso.
 */
export function hasSecureContext(): boolean {
  if (typeof window === 'undefined') return true
  return window.isSecureContext !== false
}

/**
 * Regra de produto (UI/UX §9): a tela permanece acesa enquanto existir uma
 * sessão efetivamente ativa e não pausada. **Não** depende da fase atual
 * (`work`/`rest`), do exercício, da série nem do tempo restante — valores que
 * mudam a cada transição não devem influenciar o bloqueio.
 */
export function shouldHoldWakeLock(status: WorkoutSessionStatus): boolean {
  return status === 'active'
}

/**
 * Decide se vale re-solicitar o bloqueio ao voltar ao primeiro plano. Puro e
 * testável: só quando a sessão está ativa, a API existe e a página está visível.
 */
export function shouldReacquire(
  enabled: boolean,
  supported: boolean,
  visibilityState: string,
): boolean {
  return enabled && supported && visibilityState === 'visible'
}

/** Visibilidade do documento, tolerante a ambientes sem `document`. */
export function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

/**
 * Aviso para a interface. Devolve `null` quando o bloqueio está ativo ou apenas
 * inativo de forma esperada (ex.: treino pausado). Nunca apresentamos sucesso
 * quando o bloqueio não foi concedido.
 */
export function wakeLockWarning(state: WakeLockState): string | null {
  switch (state.status) {
    case 'unsupported':
      return state.secureContext
        ? 'Não foi possível manter a tela ativa. Verifique o suporte do navegador.'
        : 'Não foi possível manter a tela ativa: a API exige HTTPS (ou localhost). Abra o app por um endereço seguro.'
    case 'error':
      return 'Não foi possível manter a tela ativa. Verifique as permissões do navegador.'
    case 'active':
    case 'inactive':
      return null
  }
}

export function createWakeLockController(
  api: WakeLockApiLike | null = getWakeLockApi(),
  options: WakeLockControllerOptions = {},
): WakeLockController {
  const { autoRecover = false, isVisible = isDocumentVisible, log = () => {} } = options

  // Referência única e consistente ao sentinel ativo.
  let sentinel: WakeLockSentinelLike | null = null
  // Solicitação em andamento: evita requisições duplicadas concorrentes.
  let pending: Promise<boolean> | null = null
  // Intenção atual: `true` enquanto a sessão deseja o bloqueio.
  let wanted = false
  const listeners = new Set<(active: boolean) => void>()

  const isActive = () => sentinel !== null && !sentinel.released

  const notify = () => {
    const active = isActive()
    listeners.forEach((listener) => listener(active))
  }

  const acquire = (): Promise<boolean> => {
    if (!api) return Promise.resolve(false)
    if (sentinel && !sentinel.released) return Promise.resolve(true)
    if (pending) return pending

    log({ type: 'request' })
    pending = api.request(SCREEN).then(
      (acquired) => {
        sentinel = acquired
        acquired.addEventListener('release', () => handleRelease(acquired))
        pending = null
        log({ type: 'granted' })
        notify()
        return true
      },
      (error: unknown) => {
        pending = null
        log({ type: 'denied', error })
        console.warn('[wake-lock] não foi possível manter a tela ativa:', error)
        return false
      },
    )

    return pending
  }

  /**
   * Trata a revogação pelo navegador (evento `release` do sentinel). Só age se o
   * sentinel revogado ainda for o atual — evita que uma liberação nossa, feita
   * antes de `await sentinel.release()`, seja interpretada como revogação.
   */
  const handleRelease = (target: WakeLockSentinelLike) => {
    if (sentinel !== target) return
    sentinel = null
    log({ type: 'revoked' })
    notify()

    if (autoRecover && wanted && isVisible()) {
      log({ type: 'reacquired' })
      void acquire()
    }
  }

  return {
    supported: api !== null,

    isActive,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    request() {
      wanted = true
      return acquire()
    },

    async release(reason: WakeLockReleaseReason = 'inactive') {
      wanted = false
      const current = sentinel
      sentinel = null
      if (!current) return
      log({ type: 'released', reason })
      notify()
      try {
        await current.release()
      } catch (error) {
        console.warn('[wake-lock] falha ao liberar a tela:', error)
      }
    },
  }
}
