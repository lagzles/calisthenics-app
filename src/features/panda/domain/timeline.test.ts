import { describe, expect, it } from 'vitest'
import { PANDA_DEMOS } from './pandaDemos'
import { normalizeElapsed, phaseAt, poseAt, poseOfPhase, resolveTrack } from './timeline'
import { makePose } from './pandaPoses'
import type { DemoTrack } from './pandaTypes'

const track: DemoTrack = {
  key: 'teste',
  label: 'Teste',
  duration: 1000,
  loop: false,
  keyframes: [
    { t: 0, pose: makePose({ armFront: [0, 0] }) },
    { t: 500, pose: makePose({ armFront: [100, 100] }) },
    { t: 1000, pose: makePose({ armFront: [0, 0] }) },
  ],
  phases: [
    { id: 'a', label: 'A', from: 0, to: 500 },
    { id: 'b', label: 'B', from: 500, to: 1000 },
  ],
}

describe('normalizeElapsed', () => {
  it('limita ao ciclo quando a track não repete', () => {
    expect(normalizeElapsed(track, -100)).toBe(0)
    expect(normalizeElapsed(track, 500)).toBe(500)
    expect(normalizeElapsed(track, 5000)).toBe(1000)
  })

  it('recomeça o ciclo quando a track repete', () => {
    const looping = { ...track, loop: true }
    expect(normalizeElapsed(looping, 1250)).toBe(250)
    expect(normalizeElapsed(looping, 1000)).toBe(0)
  })
})

describe('poseAt', () => {
  it('devolve exatamente a pose dos keyframes', () => {
    expect(poseAt(track, 0).shoulderFront).toBe(0)
    expect(poseAt(track, 500).shoulderFront).toBe(100)
    expect(poseAt(track, 1000).shoulderFront).toBe(0)
  })

  it('interpola entre dois keyframes', () => {
    const mid = poseAt(track, 250)
    expect(mid.shoulderFront).toBeGreaterThan(0)
    expect(mid.shoulderFront).toBeLessThan(100)
  })
})

describe('phaseAt', () => {
  it('identifica a fase que contém o instante', () => {
    expect(phaseAt(track, 0).id).toBe('a')
    expect(phaseAt(track, 499).id).toBe('a')
    expect(phaseAt(track, 500).id).toBe('b')
    expect(phaseAt(track, 999).id).toBe('b')
  })
})

describe('resolveTrack', () => {
  it('devolve pose, fase e progresso coerentes', () => {
    const resolved = resolveTrack(track, 750)

    expect(resolved.phase.id).toBe('b')
    expect(resolved.progress).toBeCloseTo(0.75)
    expect(resolved.pose.shoulderFront).toBeGreaterThan(0)
  })
})

describe('poseOfPhase', () => {
  it('devolve a pose estática do início da fase', () => {
    expect(poseOfPhase(track, track.phases[0]).shoulderFront).toBe(0)
    expect(poseOfPhase(track, track.phases[1]).shoulderFront).toBe(100)
  })
})

describe('tracks reais', () => {
  it('resolvem a pose e a fase em qualquer instante do ciclo', () => {
    for (const demo of Object.values(PANDA_DEMOS)) {
      for (const elapsed of [0, demo.duration / 4, demo.duration / 2, demo.duration - 1]) {
        const resolved = resolveTrack(demo, elapsed)
        expect(resolved.phase.label.length).toBeGreaterThan(0)
        expect(Number.isFinite(resolved.pose.pelvisX)).toBe(true)
        expect(Number.isFinite(resolved.pose.kneeFront)).toBe(true)
      }
    }
  })
})
