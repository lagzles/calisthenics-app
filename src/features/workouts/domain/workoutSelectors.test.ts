import { describe, expect, it } from 'vitest'
import { mixedWorkout, repsWorkout, timedWorkout } from '../data/workoutFixtures'
import { pauseWorkout, startWorkout, tick } from './workoutEngine'
import {
  countCompletedSets,
  countTotalSets,
  getElapsedSeconds,
  getRemainingTime,
  getSessionSnapshot,
} from './workoutSelectors'

const T0 = Date.parse('2026-01-01T10:00:00.000Z')
const at = (seconds: number): number => T0 + seconds * 1000

describe('workoutSelectors', () => {
  const workout = timedWorkout()
  const session = startWorkout(workout, { now: T0, id: 's' }).session

  it('calcula o tempo restante em tempo real', () => {
    expect(getRemainingTime(session, T0)).toBe(30)
    expect(getRemainingTime(session, at(10))).toBe(20)
    expect(getRemainingTime(session, at(30))).toBe(0)
  })

  it('marca as capacidades durante o exercício', () => {
    const snapshot = getSessionSnapshot(session, workout, T0)
    expect(snapshot.phase).toBe('work')
    expect(snapshot.canPause).toBe(true)
    expect(snapshot.canResume).toBe(false)
    expect(snapshot.canSkipRest).toBe(false)
    expect(snapshot.canExtendRest).toBe(false)
    expect(snapshot.canCompleteSet).toBe(false)
    expect(snapshot.canAdvance).toBe(false)
    expect(snapshot.isRunning).toBe(true)
  })

  it('marca as capacidades durante o descanso', () => {
    const rest = tick(session, workout, at(30)).session
    const snapshot = getSessionSnapshot(rest, workout, at(30))
    expect(snapshot.phase).toBe('rest')
    expect(snapshot.canSkipRest).toBe(true)
    expect(snapshot.canExtendRest).toBe(true)
    expect(snapshot.remainingTime).toBe(10)
  })

  it('marca as capacidades quando pausado', () => {
    const paused = pauseWorkout(session, at(5)).session
    const snapshot = getSessionSnapshot(paused, workout, at(999))
    expect(snapshot.isPaused).toBe(true)
    expect(snapshot.isRunning).toBe(false)
    expect(snapshot.canPause).toBe(false)
    expect(snapshot.canResume).toBe(true)
    expect(snapshot.remainingTime).toBe(25)
  })

  it('permite concluir série apenas em exercícios por repetições', () => {
    const reps = repsWorkout()
    const repsSession = startWorkout(reps, { now: T0, id: 'r' }).session
    expect(getSessionSnapshot(repsSession, reps, T0).canCompleteSet).toBe(true)
  })

  it('calcula o progresso por séries', () => {
    const afterFirstSet = tick(session, workout, at(30)).session
    const snapshot = getSessionSnapshot(afterFirstSet, workout, at(30))
    expect(snapshot.exerciseProgress).toBeCloseTo(1 / 3)
    expect(snapshot.workoutProgress).toBeCloseTo(1 / 3)
  })

  it('identifica próximo exercício e conclusão do treino', () => {
    const mixed = mixedWorkout()
    const mixedSession = startWorkout(mixed, { now: T0, id: 'm' }).session
    expect(getSessionSnapshot(mixedSession, mixed, T0).nextExercise?.id).toBe('pushup')

    const completed = tick(session, workout, at(110)).session
    const snapshot = getSessionSnapshot(completed, workout, at(110))
    expect(snapshot.isWorkoutComplete).toBe(true)
    expect(snapshot.workoutProgress).toBe(1)
    expect(snapshot.remainingTime).toBe(0)
  })

  it('conta séries e mede a duração efetiva', () => {
    expect(countTotalSets(workout)).toBe(3)
    expect(countCompletedSets(session)).toBe(0)
    expect(getElapsedSeconds(session, at(12))).toBe(12)
  })
})
