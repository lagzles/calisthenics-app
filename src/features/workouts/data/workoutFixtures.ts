import type { Exercise, Workout } from '../domain/types'

/**
 * Construtores de treinos para testes e para o futuro Workout Mode.
 *
 * Cada chamada devolve um objeto novo, evitando estado compartilhado entre
 * testes. Sempre inclui valores válidos; use os `overrides` para casos de erro.
 */

export function makeExercise(overrides: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise {
  const base: Exercise = {
    id: overrides.id,
    name: overrides.id,
    illustration: 'plank',
    instructions: '',
    executionType: 'timed',
    sets: 3,
    restDuration: 10,
  }

  const merged: Exercise = { ...base, ...overrides }

  if (merged.executionType === 'timed' && merged.workDuration === undefined) {
    merged.workDuration = 30
  }
  if (merged.executionType === 'reps' && merged.repetitions === undefined) {
    merged.repetitions = 12
  }

  return merged
}

export function makeWorkout(overrides: Partial<Workout> & Pick<Workout, 'id'>): Workout {
  const exercises = overrides.exercises ?? [makeExercise({ id: `${overrides.id}-1` })]
  return {
    id: overrides.id,
    name: overrides.name ?? `Treino ${overrides.id}`,
    description: overrides.description ?? '',
    estimatedMinutes: overrides.estimatedMinutes ?? 10,
    exercises,
  }
}

/** 1 exercício por tempo: 3 séries · 30s de exercício · 10s de descanso. */
export function timedWorkout(): Workout {
  return makeWorkout({
    id: 'A',
    name: 'Timed',
    exercises: [
      makeExercise({
        id: 'squat',
        name: 'Agachamento',
        executionType: 'timed',
        sets: 3,
        workDuration: 30,
        restDuration: 10,
      }),
    ],
  })
}

/** 1 exercício por repetições: 3 séries · 12 repetições · 60s de descanso. */
export function repsWorkout(): Workout {
  return makeWorkout({
    id: 'B',
    name: 'Reps',
    exercises: [
      makeExercise({
        id: 'pushup',
        name: 'Flexão',
        executionType: 'reps',
        sets: 3,
        repetitions: 12,
        restDuration: 60,
      }),
    ],
  })
}

/** Dois exercícios (um por tempo, um por repetições) para testar navegação. */
export function mixedWorkout(): Workout {
  return makeWorkout({
    id: 'A',
    name: 'Misto',
    exercises: [
      makeExercise({
        id: 'plank',
        name: 'Prancha',
        executionType: 'timed',
        sets: 2,
        workDuration: 30,
        restDuration: 10,
      }),
      makeExercise({
        id: 'pushup',
        name: 'Flexão',
        executionType: 'reps',
        sets: 2,
        repetitions: 10,
        restDuration: 20,
      }),
    ],
  })
}
