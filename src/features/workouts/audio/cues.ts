import type { WorkoutEvent, WorkoutEventType } from '../domain/types'

/**
 * Avisos sonoros do treino (UI/UX §8).
 *
 * Esta camada é puramente declarativa: traduz as transições reais do motor
 * (`WorkoutEvent`) em "avisos" (`AudioCue`). Nenhuma regra de tempo vive aqui —
 * o motor continua sendo a única fonte de verdade das transições.
 */

export type AudioCue = 'rest' | 'letsGo' | 'exerciseComplete' | 'workoutComplete'

/** Mensagens faladas associadas a cada aviso (UI/UX §8.1). */
export const AUDIO_CUE_MESSAGES: Record<AudioCue, string> = {
  rest: 'Rest!',
  letsGo: "Let's go!",
  exerciseComplete: 'Exercise complete!',
  workoutComplete: 'Workout complete!',
}

/**
 * Mapeamento transição → aviso.
 *
 * - `rest-started` = fim do período de exercício → "Rest!".
 * - `rest-ended`   = fim do descanso → "Let's go!".
 * - `exercise-completed` = fim da última série do exercício → "Exercise complete!".
 * - `workout-completed`  = fim do treino inteiro → "Workout complete!".
 *
 * As transições de "início" (`workout-started`, `exercise-started`,
 * `set-started`) e as de navegação/pausa não produzem áudio — assim, navegar
 * entre telas ou consultar exercícios anteriores nunca dispara avisos.
 */
const CUE_FOR_EVENT: Partial<Record<WorkoutEventType, AudioCue>> = {
  'rest-started': 'rest',
  'rest-ended': 'letsGo',
  'exercise-completed': 'exerciseComplete',
  'workout-completed': 'workoutComplete',
}

/** Idade máxima (ms) para um evento ainda ser anunciado. */
export const DEFAULT_MAX_EVENT_AGE_MS = 2000

export interface CueMappingOptions {
  /** Instante de referência (epoch ms). Padrão: `Date.now()`. */
  now?: number
  /** Eventos mais antigos que isso são ignorados. Padrão: `DEFAULT_MAX_EVENT_AGE_MS`. */
  maxAgeMs?: number
}

/**
 * Traduz um lote de transições em avisos, aplicando as regras de reprodução:
 *
 * - **Nunca anunciar eventos atrasados.** Transições com `at` muito anterior a
 *   `now` (ex.: recuperação após o app ficar fechado em segundo plano) são
 *   descartadas — evita falas "antigas" quando o app volta ao primeiro plano.
 * - **Nunca duplicar avisos.** Avisos iguais e consecutivos são fundidos.
 * - **Fim do treino tem prioridade.** Quando o treino termina, só "Workout
 *   complete!" é anunciado (o "Exercise complete!" do último exercício é
 *   suprimido para não sobrepor duas falas no mesmo instante).
 */
export function cuesForEvents(events: WorkoutEvent[], options: CueMappingOptions = {}): AudioCue[] {
  const { now = Date.now(), maxAgeMs = DEFAULT_MAX_EVENT_AGE_MS } = options

  const cues: AudioCue[] = []
  for (const event of events) {
    if (now - event.at > maxAgeMs) continue
    const cue = CUE_FOR_EVENT[event.type]
    if (cue) cues.push(cue)
  }

  const deduped = cues.filter((cue, index) => cue !== cues[index - 1])

  if (deduped.includes('workoutComplete')) {
    return deduped.filter((cue) => cue !== 'exerciseComplete')
  }

  return deduped
}
