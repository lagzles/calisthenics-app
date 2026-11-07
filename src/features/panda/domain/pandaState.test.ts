import { describe, expect, it } from 'vitest'
import { workouts } from '../../workouts/data/workouts.data'
import { advanceExercise, startWorkout, tick } from '../../workouts/domain/workoutEngine'
import { getSessionSnapshot } from '../../workouts/domain/workoutSelectors'
import { resolvePandaState, showsPandaDemo } from './pandaState'

const T0 = Date.parse('2026-01-01T10:00:00.000Z')
const at = (seconds: number): number => T0 + seconds * 1000

const workout = workouts[0]

describe('resolvePandaState', () => {
  it('mostra o estado neutro durante a execução do exercício', () => {
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const snapshot = getSessionSnapshot(session, workout, T0)

    expect(resolvePandaState(snapshot)).toBe('idle')
    expect(showsPandaDemo(snapshot)).toBe(true)
  })

  it('coloca o panda em descanso durante o intervalo entre séries', () => {
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const resting = tick(session, workout, at(45)).session
    const snapshot = getSessionSnapshot(resting, workout, at(45))

    expect(snapshot.phase).toBe('rest')
    expect(resolvePandaState(snapshot)).toBe('rest')
    expect(showsPandaDemo(snapshot)).toBe(false)
  })

  it('incentiva o usuário quando o exercício termina', () => {
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    // 3 séries de 40s + 2 descansos de 30s = 180s de exercício.
    const finished = tick(session, workout, at(200)).session
    const snapshot = getSessionSnapshot(finished, workout, at(200))

    expect(snapshot.phase).toBe('completed')
    expect(resolvePandaState(snapshot)).toBe('encouraging')
  })

  it('comemora quando o treino inteiro termina', () => {
    let session = startWorkout(workout, { now: T0, id: 's' }).session
    let time = 0

    // Percorre todos os exercícios do treino até o fim.
    for (let i = 0; i < workout.exercises.length; i += 1) {
      time += 200
      session = tick(session, workout, at(time)).session
      if (i < workout.exercises.length - 1) {
        session = advanceExercise(session, workout, at(time + 1)).session
        time += 1
      }
    }

    const snapshot = getSessionSnapshot(session, workout, at(time))

    expect(snapshot.isWorkoutComplete).toBe(true)
    expect(resolvePandaState(snapshot)).toBe('celebrating')
    expect(showsPandaDemo(snapshot)).toBe(false)
  })
})
