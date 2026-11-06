import { describe, expect, it } from 'vitest'
import type { ExerciseProgress, WorkoutSession } from './domain/types'
import { getRecommendedWorkoutId } from './recommendation'
import {
  buildHistorySummary,
  buildHomeSummary,
  daysAgo,
  isSameWeek,
  startOfWeekMonday,
  toSessionListItem,
  toSessionListItems,
} from './sessionSummary'

// Quarta-feira, 07/01/2026 (a semana começa na segunda, 05/01/2026).
const NOW = Date.parse('2026-01-07T12:00:00')

function progress(overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    exerciseId: 'a-1',
    completedSets: 3,
    sets: [],
    completed: true,
    completedAt: '2026-01-07T11:20:00',
    ...overrides,
  }
}

function makeSession(overrides: Partial<WorkoutSession> & Pick<WorkoutSession, 'id'>): WorkoutSession {
  return {
    workoutId: 'A',
    workoutName: 'Corpo inteiro',
    status: 'completed',
    startedAt: '2026-01-07T11:00:00',
    pausedAt: null,
    finishedAt: '2026-01-07T11:20:00',
    currentExerciseIndex: 0,
    currentSet: 1,
    currentPhase: 'completed',
    remainingTime: 0,
    phaseStartedAt: null,
    phaseEndsAt: null,
    totalPausedMs: 0,
    completedSets: 6,
    exercisesProgress: [progress(), progress({ exerciseId: 'a-2' })],
    duration: 1200,
    ...overrides,
  }
}

describe('startOfWeekMonday / isSameWeek', () => {
  it('calcula a segunda-feira da semana corrente', () => {
    const monday = new Date(startOfWeekMonday(NOW))
    expect(monday.getDay()).toBe(1)
    expect(monday.getHours()).toBe(0)
    expect(monday.getDate()).toBe(5)
  })

  it('separa sessões da semana corrente das anteriores', () => {
    const thisWeek = makeSession({ id: 'w', finishedAt: '2026-01-07T09:00:00' })
    const lastWeek = makeSession({ id: 'p', finishedAt: '2026-01-04T10:00:00' })

    expect(isSameWeek(thisWeek, NOW)).toBe(true)
    expect(isSameWeek(lastWeek, NOW)).toBe(false)
  })
})

describe('buildHomeSummary', () => {
  it('zera quando não há histórico', () => {
    const summary = buildHomeSummary([], NOW)
    expect(summary.weeklyWorkoutsCompleted).toBe(0)
    expect(summary.lastWorkout).toBeNull()
    expect(summary.weeklyWorkoutsGoal).toBeGreaterThan(0)
  })

  it('conta apenas sessões concluídas da semana', () => {
    const sessions = [
      makeSession({ id: 'a', finishedAt: '2026-01-07T09:00:00' }),
      makeSession({ id: 'b', workoutId: 'B', finishedAt: '2026-01-06T09:00:00' }),
      makeSession({ id: 'old', finishedAt: '2026-01-02T09:00:00' }),
      makeSession({ id: 'open', status: 'active', finishedAt: null }),
      makeSession({ id: 'paused', status: 'paused', finishedAt: null }),
      makeSession({ id: 'dropped', status: 'abandoned' }),
    ]

    const summary = buildHomeSummary(sessions, NOW)
    expect(summary.weeklyWorkoutsCompleted).toBe(2)
  })

  it('usa o último treino concluído para a recomendação', () => {
    const sessions = [
      makeSession({ id: 'a', workoutId: 'A', finishedAt: '2026-01-06T09:00:00' }),
      makeSession({ id: 'b', workoutId: 'B', finishedAt: '2026-01-07T09:00:00' }),
      makeSession({ id: 'open', workoutId: 'A', status: 'active', finishedAt: null }),
    ]

    const summary = buildHomeSummary(sessions, NOW)
    expect(summary.lastWorkout?.workoutId).toBe('B')
    expect(summary.lastWorkout?.daysAgo).toBe(0)

    const recommended = getRecommendedWorkoutId(summary.lastWorkout?.workoutId ?? null)
    expect(recommended).toBe('A')
  })

  it('recomenda A quando não há histórico', () => {
    const summary = buildHomeSummary([], NOW)
    expect(getRecommendedWorkoutId(summary.lastWorkout?.workoutId ?? null)).toBe('A')
  })
})

describe('daysAgo', () => {
  it('conta dias inteiros decorridos', () => {
    expect(daysAgo(NOW - 3 * 86_400_000, NOW)).toBe(3)
    expect(daysAgo(NOW, NOW)).toBe(0)
  })
})

describe('buildHistorySummary', () => {
  it('soma treinos, semana e tempo total apenas das concluídas', () => {
    const sessions = [
      makeSession({ id: 'a', duration: 1200, finishedAt: '2026-01-07T09:00:00' }),
      makeSession({ id: 'b', duration: 600, finishedAt: '2026-01-06T09:00:00' }),
      makeSession({ id: 'old', duration: 600, finishedAt: '2026-01-02T09:00:00' }),
      makeSession({ id: 'open', status: 'active', duration: 0, finishedAt: null }),
    ]

    const summary = buildHistorySummary(sessions, NOW)
    expect(summary.totalWorkouts).toBe(3)
    expect(summary.weeklyWorkouts).toBe(2)
    expect(summary.totalMinutes).toBe(40)
  })
})

describe('toSessionListItem / toSessionListItems', () => {
  it('ignora sessões não concluídas', () => {
    expect(toSessionListItem(makeSession({ id: 'x', status: 'abandoned' }))).toBeNull()
  })

  it('resume duração, exercícios e séries', () => {
    const item = toSessionListItem(makeSession({ id: 'x', duration: 1500, completedSets: 5 }))
    expect(item?.durationMinutes).toBe(25)
    expect(item?.exercisesCompleted).toBe(2)
    expect(item?.exercisesTotal).toBe(2)
    expect(item?.setsCompleted).toBe(5)
  })

  it('lista concluídas da mais recente para a mais antiga', () => {
    const items = toSessionListItems([
      makeSession({ id: 'older', finishedAt: '2026-01-06T09:00:00' }),
      makeSession({ id: 'newer', finishedAt: '2026-01-07T09:00:00' }),
      makeSession({ id: 'open', status: 'active', finishedAt: null }),
    ])

    expect(items.map((item) => item.id)).toEqual(['newer', 'older'])
  })
})
