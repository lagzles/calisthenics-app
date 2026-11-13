import { beforeEach, describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY } from '../features/workouts/data/exerciseLibrary'
import { clearCustomWorkouts } from '../features/workouts/data/customWorkoutRepository'
import { clearSessions } from '../features/workouts/data/workoutRepository'
import {
  addExercise,
  createDraft,
  setExerciseLimit,
  setName,
  toCustomWorkout,
} from '../features/workouts/domain/customWorkout'
import type { CustomWorkout } from '../features/workouts/domain/types'
import {
  deleteCustomWorkout,
  getCustomWorkoutById,
  getCustomWorkouts,
  getWorkoutById,
  loadWorkoutMode,
  resolveWorkout,
  saveCustomWorkout as saveCustomWorkoutThroughService,
  startWorkoutSession,
} from './workoutService'

const T0 = Date.parse('2026-05-06T07:00:00.000Z')

function buildCustomWorkout(name = 'Circuito personalizado'): CustomWorkout {
  const draft = setName(
    addExercise(setExerciseLimit(createDraft(), 2), EXERCISE_LIBRARY[0].id),
    name,
  )

  return toCustomWorkout(draft, EXERCISE_LIBRARY, { now: T0 })
}

describe('workoutService — treinos personalizados', () => {
  beforeEach(async () => {
    await clearSessions()
    await clearCustomWorkouts()
  })

  it('resolve um preset pelo catálogo estático', async () => {
    const workout = await resolveWorkout('A')

    expect(workout?.id).toBe('A')
    expect(workout).toEqual(getWorkoutById('A'))
  })

  it('resolve um treino personalizado salvo', async () => {
    const custom = buildCustomWorkout()
    await saveCustomWorkoutThroughService(custom)

    const resolved = await resolveWorkout(custom.id)

    expect(resolved?.id).toBe(custom.id)
    expect(resolved?.name).toBe(custom.name)
  })

  it('retorna undefined para id desconhecido', async () => {
    expect(await resolveWorkout('custom-inexistente')).toBeUndefined()
  })

  it('salva, lista e recupera treinos personalizados', async () => {
    const first = buildCustomWorkout('Primeiro')
    const second = buildCustomWorkout('Segundo')

    await saveCustomWorkoutThroughService(first)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await saveCustomWorkoutThroughService(second)

    const list = await getCustomWorkouts()
    expect(list).toHaveLength(2)
    expect(await getCustomWorkoutById(first.id)).toEqual(first)
  })

  it('exclui um treino personalizado', async () => {
    const custom = buildCustomWorkout()
    await saveCustomWorkoutThroughService(custom)

    await deleteCustomWorkout(custom.id)

    expect(await getCustomWorkoutById(custom.id)).toBeNull()
    expect(await getCustomWorkouts()).toEqual([])
  })

  it('inicia uma sessão a partir de um treino personalizado', async () => {
    const custom = buildCustomWorkout()
    await saveCustomWorkoutThroughService(custom)

    const { session } = await startWorkoutSession(custom.id, { now: T0, id: 'custom-session' })

    expect(session.workoutId).toBe(custom.id)
    expect(session.workoutName).toBe(custom.name)
    expect(session.status).toBe('active')
  })

  it('carrega a preparação de um treino personalizado', async () => {
    const custom = buildCustomWorkout()
    await saveCustomWorkoutThroughService(custom)

    const loaded = await loadWorkoutMode(custom.id)

    expect(loaded.status).toBe('prepare')
    if (loaded.status === 'prepare') {
      expect(loaded.workout.id).toBe(custom.id)
    }
  })

  it('continua iniciando os presets do catálogo', async () => {
    const { session } = await startWorkoutSession('B', { now: T0, id: 'preset-session' })

    expect(session.workoutId).toBe('B')
    expect(session.exercisesProgress.length).toBe(getWorkoutById('B')?.exercises.length)
  })
})
