import { describe, expect, it } from 'vitest'
import { makeExercise, makeWorkout } from '../data/workoutFixtures'
import { isValidWorkout, validateWorkout, WorkoutValidationError, assertValidWorkout } from './workoutValidation'

describe('workoutValidation', () => {
  it('aceita um exercício por tempo válido', () => {
    const workout = makeWorkout({
      id: 'A',
      exercises: [makeExercise({ id: 'plank', executionType: 'timed', workDuration: 30 })],
    })
    expect(isValidWorkout(workout)).toBe(true)
    expect(validateWorkout(workout)).toEqual([])
  })

  it('aceita um exercício por repetições válido', () => {
    const workout = makeWorkout({
      id: 'B',
      exercises: [makeExercise({ id: 'pushup', executionType: 'reps', repetitions: 12 })],
    })
    expect(isValidWorkout(workout)).toBe(true)
  })

  it('rejeita exercício por tempo sem workDuration > 0', () => {
    const workout = makeWorkout({
      id: 'A',
      exercises: [makeExercise({ id: 'plank', executionType: 'timed', workDuration: 0 })],
    })
    expect(validateWorkout(workout).some((error) => error.includes('workDuration'))).toBe(true)
  })

  it('rejeita exercício por repetições sem repetitions >= 1', () => {
    const workout = makeWorkout({
      id: 'A',
      exercises: [makeExercise({ id: 'pushup', executionType: 'reps', repetitions: 0 })],
    })
    expect(validateWorkout(workout).some((error) => error.includes('repetitions'))).toBe(true)
  })

  it('rejeita sets menores que 1', () => {
    const workout = makeWorkout({
      id: 'A',
      exercises: [makeExercise({ id: 'plank', sets: 0 })],
    })
    expect(validateWorkout(workout).some((error) => error.includes('sets'))).toBe(true)
  })

  it('rejeita treino sem exercícios', () => {
    const workout = makeWorkout({ id: 'A', exercises: [] })
    expect(validateWorkout(workout).some((error) => error.includes('exercício'))).toBe(true)
  })

  it('rejeita exercícios duplicados', () => {
    const workout = makeWorkout({
      id: 'A',
      exercises: [makeExercise({ id: 'plank' }), makeExercise({ id: 'plank' })],
    })
    expect(validateWorkout(workout).some((error) => error.includes('duplicado'))).toBe(true)
  })

  it('assertValidWorkout lança WorkoutValidationError', () => {
    const workout = makeWorkout({ id: 'A', exercises: [makeExercise({ id: 'plank', sets: 0 })] })
    expect(() => assertValidWorkout(workout)).toThrow(WorkoutValidationError)
  })
})
