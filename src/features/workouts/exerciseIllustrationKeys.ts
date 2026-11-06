import type { ExerciseIllustrationKey } from './domain/types'

/**
 * Registro das ilustrações de exercício e os arquivos SVG correspondentes.
 *
 * Fica separado de `exerciseIllustrations.ts` (que importa os assets) para
 * poder ser consumido — e testado — sem carregar arquivos `.svg`, que o Vitest
 * (ambiente Node) não resolve. A existência física dos arquivos é verificada
 * por `exerciseIllustrations.test.ts` a partir daqui.
 *
 * Reutilização: movimentos que aparecem em mais de um treino (ex.: prancha em A
 * e B) apontam para a **mesma** chave e, portanto, para o mesmo arquivo.
 */
export const EXERCISE_ILLUSTRATION_FILES: Record<ExerciseIllustrationKey, string> = {
  squat: 'squat.svg',
  'incline-push-up': 'incline-push-up.svg',
  'glute-bridge': 'glute-bridge.svg',
  plank: 'plank.svg',
  'jumping-jacks': 'jumping-jacks.svg',
  'running-in-place': 'running-in-place.svg',
  'wall-sit': 'wall-sit.svg',
  'abdominal-rower': 'abdominal-rower.svg',
  'lying-leg-raise': 'lying-leg-raise.svg',
}

/** Todas as chaves de ilustração suportadas (ordem estável). */
export const EXERCISE_ILLUSTRATION_KEYS = Object.keys(
  EXERCISE_ILLUSTRATION_FILES,
) as ExerciseIllustrationKey[]

/** Diretório dos assets, relativo à raiz do projeto. */
export const EXERCISE_ILLUSTRATION_DIR = 'src/assets/exercises'
