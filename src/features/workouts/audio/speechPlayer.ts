/**
 * Reprodução dos avisos sonoros.
 *
 * O `AudioPlayer` é a fronteira substituível da camada de áudio: hoje ele é
 * implementado com a síntese de voz nativa do navegador (`SpeechSynthesis`);
 * amanhã pode ser trocado por arquivos locais (`<audio>`) **sem alterar** o
 * motor nem a lógica de mapeamento de avisos.
 */

export interface AudioPlayer {
  /** Indica se o navegador oferece o recurso de reprodução. */
  readonly supported: boolean
  /** Prepara o áudio durante um gesto do usuário (contorna autoplay). */
  prepare(): void
  /** Reproduz uma mensagem. Nunca lança: falhas são registradas e ignoradas. */
  play(message: string): void
  /** Interrompe e libera recursos. */
  dispose(): void
}

/** Registra uma falha de áudio sem interromper o treino. */
export function reportAudioFailure(context: string, error: unknown): void {
  console.warn(`[workout-audio] falha em "${context}":`, error)
}

interface SpeechScope {
  speechSynthesis?: SpeechSynthesis
  SpeechSynthesisUtterance?: new (text: string) => SpeechSynthesisUtterance
}

function resolveScope(): SpeechScope {
  return globalThis as unknown as SpeechScope
}

function pickEnglishVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  if (voices.length === 0) return null
  const normalized = (voice: SpeechSynthesisVoice) => voice.lang?.toLowerCase() ?? ''
  return (
    voices.find((voice) => normalized(voice).startsWith('en-us')) ??
    voices.find((voice) => normalized(voice).startsWith('en')) ??
    voices.find((voice) => voice.default) ??
    voices[0]
  )
}

/**
 * Cria o reprodutor baseado em síntese de voz.
 *
 * `scope` é injetável para testes; por padrão lê o `globalThis` do navegador.
 */
export function createSpeechPlayer(scope: SpeechScope = resolveScope()): AudioPlayer {
  const synth = scope.speechSynthesis
  const Utterance = scope.SpeechSynthesisUtterance
  const supported = Boolean(synth && Utterance)

  let prepared = false
  let voice: SpeechSynthesisVoice | null = null

  return {
    supported,

    prepare() {
      if (!supported || prepared || !synth || !Utterance) return
      prepared = true
      try {
        voice = pickEnglishVoice(synth)
        // Utterance silencioso dentro do gesto do usuário: "desbloqueia" a
        // síntese em navegadores com restrição de autoplay (ex.: Chrome).
        const primer = new Utterance(' ')
        primer.volume = 0
        primer.rate = 2
        synth.speak(primer)
      } catch (error) {
        reportAudioFailure('prepare', error)
      }
    },

    play(message) {
      if (!supported || !synth || !Utterance) return
      try {
        if (!voice) voice = pickEnglishVoice(synth)
        const utterance = new Utterance(message)
        utterance.lang = 'en-US'
        utterance.rate = 1
        utterance.pitch = 1
        utterance.volume = 1
        if (voice) utterance.voice = voice
        synth.speak(utterance)
      } catch (error) {
        reportAudioFailure('play', error)
      }
    },

    dispose() {
      try {
        synth?.cancel()
      } catch (error) {
        reportAudioFailure('dispose', error)
      }
    },
  }
}

/** Reprodutor inerte — usado quando o áudio não está disponível. */
export function createSilentPlayer(): AudioPlayer {
  return {
    supported: false,
    prepare() {},
    play() {},
    dispose() {},
  }
}
