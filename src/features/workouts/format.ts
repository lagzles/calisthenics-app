import type { Exercise } from './domain/types'

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
