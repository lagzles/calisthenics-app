import { describe, expect, it } from 'vitest'
import type { WorkoutEvent, WorkoutEventType } from '../domain/types'
import type { AudioPlayer } from './speechPlayer'
import { createWorkoutAudio } from './workoutAudio'

const NOW = Date.parse('2026-01-01T10:00:00.000Z')

function event(type: WorkoutEventType, at: number = NOW): WorkoutEvent {
  return { type, at, exerciseIndex: 0, set: 1 }
}

function createFakePlayer(supported = true) {
  const played: string[] = []
  let preparedCount = 0
  const player: AudioPlayer = {
    supported,
    prepare() {
      preparedCount += 1
    },
    play(message) {
      played.push(message)
    },
    dispose() {},
  }
  return {
    player,
    played,
    get preparedCount() {
      return preparedCount
    },
  }
}

describe('workoutAudio', () => {
  it('prepara o áudio delegando ao reprodutor', () => {
    const fake = createFakePlayer()
    const audio = createWorkoutAudio({ player: fake.player, now: () => NOW })
    audio.prepare()
    expect(fake.preparedCount).toBe(1)
  })

  it('reproduz a mensagem correta em cada transição', () => {
    const fake = createFakePlayer()
    const audio = createWorkoutAudio({ player: fake.player, now: () => NOW })

    audio.handleEvents([event('rest-started')])
    audio.handleEvents([event('rest-ended')])
    audio.handleEvents([event('exercise-completed')])
    audio.handleEvents([event('workout-completed')])

    expect(fake.played).toEqual(['Rest!', "Let's go!", 'Exercise complete!', 'Workout complete!'])
  })

  it('não reproduz nada em transições de início', () => {
    const fake = createFakePlayer()
    const audio = createWorkoutAudio({ player: fake.player, now: () => NOW })
    audio.handleEvents([event('workout-started'), event('set-started')])
    expect(fake.played).toEqual([])
  })

  it('não reproduz mensagens atrasadas após recuperação', () => {
    const fake = createFakePlayer()
    const audio = createWorkoutAudio({ player: fake.player, now: () => NOW })
    audio.handleEvents([event('rest-started', NOW - 120_000)])
    expect(fake.played).toEqual([])
  })

  it('trata a indisponibilidade de áudio sem quebrar o treino', () => {
    const fake = createFakePlayer(false)
    const audio = createWorkoutAudio({ player: fake.player, now: () => NOW })

    expect(audio.supported).toBe(false)
    expect(() => audio.handleEvents([event('rest-started')])).not.toThrow()
  })
})
