import { describe, expect, it } from 'vitest'
import { EXERCISE_ILLUSTRATION_KEYS } from '../../workouts/exerciseIllustrationKeys'
import { PANDA_DEMOS, PANDA_DEMO_LIST, getPandaDemo } from './pandaDemos'
import { solveSkeleton } from './poseMath'
import { PANDA_FLOOR_Y, PANDA_VIEWBOX } from './poseMath'

describe('PANDA_DEMOS', () => {
  it('tem uma demonstração para cada movimento do catálogo', () => {
    for (const key of EXERCISE_ILLUSTRATION_KEYS) {
      expect(PANDA_DEMOS[key]).toBeDefined()
      expect(getPandaDemo(key)).toBe(PANDA_DEMOS[key])
    }
  })

  it('não cria movimentos fora da taxonomia existente', () => {
    for (const demo of PANDA_DEMO_LIST) {
      expect(EXERCISE_ILLUSTRATION_KEYS).toContain(demo.key)
    }
  })

  it('mantém os keyframes ordenados e dentro da duração', () => {
    for (const demo of PANDA_DEMO_LIST) {
      expect(demo.keyframes.length).toBeGreaterThanOrEqual(3)
      expect(demo.duration).toBeGreaterThan(0)

      demo.keyframes.forEach((frame, index) => {
        expect(frame.t).toBeGreaterThanOrEqual(0)
        expect(frame.t).toBeLessThanOrEqual(demo.duration)

        if (index > 0) {
          expect(frame.t).toBeGreaterThan(demo.keyframes[index - 1].t)
        }
      })
    }
  })

  it('cobre todas as fases do ciclo, sem buracos', () => {
    for (const demo of PANDA_DEMO_LIST) {
      expect(demo.phases.length).toBeGreaterThanOrEqual(4)
      expect(demo.phases[0].from).toBe(0)
      expect(demo.phases[demo.phases.length - 1].to).toBe(demo.duration)

      for (let i = 1; i < demo.phases.length; i += 1) {
        expect(demo.phases[i].from).toBe(demo.phases[i - 1].to)
      }

      for (const phase of demo.phases) {
        expect(phase.label.length).toBeGreaterThan(0)
        expect(phase.to).toBeGreaterThan(phase.from)
      }
    }
  })

  it('nomeia as fases iniciais e finais exigidas pela especificação', () => {
    for (const demo of PANDA_DEMO_LIST) {
      expect(demo.phases[0].label).toBe('Posição inicial')
      expect(demo.phases[demo.phases.length - 1].label.length).toBeGreaterThan(0)
    }
  })

  it('mantém o personagem dentro do palco em todos os keyframes', () => {
    for (const demo of PANDA_DEMO_LIST) {
      for (const frame of demo.keyframes) {
        const skeleton = solveSkeleton(frame.pose)
        const points = [
          skeleton.pelvis,
          skeleton.neck,
          skeleton.head,
          skeleton.elbowFront,
          skeleton.handFront,
          skeleton.kneeFront,
          skeleton.footFront,
          skeleton.handBack,
          skeleton.footBack,
        ]

        for (const point of points) {
          expect(point.x).toBeGreaterThan(-4)
          expect(point.x).toBeLessThan(PANDA_VIEWBOX.width + 4)
          expect(point.y).toBeGreaterThan(-4)
          expect(point.y).toBeLessThan(PANDA_VIEWBOX.height + 4)
        }
      }
    }
  })

  it('mantém os pés no piso nas posições de apoio', () => {
    const pushup = PANDA_DEMOS['incline-push-up']
    for (const frame of pushup.keyframes) {
      const skeleton = solveSkeleton(frame.pose)
      expect(skeleton.footFront.y).toBeLessThanOrEqual(PANDA_FLOOR_Y + 4)
    }
  })
})
