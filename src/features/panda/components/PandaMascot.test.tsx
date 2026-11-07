// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PandaMascot } from './PandaMascot'
import type { PandaState } from '../domain/pandaTypes'

afterEach(cleanup)

const STATES: PandaState[] = [
  'welcome',
  'ready',
  'rest',
  'encouraging',
  'celebrating',
  'streak',
  'idle',
]

describe('PandaMascot', () => {
  it('renderiza todos os estados de personalidade', () => {
    for (const state of STATES) {
      const { container, unmount } = render(<PandaMascot state={state} />)

      expect(container.querySelector('svg')).not.toBeNull()
      unmount()
    }
  })

  it('expõe um rótulo acessível quando informado', () => {
    render(<PandaMascot state="celebrating" label="Panda comemorando" />)

    expect(screen.getByRole('img', { name: 'Panda comemorando' })).toBeDefined()
  })

  it('mantém o mesmo personagem em todos os estados', () => {
    for (const state of STATES) {
      const { container, unmount } = render(<PandaMascot state={state} />)
      const svg = container.querySelector('svg') as SVGElement

      // O personagem é único: orelhas, manchas, focinho e pulseira existem em
      // qualquer estado — é o que garante a consistência visual.
      const ears = [...svg.querySelectorAll('circle')].filter(
        (circle) => circle.getAttribute('r') === '9',
      )
      expect(ears).toHaveLength(2) // orelhas pretas

      const blackEllipses = [...svg.querySelectorAll('ellipse')].filter(
        (ellipse) => ellipse.getAttribute('fill') === '#1b211f',
      )
      expect(blackEllipses).toHaveLength(3) // manchas dos olhos + nariz

      const head = [...svg.querySelectorAll('ellipse')].filter(
        (ellipse) => ellipse.getAttribute('fill') === '#f4f7f5',
      )
      expect(head).toHaveLength(1) // cabeça

      const bracelet = [...svg.querySelectorAll('circle')].filter(
        (circle) => circle.getAttribute('stroke') === '#2fe06b',
      )
      expect(bracelet).toHaveLength(1) // pulseira esportiva

      unmount()
    }
  })
})
