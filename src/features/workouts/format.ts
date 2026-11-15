import type { Exercise, Workout, WorkoutId } from './domain/types'

const PRESET_IDS: readonly string[] = ['A', 'B'] satisfies WorkoutId[]

/** Indica se o id pertence a um treino predefinido do catálogo. */
export function isPresetWorkoutId(id: string): id is WorkoutId {
  return PRESET_IDS.includes(id)
}

/**
 * Nome de exibição do treino.
 *
 * Presets usam a marca curta ("Treino A"); treinos personalizados usam o nome
 * escolhido pelo usuário, já que o id gerado não é legível.
 */
export function describeWorkoutLabel(workout: Workout): string {
  return isPresetWorkoutId(workout.id) ? `Treino ${workout.id}` : workout.name
}

/**
 * Descreve a carga de um exercício para exibição: séries × tempo ou repetições.
 *
 * Nos treinos do MVP (todos por tempo) o texto é sempre "3 séries · 40s" — sem
 * qualquer referência a repetições. O ramo por repetições é mantido para o
 * suporte genérico do domínio, mas não é usado pelos treinos A e B.
 */
export function describeExerciseTarget(exercise: Exercise): string {
  if (exercise.executionType === 'timed') {
    return `${exercise.sets} séries · ${exercise.workDuration}s`
  }
  return `${exercise.sets} × ${exercise.repetitions} reps`
}

/**
 * Rótulo da modalidade de execução.
 */
export function describeModality(exercise: Exercise): string {
  return exercise.executionType === 'timed' ? 'Por tempo' : 'Por repetições'
}
