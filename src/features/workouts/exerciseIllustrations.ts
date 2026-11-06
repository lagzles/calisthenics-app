import squat from '../../assets/exercises/squat.svg'
import inclinePushUp from '../../assets/exercises/incline-push-up.svg'
import gluteBridge from '../../assets/exercises/glute-bridge.svg'
import plank from '../../assets/exercises/plank.svg'
import jumpingJacks from '../../assets/exercises/jumping-jacks.svg'
import runningInPlace from '../../assets/exercises/running-in-place.svg'
import wallSit from '../../assets/exercises/wall-sit.svg'
import abdominalRower from '../../assets/exercises/abdominal-rower.svg'
import lyingLegRaise from '../../assets/exercises/lying-leg-raise.svg'
import type { Exercise, ExerciseIllustrationKey } from './domain/types'

/**
 * Resolução das ilustrações de exercício para URLs de assets locais.
 *
 * Os SVGs são importados como módulos: o Vite os emite (ou transforma em data
 * URL) e o Service Worker os inclui no precache — logo **não há dependência de
 * rede**. A interface apenas renderiza a URL resultante.
 */
export const EXERCISE_ILLUSTRATIONS: Record<ExerciseIllustrationKey, string> = {
  squat,
  'incline-push-up': inclinePushUp,
  'glute-bridge': gluteBridge,
  plank,
  'jumping-jacks': jumpingJacks,
  'running-in-place': runningInPlace,
  'wall-sit': wallSit,
  'abdominal-rower': abdominalRower,
  'lying-leg-raise': lyingLegRaise,
}

/** URL da ilustração de um exercício. */
export function getExerciseIllustration(exercise: Exercise): string {
  return EXERCISE_ILLUSTRATIONS[exercise.illustration]
}
