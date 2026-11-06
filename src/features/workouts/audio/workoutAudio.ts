import type { WorkoutEvent } from '../domain/types'
import { AUDIO_CUE_MESSAGES, cuesForEvents, type AudioCue, type CueMappingOptions } from './cues'
import { createSpeechPlayer, type AudioPlayer } from './speechPlayer'

/**
 * Orquestrador de áudio do treino.
 *
 * Liga o mapeamento de avisos (`cuesForEvents`) ao reprodutor (`AudioPlayer`).
 * A interface (Workout Mode) apenas entrega os eventos do motor; toda a lógica
 * de "o que tocar" fica aqui.
 */
export interface WorkoutAudio {
  /** Indica se o áudio está disponível no navegador atual. */
  readonly supported: boolean
  /** Prepara o áudio durante o gesto do usuário que inicia o treino. */
  prepare(): void
  /** Reproduz o aviso de cada transição do motor (sem duplicar nem atrasar). */
  handleEvents(events: WorkoutEvent[]): void
  /** Reproduz um aviso específico (uso interno/testes). */
  playCue(cue: AudioCue): void
  /** Libera recursos. */
  dispose(): void
}

export interface WorkoutAudioOptions {
  /** Reprodutor. Padrão: síntese de voz do navegador. */
  player?: AudioPlayer
  /** Relógio injetável. Padrão: `Date.now`. */
  now?: () => number
  /** Idade máxima de um evento para ainda ser anunciado (ms). */
  maxAgeMs?: number
}

export function createWorkoutAudio(options: WorkoutAudioOptions = {}): WorkoutAudio {
  const player = options.player ?? createSpeechPlayer()
  const now = options.now ?? Date.now
  const { maxAgeMs } = options

  const mappingOptions = (): CueMappingOptions => ({ now: now(), maxAgeMs })

  return {
    supported: player.supported,

    prepare() {
      player.prepare()
    },

    playCue(cue) {
      player.play(AUDIO_CUE_MESSAGES[cue])
    },

    handleEvents(events) {
      if (events.length === 0) return
      for (const cue of cuesForEvents(events, mappingOptions())) {
        player.play(AUDIO_CUE_MESSAGES[cue])
      }
    },

    dispose() {
      player.dispose()
    },
  }
}
