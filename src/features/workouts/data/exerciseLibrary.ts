import type { Exercise } from '../domain/types'
import { workouts } from './workouts.data'

/**
 * Biblioteca de exercícios disponível para montar treinos personalizados.
 *
 * **Derivada** do catálogo existente (`workouts.data.ts`) — não existe um
 * segundo catálogo. Removemos apenas repetições do mesmo movimento (a prancha
 * aparece em A e B): a chave de ilustração identifica o movimento, então o
 * usuário vê "Prancha" uma única vez.
 *
 * Manter o exercício da biblioteca intacto é o que garante que um treino
 * personalizado herde ilustração, instruções, passos, dicas e — por usar a
 * mesma `illustration` — a demonstração do Panda.
 */
function buildLibrary(): Exercise[] {
  const byIllustration = new Map<string, Exercise>()

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (!byIllustration.has(exercise.illustration)) {
        byIllustration.set(exercise.illustration, exercise)
      }
    }
  }

  return Array.from(byIllustration.values())
}

export const EXERCISE_LIBRARY: Exercise[] = buildLibrary()

/** Recupera um exercício da biblioteca pelo id. */
export function getLibraryExercise(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find((exercise) => exercise.id === id)
}
