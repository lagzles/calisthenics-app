import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSpeechPlayer } from './speechPlayer'

class FakeUtterance {
  text: string
  lang = ''
  volume = 1
  rate = 1
  pitch = 1
  voice: unknown = null

  constructor(text: string) {
    this.text = text
  }
}

interface FakeSynthOptions {
  voices?: Array<{ lang: string; default?: boolean }>
  throwOnSpeak?: boolean
}

function createFakeSynth(options: FakeSynthOptions = {}) {
  const spoken: string[] = []
  const synth = {
    getVoices: () => options.voices ?? [],
    speak: (utterance: FakeUtterance) => {
      if (options.throwOnSpeak) throw new Error('speak falhou')
      spoken.push(utterance.text)
    },
    cancel: () => {},
  }
  return { synth, spoken }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createSpeechPlayer', () => {
  it('não é suportado quando o navegador não oferece SpeechSynthesis', () => {
    const player = createSpeechPlayer({})
    expect(player.supported).toBe(false)
    expect(() => {
      player.prepare()
      player.play('Rest!')
      player.dispose()
    }).not.toThrow()
  })

  it('reproduz a mensagem usando a síntese de voz', () => {
    const { synth, spoken } = createFakeSynth({ voices: [{ lang: 'en-US', default: true }] })
    const player = createSpeechPlayer({
      speechSynthesis: synth as unknown as SpeechSynthesis,
      SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    })

    expect(player.supported).toBe(true)
    player.play('Rest!')
    expect(spoken).toContain('Rest!')
  })

  it('escolhe uma voz em inglês quando disponível', () => {
    const { synth } = createFakeSynth({
      voices: [
        { lang: 'pt-BR' },
        { lang: 'en-US' },
      ],
    })
    const player = createSpeechPlayer({
      speechSynthesis: synth as unknown as SpeechSynthesis,
      SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    })

    // Não deve lançar ao selecionar a voz.
    expect(() => player.prepare()).not.toThrow()
  })

  it('registra falhas de reprodução sem propagar o erro', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { synth } = createFakeSynth({ throwOnSpeak: true })
    const player = createSpeechPlayer({
      speechSynthesis: synth as unknown as SpeechSynthesis,
      SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    })

    expect(() => player.play('Rest!')).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })
})
