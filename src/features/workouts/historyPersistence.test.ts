import { beforeEach, describe, expect, it } from 'vitest'
import { workouts } from './data/workouts.data'
import {
  clearSessions,
  closeDatabase,
  getSession,
  listCompletedSessions,
  saveSession,
} from './data/workoutRepository'
import type { WorkoutSession } from './domain/types'
import {
  abandonWorkout,
  advanceExercise,
  finishWorkout,
  pauseWorkout,
  startWorkout,
  tick,
} from './domain/workoutEngine'
import {
  buildHistoryIndicators,
  countSessionsInMonth,
  groupSessionsByDate,
  sessionDateKey,
  toLocalDateKey,
} from './historyCalendar'

const workout = workouts[0]

function localMs(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

/**
 * Executa o treino inteiro pelo motor (tick + avanço de exercício), como o
 * Workout Mode faria, até a sessão ser marcada como concluída.
 */
function runWorkoutToCompletion(id: string, startMs: number): WorkoutSession {
  let session = startWorkout(workout, { now: startMs, id }).session
  let now = startMs

  for (let step = 0; step < 500 && session.status === 'active'; step += 1) {
    if (session.currentPhase === 'completed') {
      session = advanceExercise(session, workout, now).session
    } else {
      now += 5_000
      session = tick(session, workout, now).session
    }
  }

  return session
}

/** Cria e finaliza uma sessão pelo motor, com horário controlado. */
function finishedSession(id: string, startMs: number, durationMs = 20 * 60_000): WorkoutSession {
  const started = startWorkout(workout, { now: startMs, id }).session
  return finishWorkout(started, startMs + durationMs).session
}

describe('histórico a partir dos registros do Workout Engine', () => {
  beforeEach(async () => {
    await clearSessions()
  })

  it('registra um treino efetivamente concluído', async () => {
    const startMs = localMs(2026, 1, 7, 18)
    const session = runWorkoutToCompletion('completed-1', startMs)

    expect(session.status).toBe('completed')
    expect(session.finishedAt).not.toBeNull()
    expect(session.exercisesProgress.every((progress) => progress.completed)).toBe(true)

    await saveSession(session)

    const history = await listCompletedSessions()
    expect(history.map((item) => item.id)).toEqual(['completed-1'])

    const grouped = groupSessionsByDate(history)
    expect(grouped.get(sessionDateKey(session) as string)).toHaveLength(1)

    const indicators = buildHistoryIndicators(
      history,
      { year: 2026, month: 0 },
      toLocalDateKey(session.finishedAt as string) as string,
    )
    expect(indicators).toEqual({ totalWorkouts: 1, currentStreak: 1, monthWorkouts: 1 })
  })

  it('não registra treino abandonado', async () => {
    const startMs = localMs(2026, 1, 7, 18)
    const started = startWorkout(workout, { now: startMs, id: 'abandoned-1' }).session
    const abandoned = abandonWorkout(started, startMs + 60_000).session

    await saveSession(abandoned)

    const history = await listCompletedSessions()
    expect(history).toHaveLength(0)
    expect(groupSessionsByDate(history).size).toBe(0)
  })

  it('não registra treino apenas iniciado ou pausado', async () => {
    const startMs = localMs(2026, 1, 7, 18)
    const active = startWorkout(workout, { now: startMs, id: 'active-1' }).session
    await saveSession(active)

    const paused = pauseWorkout(active, startMs + 30_000).session
    await saveSession(paused)

    expect(await listCompletedSessions()).toHaveLength(0)
  })

  it('não duplica a sessão ao salvar o mesmo treino várias vezes', async () => {
    const session = finishedSession('same-id', localMs(2026, 1, 7, 8))

    await saveSession(session)
    await saveSession(session)
    await saveSession(session)

    const history = await listCompletedSessions()
    expect(history.filter((item) => item.id === 'same-id')).toHaveLength(1)
    expect(groupSessionsByDate(history).get(sessionDateKey(session) as string)).toHaveLength(1)
  })

  it('consulta sessões por data, com múltiplos treinos no mesmo dia', async () => {
    const morning = finishedSession('morning', localMs(2026, 1, 7, 7), 20 * 60_000)
    const evening = finishedSession('evening', localMs(2026, 1, 7, 18), 25 * 60_000)
    const nextDay = finishedSession('next-day', localMs(2026, 1, 8, 9), 15 * 60_000)

    await saveSession(evening)
    await saveSession(morning)
    await saveSession(nextDay)

    const grouped = groupSessionsByDate(await listCompletedSessions())

    expect(grouped.get('2026-01-07')?.map((item) => item.id)).toEqual(['morning', 'evening'])
    expect(grouped.get('2026-01-08')?.map((item) => item.id)).toEqual(['next-day'])
    expect(countSessionsInMonth(await listCompletedSessions(), { year: 2026, month: 0 })).toBe(3)
  })

  it('separa treinos concluídos próximos da meia-noite pela data local', async () => {
    // Termina às 23h59 do dia 7 e às 00h01 do dia 8 (hora local).
    const beforeMidnight = finishedSession(
      'before-midnight',
      localMs(2026, 1, 7, 23, 40),
      19 * 60_000,
    )
    const afterMidnight = finishedSession(
      'after-midnight',
      localMs(2026, 1, 8, 0, 0),
      60_000,
    )

    await saveSession(beforeMidnight)
    await saveSession(afterMidnight)

    const history = await listCompletedSessions()
    expect(sessionDateKey(beforeMidnight)).toBe('2026-01-07')
    expect(sessionDateKey(afterMidnight)).toBe('2026-01-08')

    const grouped = groupSessionsByDate(history)
    expect(grouped.get('2026-01-07')?.map((item) => item.id)).toEqual(['before-midnight'])
    expect(grouped.get('2026-01-08')?.map((item) => item.id)).toEqual(['after-midnight'])
    expect(buildHistoryIndicators(history, { year: 2026, month: 0 }, '2026-01-08').currentStreak).toBe(2)
  })

  it('mantém o histórico após fechar e reabrir o banco', async () => {
    const session = finishedSession('persisted', localMs(2026, 1, 7, 8))
    await saveSession(session)

    closeDatabase()

    const history = await listCompletedSessions()
    expect(history.map((item) => item.id)).toEqual(['persisted'])
    expect((await getSession('persisted'))?.status).toBe('completed')
  })

  it('é compatível com registros existentes (schema já publicado)', async () => {
    const exercise = workout.exercises[0]
    const legacy: WorkoutSession = {
      id: 'legacy-session',
      workoutId: workout.id,
      workoutName: workout.name,
      status: 'completed',
      startedAt: new Date(localMs(2025, 12, 31, 10)).toISOString(),
      pausedAt: null,
      finishedAt: new Date(localMs(2025, 12, 31, 10, 15)).toISOString(),
      currentExerciseIndex: 0,
      currentSet: exercise.sets,
      currentPhase: 'completed',
      remainingTime: 0,
      phaseStartedAt: null,
      phaseEndsAt: null,
      totalPausedMs: 0,
      completedSets: exercise.sets,
      exercisesProgress: [
        {
          exerciseId: exercise.id,
          completedSets: exercise.sets,
          sets: Array.from({ length: exercise.sets }, (_, index) => ({
            set: index + 1,
            completedAt: new Date(localMs(2025, 12, 31, 10, index + 1)).toISOString(),
            workSeconds: exercise.workDuration,
          })),
          completed: true,
          completedAt: new Date(localMs(2025, 12, 31, 10, 10)).toISOString(),
        },
      ],
      duration: 900,
    }

    await saveSession(legacy)

    const history = await listCompletedSessions()
    expect(history).toHaveLength(1)
    expect(history[0]).toEqual(legacy)
    expect(sessionDateKey(history[0])).toBe('2025-12-31')
    expect(countSessionsInMonth(history, { year: 2025, month: 11 })).toBe(1)
  })
})
