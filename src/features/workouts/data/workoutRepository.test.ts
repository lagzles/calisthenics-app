import { beforeEach, describe, expect, it } from 'vitest'
import type { WorkoutSession } from '../domain/types'
import {
  clearSessions,
  deleteSession,
  getActiveSession,
  getSession,
  listCompletedSessions,
  listSessions,
  saveSession,
} from './workoutRepository'

const START = Date.parse('2026-01-01T08:00:00.000Z')
const iso = (minutes: number): string => new Date(START + minutes * 60_000).toISOString()

function makeSession(
  overrides: Partial<WorkoutSession> & Pick<WorkoutSession, 'id'>,
): WorkoutSession {
  return {
    workoutId: 'A',
    workoutName: 'Corpo inteiro',
    status: 'active',
    startedAt: iso(0),
    pausedAt: null,
    finishedAt: null,
    currentExerciseIndex: 0,
    currentSet: 1,
    currentPhase: 'work',
    remainingTime: 30,
    phaseStartedAt: iso(0),
    phaseEndsAt: iso(1),
    totalPausedMs: 0,
    completedSets: 0,
    exercisesProgress: [],
    duration: 0,
    ...overrides,
  }
}

describe('workoutRepository (IndexedDB)', () => {
  beforeEach(async () => {
    await clearSessions()
  })

  it('salva e recupera uma sessão', async () => {
    const session = makeSession({ id: 's1', completedSets: 2 })
    await saveSession(session)

    const loaded = await getSession('s1')
    expect(loaded).toEqual(session)
  })

  it('retorna null para sessão inexistente', async () => {
    expect(await getSession('missing')).toBeNull()
  })

  it('atualiza uma sessão existente', async () => {
    await saveSession(makeSession({ id: 's1', completedSets: 0 }))
    await saveSession(makeSession({ id: 's1', completedSets: 5 }))

    const loaded = await getSession('s1')
    expect(loaded?.completedSets).toBe(5)
  })

  it('lista sessões da mais recente para a mais antiga', async () => {
    await saveSession(makeSession({ id: 'old', startedAt: iso(0) }))
    await saveSession(makeSession({ id: 'new', startedAt: iso(10) }))
    await saveSession(makeSession({ id: 'mid', startedAt: iso(5) }))

    const list = await listSessions()
    expect(list.map((session) => session.id)).toEqual(['new', 'mid', 'old'])
  })

  it('retorna a sessão em andamento mais recente (ativa ou pausada)', async () => {
    await saveSession(
      makeSession({ id: 'done', status: 'completed', startedAt: iso(0), finishedAt: iso(20) }),
    )
    await saveSession(makeSession({ id: 'paused', status: 'paused', startedAt: iso(5) }))
    await saveSession(makeSession({ id: 'active', status: 'active', startedAt: iso(9) }))

    const current = await getActiveSession()
    expect(current?.id).toBe('active')
  })

  it('não retorna sessão em andamento quando só há concluídas', async () => {
    await saveSession(makeSession({ id: 'done', status: 'completed', finishedAt: iso(20) }))
    expect(await getActiveSession()).toBeNull()
  })

  it('lista apenas as sessões concluídas, mais recentes primeiro', async () => {
    await saveSession(
      makeSession({ id: 'c1', status: 'completed', startedAt: iso(0), finishedAt: iso(10) }),
    )
    await saveSession(makeSession({ id: 'active', status: 'active', startedAt: iso(15) }))
    await saveSession(
      makeSession({ id: 'c2', status: 'completed', startedAt: iso(20), finishedAt: iso(30) }),
    )

    const completed = await listCompletedSessions()
    expect(completed.map((session) => session.id)).toEqual(['c2', 'c1'])
  })

  it('remove uma sessão', async () => {
    await saveSession(makeSession({ id: 's1' }))
    await deleteSession('s1')
    expect(await getSession('s1')).toBeNull()
  })
})
