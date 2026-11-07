import type { Exercise, Workout } from '../../workouts/domain/types'
import { PANDA_DEMOS } from './pandaDemos'
import type { DemoTrack } from './pandaTypes'

/**
 * Cobertura do Panda Personal Trainer sobre o catálogo de exercícios.
 *
 * Regras garantidas aqui (e verificadas por teste):
 *
 * 1. Todo exercício tem uma **demonstração** correspondente ao seu
 *    movimento, ou uma limitação **explicitamente documentada** no próprio
 *    exercício (`demoUnavailableReason`). Nenhum exercício fica sem
 *    demonstração silenciosamente.
 * 2. Todo exercício tem as orientações estruturadas: posição inicial,
 *    respiração e dicas de postura.
 */

/** A demonstração do panda para um exercício (ou `null` se documentada como indisponível). */
export function getExercisePandaDemo(exercise: Exercise): DemoTrack | null {
  if (exercise.demoUnavailableReason) return null
  return PANDA_DEMOS[exercise.illustration] ?? null
}

/** O exercício tem demonstração disponível? */
export function hasPandaDemo(exercise: Exercise): boolean {
  return getExercisePandaDemo(exercise) !== null
}

/**
 * Valida a cobertura do panda sobre uma lista de treinos.
 *
 * Devolve uma lista de problemas (vazia quando tudo está coberto).
 */
export function validatePandaCoverage(workouts: Workout[]): string[] {
  const errors: string[] = []

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const label = `${workout.id}/${exercise.id}`

      const hasDemo = PANDA_DEMOS[exercise.illustration] !== undefined
      const hasReason = Boolean(exercise.demoUnavailableReason)

      if (!hasDemo && !hasReason) {
        errors.push(
          `Exercício "${label}": sem demonstração do panda e sem limitação documentada.`,
        )
      }

      if (hasDemo && hasReason) {
        errors.push(
          `Exercício "${label}": tem demonstração do panda e também registra limitação.`,
        )
      }

      if (!exercise.startPosition) {
        errors.push(`Exercício "${label}": sem orientação de posição inicial.`)
      }

      if (!exercise.breathing) {
        errors.push(`Exercício "${label}": sem orientação de respiração.`)
      }

      if (!exercise.posture || exercise.posture.length === 0) {
        errors.push(`Exercício "${label}": sem dicas de postura.`)
      }
    }
  }

  return errors
}
