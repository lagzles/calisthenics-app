import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createWakeLockController,
  getWakeLockApi,
  hasSecureContext,
  isDocumentVisible,
  isWakeLockSupported,
  shouldHoldWakeLock,
  shouldReacquire,
  wakeLockWarning,
  type WakeLockApiLike,
  type WakeLockLogEvent,
  type WakeLockSentinelLike,
} from './wakeLock'

interface FakeSentinel {
  sentinel: WakeLockSentinelLike
  revoke: () => void
}

function createSentinel(): FakeSentinel {
  const listeners: Array<() => void> = []
  const emit = () => listeners.forEach((listener) => listener())
  const sentinel: WakeLockSentinelLike = {
    released: false,
    async release() {
      sentinel.released = true
      emit()
    },
    addEventListener(_type, listener) {
      listeners.push(listener)
    },
  }
  return {
    sentinel,
    revoke() {
      sentinel.released = true
      emit()
    },
  }
}

function createApi(behaviour: 'grant' | 'reject' = 'grant') {
  const created: FakeSentinel[] = []
  const requested: string[] = []
  const request = vi.fn((type: 'screen') => {
    requested.push(type)
    if (behaviour === 'reject') return Promise.reject(new Error('negado'))
    const entry = createSentinel()
    created.push(entry)
    return Promise.resolve(entry.sentinel)
  })
  return { api: { request } as WakeLockApiLike, request, created, requested }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createWakeLockController', () => {
  it('não é suportado quando a API está ausente', async () => {
    const controller = createWakeLockController(null)
    expect(controller.supported).toBe(false)
    expect(await controller.request()).toBe(false)
    expect(controller.isActive()).toBe(false)
  })

  it('solicita o bloqueio de tela ao iniciar', async () => {
    const { api, request, requested } = createApi()
    const controller = createWakeLockController(api)

    expect(controller.supported).toBe(true)
    expect(await controller.request()).toBe(true)
    expect(controller.isActive()).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
    expect(requested).toEqual(['screen'])
  })

  it('não solicita novamente enquanto o bloqueio está ativo', async () => {
    const { api, request } = createApi()
    const controller = createWakeLockController(api)

    await controller.request()
    await controller.request()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('libera o bloqueio ao pausar', async () => {
    const { api, created } = createApi()
    const controller = createWakeLockController(api)

    await controller.request()
    const first = created[0].sentinel
    await controller.release()

    expect(controller.isActive()).toBe(false)
    expect(first.released).toBe(true)
  })

  it('solicita novamente ao retomar após liberar', async () => {
    const { api, request } = createApi()
    const controller = createWakeLockController(api)

    await controller.request()
    await controller.release()
    expect(await controller.request()).toBe(true)
    expect(request).toHaveBeenCalledTimes(2)
    expect(controller.isActive()).toBe(true)
  })

  it('permite nova solicitação após o bloqueio ser revogado (volta ao primeiro plano)', async () => {
    const { api, request, created } = createApi()
    const controller = createWakeLockController(api)

    await controller.request()
    created[0].revoke()
    expect(controller.isActive()).toBe(false)

    expect(await controller.request()).toBe(true)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('trata a recusa do navegador sem lançar', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api } = createApi('reject')
    const controller = createWakeLockController(api)

    expect(await controller.request()).toBe(false)
    expect(controller.isActive()).toBe(false)
  })

  it('notifica os assinantes ao conceder e ao revogar o bloqueio', async () => {
    const { api, created } = createApi()
    const controller = createWakeLockController(api)
    const states: boolean[] = []
    controller.subscribe((active) => states.push(active))

    await controller.request()
    created[0].revoke()

    expect(states).toEqual([true, false])
  })

  it('encerra a assinatura quando solicitado', async () => {
    const { api } = createApi()
    const controller = createWakeLockController(api)
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    unsubscribe()
    await controller.request()

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('detecção de contexto e suporte', () => {
  it('considera indisponível quando navigator não expõe wakeLock (contexto não seguro)', () => {
    vi.stubGlobal('navigator', {})
    expect(getWakeLockApi()).toBeNull()
    expect(isWakeLockSupported()).toBe(false)
  })

  it('detecta a API quando o navegador a expõe', () => {
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn() } })
    expect(getWakeLockApi()).not.toBeNull()
    expect(isWakeLockSupported()).toBe(true)
  })

  it('sinaliza a ausência de contexto seguro', () => {
    vi.stubGlobal('window', { isSecureContext: false })
    expect(hasSecureContext()).toBe(false)

    vi.stubGlobal('window', { isSecureContext: true })
    expect(hasSecureContext()).toBe(true)
  })

  it('assume contexto seguro quando não há window (SSR/testes)', () => {
    vi.stubGlobal('window', undefined)
    expect(hasSecureContext()).toBe(true)
  })
})

describe('shouldReacquire (volta ao primeiro plano)', () => {
  it('reativa quando a sessão está ativa, há suporte e a página está visível', () => {
    expect(shouldReacquire(true, true, 'visible')).toBe(true)
  })

  it('não reativa quando a página está oculta', () => {
    expect(shouldReacquire(true, true, 'hidden')).toBe(false)
  })

  it('não reativa quando a sessão está pausada', () => {
    expect(shouldReacquire(false, true, 'visible')).toBe(false)
  })

  it('não reativa quando a API não é suportada', () => {
    expect(shouldReacquire(true, false, 'visible')).toBe(false)
  })
})

describe('wakeLockWarning (aviso na interface)', () => {
  it('não avisa quando o bloqueio está ativo', () => {
    expect(wakeLockWarning({ status: 'active', secureContext: true })).toBeNull()
  })

  it('não avisa quando o bloqueio está apenas inativo (pausa esperada)', () => {
    expect(wakeLockWarning({ status: 'inactive', secureContext: true })).toBeNull()
  })

  it('avisa sobre suporte do navegador quando indisponível em contexto seguro', () => {
    expect(wakeLockWarning({ status: 'unsupported', secureContext: true })).toMatch(
      /suporte do navegador/,
    )
  })

  it('avisa sobre HTTPS quando o contexto não é seguro', () => {
    expect(wakeLockWarning({ status: 'unsupported', secureContext: false })).toMatch(/HTTPS/)
  })

  it('avisa sobre permissões quando a solicitação falha', () => {
    expect(wakeLockWarning({ status: 'error', secureContext: true })).toMatch(/permissões/)
  })
})

describe('shouldHoldWakeLock (estado geral da sessão)', () => {
  it('mantém a tela acesa enquanto a sessão está ativa', () => {
    expect(shouldHoldWakeLock('active')).toBe(true)
  })

  it('não mantém quando a sessão está pausada, concluída ou abandonada', () => {
    expect(shouldHoldWakeLock('paused')).toBe(false)
    expect(shouldHoldWakeLock('completed')).toBe(false)
    expect(shouldHoldWakeLock('abandoned')).toBe(false)
  })
})

describe('isDocumentVisible', () => {
  it('assume visível quando não há document (SSR/testes)', () => {
    vi.stubGlobal('document', undefined)
    expect(isDocumentVisible()).toBe(true)
  })

  it('reflete a visibilidade do documento', () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' })
    expect(isDocumentVisible()).toBe(false)

    vi.stubGlobal('document', { visibilityState: 'visible' })
    expect(isDocumentVisible()).toBe(true)
  })
})

describe('createWakeLockController (recuperação e diagnóstico)', () => {
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

  it('re-solicita o bloqueio quando o navegador o revoga com a sessão ativa e a página visível', async () => {
    const { api, request, created } = createApi()
    const controller = createWakeLockController(api, { autoRecover: true, isVisible: () => true })

    await controller.request()
    created[0].revoke()
    await flush()

    expect(request).toHaveBeenCalledTimes(2)
    expect(controller.isActive()).toBe(true)
  })

  it('não re-solicita enquanto a página está oculta', async () => {
    const { api, request, created } = createApi()
    const controller = createWakeLockController(api, { autoRecover: true, isVisible: () => false })

    await controller.request()
    created[0].revoke()
    await flush()

    expect(request).toHaveBeenCalledTimes(1)
    expect(controller.isActive()).toBe(false)
  })

  it('não re-solicita depois que a sessão deixa de estar ativa', async () => {
    const { api, request, created } = createApi()
    const controller = createWakeLockController(api, { autoRecover: true, isVisible: () => true })

    await controller.request()
    await controller.release('inactive')
    created[0].revoke()
    await flush()

    expect(request).toHaveBeenCalledTimes(1)
    expect(controller.isActive()).toBe(false)
  })

  it('registra os eventos de diagnóstico (solicitar, conceder, liberar, revogar, recuperar)', async () => {
    const { api, created } = createApi()
    const events: WakeLockLogEvent[] = []
    const controller = createWakeLockController(api, {
      autoRecover: true,
      isVisible: () => true,
      log: (event) => events.push(event),
    })

    await controller.request()
    await controller.release('inactive')
    await controller.request()
    created[1].revoke()
    await flush()

    expect(events.map((event) => event.type)).toEqual([
      'request',
      'granted',
      'released',
      'request',
      'granted',
      'revoked',
      'reacquired',
      'request',
      'granted',
    ])
  })
})
