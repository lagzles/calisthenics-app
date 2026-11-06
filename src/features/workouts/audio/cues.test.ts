import { describe, expect, it } from 'vitest'
import type { WorkoutEvent, WorkoutEventType } from '../domain/types'
import { AUDIO_CUE_MESSAGES, cuesForEvents } from './cues'

const NOW = Date.parse('2026-01-01T10:00:00.000Z')

function event(type: WorkoutEventType, at: number = NOW, set = 1): WorkoutEvent {
  return { type, at, exerciseIndex: 0, set }
}

describe('cuesForEvents — mapeamento das transições', () => {
  it('mapeia cada transição para a mensagem correta', () => {
    expect(cuesForEvents([event('rest-started')], { now: NOW })).toEqual(['rest'])
    expect(cuesForEvents([event('rest-ended')], { now: NOW })).toEqual(['letsGo'])
    expect(cuesForEvents([event('exercise-completed')], { now: NOW })).toEqual(['exerciseComplete'])
    expect(cuesForEvents([event('workout-completed')], { now: NOW })).toEqual(['workoutComplete'])
  })

  it('expõe as mensagens faladas esperadas', () => {
    expect(AUDIO_CUE_MESSAGES.rest).toBe('Rest!')
    expect(AUDIO_CUE_MESSAGES.letsGo).toBe("Let's go!")
    expect(AUDIO_CUE_MESSAGES.exerciseComplete).toBe('Exercise complete!')
    expect(AUDIO_CUE_MESSAGES.workoutComplete).toBe('Workout complete!')
  })

  it('não anuncia transições de início, pausa ou navegação', () => {
    const events = [
      event('workout-started'),
      event('exercise-started'),
      event('set-started'),
      event('workout-paused'),
      event('workout-resumed'),
      event('workout-abandoned'),
      event('rest-extended'),
    ]
    expect(cuesForEvents(events, { now: NOW })).toEqual([])
  })

  it('preserva a ordem das transições dentro da janela de anúncio', () => {
    const events = [event('rest-started', NOW), event('rest-ended', NOW + 1500)]
    expect(cuesForEvents(events, { now: NOW + 1500 })).toEqual(['rest', 'letsGo'])
  })

  it('anuncia apenas as transições recentes de um lote reconciliado', () => {
    const events = [event('rest-started', NOW), event('rest-ended', NOW + 60_000)]
    expect(cuesForEvents(events, { now: NOW + 60_000 })).toEqual(['letsGo'])
  })
})

describe('cuesForEvents — regras de reprodução', () => {
  it('não duplica avisos iguais e consecutivos', () => {
    const events = [event('exercise-completed'), event('exercise-completed')]
    expect(cuesForEvents(events, { now: NOW })).toEqual(['exerciseComplete'])
  })

  it('ignora eventos atrasados (recuperação em segundo plano)', () => {
    const stale = event('rest-started', NOW - 60_000)
    expect(cuesForEvents([stale], { now: NOW })).toEqual([])
  })

  it('respeita a idade máxima informada', () => {
    const events = [event('rest-started', NOW - 3000)]
    expect(cuesForEvents(events, { now: NOW, maxAgeMs: 5000 })).toEqual(['rest'])
    expect(cuesForEvents(events, { now: NOW, maxAgeMs: 1000 })).toEqual([])
  })

  it('suprime "Exercise complete!" quando o treino termina no mesmo lote', () => {
    const events = [event('exercise-completed'), event('workout-completed')]
    expect(cuesForEvents(events, { now: NOW })).toEqual(['workoutComplete'])
  })
})
