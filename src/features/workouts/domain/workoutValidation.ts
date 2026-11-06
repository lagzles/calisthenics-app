import type { Exercise, Workout } from './types'

/**
 * Validação do catálogo de treinos.
 *
 * Garante que cada exercício declara corretamente os campos exigidos pela sua
 * modalidade — por exemplo, um exercício `timed` precisa de `workDuration > 0`
 * e um exercício `reps` precisa de `repetitions >= 1`.
 */

export class WorkoutValidationError extends Error {
  readonly errors: string[]

  constructor(errors: string[]) {
    super(`Treino inválido:\n- ${errors.join('\n- ')}`)
    this.name = 'WorkoutValidationError'
    this.errors = errors
  }
}

export function validateExercise(exercise: Exercise): string[] {
  const errors: string[] = []
  const label = exercise.id || 'sem-id'

  if (!exercise.id) errors.push('Exercício sem id.')
  if (!exercise.name || !exercise.name.trim()) {
    errors.push(`Exercício "${label}": nome é obrigatório.`)
  }
  if (!Number.isInteger(exercise.sets) || exercise.sets < 1) {
    errors.push(`Exercício "${label}": sets deve ser um inteiro >= 1.`)
  }

  if (exercise.executionType === 'timed') {
    if (typeof exercise.workDuration !== 'number' || exercise.workDuration <= 0) {
      errors.push(`Exercício "${label}": exercícios por tempo exigem workDuration > 0.`)
    }
  } else if (exercise.executionType === 'reps') {
    if (typeof exercise.repetitions !== 'number' || exercise.repetitions < 1) {
      errors.push(`Exercício "${label}": exercícios por repetições exigem repetitions >= 1.`)
    }
  } else {
    errors.push(`Exercício "${label}": executionType inválido.`)
  }

  if (typeof exercise.restDuration !== 'number' || exercise.restDuration < 0) {
    errors.push(`Exercício "${label}": restDuration deve ser um número >= 0.`)
  }

  return errors
}

export function validateWorkout(workout: Workout): string[] {
  const errors: string[] = []

  if (!workout.id) errors.push('Treino sem id.')
  if (!workout.name || !workout.name.trim()) {
    errors.push(`Treino "${workout.id || 'sem-id'}": nome é obrigatório.`)
  }

  if (!workout.exercises || workout.exercises.length === 0) {
    errors.push(`Treino "${workout.id || 'sem-id'}": é necessário ao menos um exercício.`)
    return errors
  }

  const seen = new Set<string>()
  for (const exercise of workout.exercises) {
    if (seen.has(exercise.id)) {
      errors.push(`Exercício duplicado: "${exercise.id}".`)
    }
    seen.add(exercise.id)
    errors.push(...validateExercise(exercise))
  }

  return errors
}

export function isValidWorkout(workout: Workout): boolean {
  return validateWorkout(workout).length === 0
}

export function assertValidWorkout(workout: Workout): void {
  const errors = validateWorkout(workout)
  if (errors.length > 0) {
    throw new WorkoutValidationError(errors)
  }
}
