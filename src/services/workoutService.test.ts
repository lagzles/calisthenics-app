import { beforeEach, describe, expect, it } from 'vitest'
import { clearSessions } from '../features/workouts/data/workoutRepository'
import { completeSet, finishWorkout, pauseWorkout, tick } from '../features/workouts/domain/workoutEngine'
import {
  getActiveSession,
  getSessionById,
  getSessionHistory,
  getWorkoutById,
  loadWorkoutMode,
  persistSession,
  recoverWorkoutSession,
  startWorkoutSession,
} from './workoutService'

const T0 = Date.parse('2026-01-01T08:00:00.000Z')
const at = (seconds: number): number => T0 + seconds * 1000

describe('workoutService — sessões', () => {
  beforeEach(async () => {
    await clearSessions()
  })

  it('inicia e persiste uma sessão do treino A', async () => {
    const { session } = await startWorkoutSession('A', { now: T0, id: 'session-1' })

    expect(session.workoutId).toBe('A')
    expect(session.status).toBe('active')

    const active = await getActiveSession()
    expect(active?.id).toBe('session-1')
    expect(await getSessionById('session-1')).toEqual(session)
  })

  it('falha ao iniciar um treino inexistente', async () => {
    await expect(startWorkoutSession('inexistente')).rejects.toThrow()
  })

  it('retorna null quando não há sessão em andamento', async () => {
    expect(await recoverWorkoutSession(at(0))).toBeNull()
  })

  it('recupera e reconcilia uma sessão cujo descanso terminou com o app fechado', async () => {
    const workout = getWorkoutById('A')!
    const started = await startWorkoutSession('A', { now: T0, id: 'session-recover' })

    // Conclui a 1ª série (por tempo, encerrada manualmente) e entra em descanso
    // de 30s (termina em 31s).
    const afterSet = completeSet(started.session, workout, at(1)).session
    expect(afterSet.currentPhase).toBe('rest')
    await persistSession(afterSet)

    // App fechado; reabre em 70s: o descanso já terminou → série 2 em execução.
    const recovered = await recoverWorkoutSession(at(70))
    expect(recovered?.session.currentSet).toBe(2)
    expect(recovered?.session.currentPhase).toBe('work')

    // A reconciliação foi persistida.
    expect((await getSessionById('session-recover'))?.currentSet).toBe(2)
  })

  it('mantém o tempo congelado ao recuperar uma sessão pausada', async () => {
    const workout = getWorkoutById('A')!
    const started = await startWorkoutSession('A', { now: T0, id: 'session-paused' })

    const afterSet = completeSet(started.session, workout, at(1)).session
    const at5 = tick(afterSet, workout, at(5)).session
    const paused = pauseWorkout(at5, at(5)).session
    expect(paused.remainingTime).toBe(26)
    await persistSession(paused)

    const recovered = await recoverWorkoutSession(at(9_999))
    expect(recovered?.session.status).toBe('paused')
    expect(recovered?.session.remainingTime).toBe(26)
  })

  it('lista sessões concluídas no histórico', async () => {
    const started = await startWorkoutSession('A', { now: T0, id: 'session-history' })
    const finished = finishWorkout(started.session, at(300)).session
    await persistSession(finished)

    const history = await getSessionHistory()
    expect(history.map((session) => session.id)).toContain('session-history')
    expect(history[0].status).toBe('completed')
  })
})

describe('workoutService — preparação do Workout Mode', () => {
  beforeEach(async () => {
    await clearSessions()
  })

  it('sem sessão ativa, devolve o estado de preparação SEM criar sessão', async () => {
    const load = await loadWorkoutMode('A')

    expect(load.status).toBe('prepare')
    if (load.status !== 'prepare') throw new Error('esperado prepare')
    expect(load.workout.id).toBe('A')
    // O cronômetro não inicia sozinho: nenhuma sessão foi criada.
    expect(await getActiveSession()).toBeNull()
  })

  it('devolve "missing" para um treino inexistente', async () => {
    expect((await loadWorkoutMode('Z')).status).toBe('missing')
  })

  it('recupera uma sessão em andamento em vez de preparar uma nova', async () => {
    await startWorkoutSession('A', { now: T0, id: 'em-andamento' })

    const load = await loadWorkoutMode('B')

    expect(load.status).toBe('ready')
    if (load.status !== 'ready') throw new Error('esperado ready')
    expect(load.session.id).toBe('em-andamento')
    expect(load.session.workoutId).toBe('A')
  })

  it('inicia o cronômetro de 40s somente após o início explícito', async () => {
    const load = await loadWorkoutMode('A')
    expect(load.status).toBe('prepare')

    const { session } = await startWorkoutSession('A', { now: T0 })

    expect(session.currentPhase).toBe('work')
    expect(session.currentSet).toBe(1)
    expect(session.phaseEndsAt).toBe(new Date(T0 + 40_000).toISOString())
  })
})
