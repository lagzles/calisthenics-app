import { describe, expect, it } from 'vitest'
import {
  angleBetween,
  dirVector,
  distance,
  easeInOutCubic,
  lerp,
  lerpPose,
  PANDA_FLOOR_Y,
  PANDA_SEGMENTS,
  PANDA_VIEWBOX,
  solveArmIK,
  solveSkeleton,
  step,
} from './poseMath'
import { makePose, STAND } from './pandaPoses'

describe('dirVector', () => {
  it('segue a convenção: 0 aponta para baixo, 90 para a direita e 180 para cima', () => {
    expect(dirVector(0).x).toBeCloseTo(0)
    expect(dirVector(0).y).toBeCloseTo(1)

    expect(dirVector(90).x).toBeCloseTo(1)
    expect(dirVector(90).y).toBeCloseTo(0)

    expect(dirVector(180).x).toBeCloseTo(0)
    expect(dirVector(180).y).toBeCloseTo(-1)
  })
})

describe('angleBetween', () => {
  it('mede o ângulo de um vetor na convenção do rig', () => {
    const origin = { x: 100, y: 100 }
    expect(angleBetween(origin, { x: 100, y: 130 })).toBeCloseTo(0)
    expect(angleBetween(origin, { x: 130, y: 100 })).toBeCloseTo(90)
    expect(angleBetween(origin, { x: 100, y: 70 })).toBeCloseTo(180)
  })
})

describe('step', () => {
  it('avança na direção do ângulo pelo comprimento informado', () => {
    expect(step({ x: 10, y: 10 }, 90, 5)).toEqual({ x: 15, y: 10 })
    expect(step({ x: 10, y: 10 }, 0, 5)).toEqual({ x: 10, y: 15 })
  })
})

describe('lerp e easing', () => {
  it('interpola linearmente entre dois valores', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(lerp(0, 10, 1)).toBe(10)
  })

  it('suaviza as extremities do movimento', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
  })
})

describe('lerpPose', () => {
  it('interpola todos os campos da pose', () => {
    const a = makePose({ armFront: [0, 0], legFront: [0, 0] })
    const b = makePose({ armFront: [100, 80], legFront: [60, 40], torso: 140 })

    const mid = lerpPose(a, b, 0.5)

    expect(mid.shoulderFront).toBe(50)
    expect(mid.elbowFront).toBe(40)
    expect(mid.hipFront).toBe(30)
    expect(mid.kneeFront).toBe(20)
    expect(mid.torso).toBe(160)
  })
})

describe('solveSkeleton', () => {
  it('mantém o comprimento dos segmentos constante — o panda nunca estica', () => {
    const skeleton = solveSkeleton(STAND)

    expect(distance(skeleton.shoulderFront, skeleton.elbowFront)).toBeCloseTo(
      PANDA_SEGMENTS.upperArm,
    )
    expect(distance(skeleton.elbowFront, skeleton.handFront)).toBeCloseTo(PANDA_SEGMENTS.forearm)
    expect(distance(skeleton.hipFront, skeleton.kneeFront)).toBeCloseTo(PANDA_SEGMENTS.thigh)
    expect(distance(skeleton.kneeFront, skeleton.footFront)).toBeCloseTo(PANDA_SEGMENTS.shin)
    expect(distance(skeleton.pelvis, skeleton.neck)).toBeCloseTo(PANDA_SEGMENTS.torso)
  })

  it('mantém as juntas dentro do palco em pé', () => {
    const skeleton = solveSkeleton(STAND)
    const points = [
      skeleton.pelvis,
      skeleton.neck,
      skeleton.head,
      skeleton.elbowFront,
      skeleton.handFront,
      skeleton.kneeFront,
      skeleton.footFront,
    ]

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(PANDA_VIEWBOX.width)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(PANDA_VIEWBOX.height)
    }
  })

  it('apoya os pés no piso quando o panda está em pé', () => {
    const skeleton = solveSkeleton(STAND)
    expect(skeleton.footFront.y).toBeCloseTo(PANDA_FLOOR_Y, 0)
  })
})

describe('solveArmIK', () => {
  it('leva a mão ao ponto informado e mantém o cotovelo abaixo', () => {
    const shoulder = { x: 100, y: 80 }
    const hand = { x: 130, y: 110 }

    const solved = solveArmIK(shoulder, hand)
    const elbow = step(shoulder, solved.shoulder, PANDA_SEGMENTS.upperArm)

    expect(distance(elbow, hand)).toBeCloseTo(PANDA_SEGMENTS.forearm)
    expect(distance(shoulder, elbow)).toBeCloseTo(PANDA_SEGMENTS.upperArm)
    expect(elbow.y).toBeGreaterThan(shoulder.y)
  })

  it('rejeita uma mão fora do alcance do braço', () => {
    expect(() => solveArmIK({ x: 100, y: 80 }, { x: 100, y: 200 })).toThrow(/alcance/)
  })
})
