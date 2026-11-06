import type { WorkoutId } from './domain/types'

export const DEFAULT_WORKOUT_ID: WorkoutId = 'A'

/**
 * Regra de recomendação do próximo treino (UI/UX §4):
 * - Sem histórico: recomenda A.
 * - Último treino A: recomenda B.
 * - Último treino B: recomenda A.
 *
 * Mantida como função pura para separar a lógica de negócios da interface.
 */
export function getRecommendedWorkoutId(lastWorkoutId: WorkoutId | null): WorkoutId {
  if (lastWorkoutId === 'A') return 'B'
  if (lastWorkoutId === 'B') return 'A'
  return DEFAULT_WORKOUT_ID
}
