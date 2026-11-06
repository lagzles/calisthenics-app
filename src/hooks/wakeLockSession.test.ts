import { describe, expect, it, vi } from 'vitest'
import { workouts } from '../features/workouts/data/workouts.data'
import {
  abandonWorkout,
  advanceExercise,
  finishWorkout,
  goToPreviousExercise,
  pauseWorkout,
  resumeWorkout,
  skipRest,
  startWorkout,
  tick,
} from '../features/workouts/domain/workoutEngine'
import type { WorkoutSession } from '../features/workouts/domain/types'
import {
  createWakeLockController,
  shouldHoldWakeLock,
  type WakeLockApiLike,
  type WakeLockSentinelLike,
} from './wakeLock'

/**
 * Integração Wake Lock × sessão.
 *
 * Usa o Workout Engine real (puro, sem DOM) para produzir as transições de
 * exercício/descanso/série e verifica que o bloqueio de tela segue o **estado
 * geral da sessão** — e não a fase atual.
 */

const workout = workouts[0]
const T0 = Date.parse('2026-01-01T10:00:00.000Z')
const WORK_MS = (workout.exercises[0].workDuration ?? 0) * 1000
const REST_MS = workout.exercises[0].restDuration * 1000

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

function createHarness(isVisible: () => boolean = () => true) {
  const created: FakeSentinel[] = []
  const request = vi.fn(() => {
    const entry = createSentinel()
    created.push(entry)
    return Promise.resolve(entry.sentinel)
  })
  const controller = createWakeLockController({ request } as WakeLockApiLike, {
    autoRecover: true,
    isVisible,
  })

  // Reproduz o que o hook faz: sincroniza o bloqueio com o estado da sessão.
  const sync = (session: WorkoutSession) => {
    if (shouldHoldWakeLock(session.status)) void controller.request()
    else void controller.release('inactive')
  }

  return { controller, request, created, sync }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('Wake Lock durante a sessão', () => {
  it('solicita o bloqueio ao iniciar a sessão', async () => {
    const { session } = startWorkout(workout, { now: T0, id: 's1' })
    const h = createHarness()

    h.sync(session)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.controller.isActive()).toBe(true)
  })

  it('mantém o bloqueio na transição exercício → descanso', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    const resting = tick(started, workout, T0 + WORK_MS).session
    expect(resting.currentPhase).toBe('rest')
    expect(resting.status).toBe('active')

    h.sync(resting)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.controller.isActive()).toBe(true)
    expect(h.created[0].sentinel.released).toBe(false)
  })

  it('mantém o bloqueio na transição descanso → exercício', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const resting = tick(started, workout, T0 + WORK_MS).session
    const working = tick(resting, workout, T0 + WORK_MS + REST_MS).session
    expect(working.currentPhase).toBe('work')
    expect(working.currentSet).toBe(2)

    const h = createHarness()
    h.sync(started)
    await flush()
    h.sync(resting)
    await flush()
    h.sync(working)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.controller.isActive()).toBe(true)
  })

  it('mantém o bloqueio ao mudar de exercício', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    const next = advanceExercise(started, workout, T0 + WORK_MS).session
    expect(next.currentExerciseIndex).toBe(1)
    expect(next.status).toBe('active')

    h.sync(next)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.controller.isActive()).toBe(true)
  })

  it('mantém o bloqueio ao consultar um exercício anterior com a sessão ativa', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const advanced = advanceExercise(started, workout, T0 + WORK_MS).session
    const previous = goToPreviousExercise(advanced, workout, T0 + WORK_MS).session
    expect(previous.currentExerciseIndex).toBe(0)
    expect(previous.status).toBe('active')

    const h = createHarness()
    h.sync(started)
    await flush()
    h.sync(advanced)
    await flush()
    h.sync(previous)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.controller.isActive()).toBe(true)
  })

  it('não solicita o bloqueio de novo a cada mudança de fase', async () => {
    let session = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(session)
    await flush()

    session = tick(session, workout, T0 + WORK_MS).session // exercício → descanso
    h.sync(session)
    await flush()
    session = skipRest(session, workout, T0 + WORK_MS).session // pulou o descanso → próxima série
    h.sync(session)
    await flush()
    session = tick(session, workout, T0 + 2 * WORK_MS).session // série → descanso
    h.sync(session)
    await flush()
    session = advanceExercise(session, workout, T0 + 2 * WORK_MS).session // próximo exercício
    h.sync(session)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.controller.isActive()).toBe(true)
  })

  it('libera o bloqueio ao pausar', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    const paused = pauseWorkout(started, T0 + 5_000).session
    expect(paused.status).toBe('paused')
    h.sync(paused)
    await flush()

    expect(h.controller.isActive()).toBe(false)
    expect(h.created[0].sentinel.released).toBe(true)
  })

  it('solicita novamente o bloqueio ao retomar', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const paused = pauseWorkout(started, T0 + 5_000).session
    const resumed = resumeWorkout(paused, T0 + 10_000).session
    expect(resumed.status).toBe('active')

    const h = createHarness()
    h.sync(started)
    await flush()
    h.sync(paused)
    await flush()
    h.sync(resumed)
    await flush()

    expect(h.request).toHaveBeenCalledTimes(2)
    expect(h.controller.isActive()).toBe(true)
  })

  it('libera o bloqueio ao finalizar o treino', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    const finished = finishWorkout(started, T0 + 20_000).session
    expect(finished.status).toBe('completed')
    h.sync(finished)
    await flush()

    expect(h.controller.isActive()).toBe(false)
    expect(h.created[0].sentinel.released).toBe(true)
  })

  it('libera o bloqueio ao abandonar o treino', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    const abandoned = abandonWorkout(started, T0 + 20_000).session
    expect(abandoned.status).toBe('abandoned')
    h.sync(abandoned)
    await flush()

    expect(h.controller.isActive()).toBe(false)
    expect(h.created[0].sentinel.released).toBe(true)
  })

  it('libera o bloqueio ao desmontar definitivamente a sessão', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    await h.controller.release('unmount')

    expect(h.controller.isActive()).toBe(false)
    expect(h.created[0].sentinel.released).toBe(true)
  })

  it('recupera o bloqueio revogado pelo navegador durante a sessão ativa', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    const h = createHarness()
    h.sync(started)
    await flush()

    // O navegador revoga o bloqueio com a página ainda visível.
    h.created[0].revoke()
    await flush()

    expect(h.request).toHaveBeenCalledTimes(2)
    expect(h.controller.isActive()).toBe(true)
  })

  it('não recupera enquanto a página está oculta (volta ao primeiro plano depois)', async () => {
    const started = startWorkout(workout, { now: T0, id: 's1' }).session
    let visible = true
    const h = createHarness(() => visible)
    h.sync(started)
    await flush()

    visible = false
    h.created[0].revoke()
    await flush()
    expect(h.request).toHaveBeenCalledTimes(1)

    visible = true
    await h.controller.request()
    await flush()
    expect(h.request).toHaveBeenCalledTimes(2)
    expect(h.controller.isActive()).toBe(true)
  })
})
