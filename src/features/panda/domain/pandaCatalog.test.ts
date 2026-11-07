import { describe, expect, it } from 'vitest'
import { workouts } from '../../workouts/data/workouts.data'
import {
  getExercisePandaDemo,
  hasPandaDemo,
  validatePandaCoverage,
} from './pandaCatalog'

describe('cobertura do panda sobre o catálogo', () => {
  it('não há exercício sem demonstração nem limitação documentada', () => {
    expect(validatePandaCoverage(workouts)).toEqual([])
  })

  it('todo exercício dos treinos A e B tem demonstração do panda', () => {
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        expect(hasPandaDemo(exercise)).toBe(true)
        expect(getExercisePandaDemo(exercise)).not.toBeNull()
      }
    }
  })

  it('a prancha compartilha a mesma demonstração nos dois treinos', () => {
    const plankA = workouts[0].exercises.find((exercise) => exercise.id === 'a-prancha')
    const plankB = workouts[1].exercises.find((exercise) => exercise.id === 'b-prancha')

    expect(plankA).toBeDefined()
    expect(plankB).toBeDefined()
    expect(getExercisePandaDemo(plankA!)).toBe(getExercisePandaDemo(plankB!))
  })

  it('todo exercício tem objetivo, posição inicial, respiração e postura', () => {
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        expect(exercise.description).toBeTruthy()
        expect(exercise.startPosition).toBeTruthy()
        expect(exercise.breathing).toBeTruthy()
        expect(exercise.posture?.length ?? 0).toBeGreaterThanOrEqual(2)
        expect(exercise.commonMistakes?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it('não registra limitação de demo onde existe demonstração', () => {
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        expect(exercise.demoUnavailableReason).toBeUndefined()
      }
    }
  })
})
