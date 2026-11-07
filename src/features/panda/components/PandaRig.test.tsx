// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PandaRig } from './PandaRig'
import { solveSkeleton } from '../domain/poseMath'
import { STAND } from '../domain/pandaPoses'

afterEach(cleanup)

describe('PandaRig', () => {
  it('desenha o personagem-base: cabeça, manchas, focinho e pulseira', () => {
    const { container } = render(<PandaRig skeleton={solveSkeleton(STAND)} />)
    const svg = container.querySelector('svg') as SVGElement

    // Orelhas, olhos, nariz e pulsoira: os elementos que definem o panda.
    const circles = svg.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(5)

    // Focinho e manchas dos olhos.
    const ellipses = svg.querySelectorAll('ellipse')
    expect(ellipses.length).toBeGreaterThanOrEqual(5)

    // A pulseira esportiva verde é o acessório que identifica o personagem.
    const bracelet = [...circles].find((circle) => circle.getAttribute('stroke') === '#2fe06b')
    expect(bracelet).toBeDefined()
  })

  it('não usa recursos externos (SVG inline, offline por construção)', () => {
    const { container } = render(<PandaRig skeleton={solveSkeleton(STAND)} />)
    const svg = container.querySelector('svg') as SVGElement

    // Nenhuma referência a rede: nem imagens, nem href, nem url() externa.
    expect(svg.querySelector('image')).toBeNull()
    expect(svg.querySelectorAll('[href]')).toHaveLength(0)
    expect(container.innerHTML).not.toMatch(/url\(['"]?https?:/)
  })

  it('recebe um enquadramento próprio da câmera', () => {
    const { container } = render(
      <PandaRig skeleton={solveSkeleton(STAND)} viewBox={{ x: 10, y: 20, width: 100, height: 120 }} />,
    )
    const svg = container.querySelector('svg') as SVGElement

    expect(svg.getAttribute('viewBox')).toBe('10 20 100 120')
  })
})
