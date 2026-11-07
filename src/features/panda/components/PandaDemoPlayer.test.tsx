// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PandaDemoPlayer } from './PandaDemoPlayer'
import { PANDA_DEMOS } from '../domain/pandaDemos'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function stubReducedMotion(enabled: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: enabled && query.includes('reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

describe('PandaDemoPlayer', () => {
  it('apresenta o personagem e o rótulo da fase inicial', () => {
    render(<PandaDemoPlayer track={PANDA_DEMOS.squat} title="Agachamento livre" />)

    expect(screen.getByRole('img', { name: /Agachamento livre/ })).toBeDefined()
    expect(screen.getByText('Posição inicial')).toBeDefined()
  })

  it('inicia, pausa e retoma a demonstração', () => {
    render(<PandaDemoPlayer track={PANDA_DEMOS.squat} />)

    const button = screen.getByRole('button', { name: /Iniciar demonstração/ })
    expect(button.getAttribute('aria-label')).toBe('Iniciar demonstração')

    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Pausar demonstração' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Pausar demonstração' }))
    expect(
      screen.getByRole('button', { name: /Iniciar demonstração|Retomar demonstração/ }),
    ).toBeDefined()
  })

  it('repeti a demonstração desde o início', () => {
    render(<PandaDemoPlayer track={PANDA_DEMOS.squat} />)

    fireEvent.click(screen.getByRole('button', { name: /Iniciar demonstração/ }))
    expect(screen.getByRole('button', { name: 'Pausar demonstração' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /Repetir demonstração/ }))
    expect(screen.getByRole('button', { name: 'Pausar demonstração' })).toBeDefined()
  })

  it('não oferece controles quando hideControls está ativo', () => {
    render(<PandaDemoPlayer track={PANDA_DEMOS.squat} hideControls />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('substitui a animação pela alternativa estática com movimento reduzido', () => {
    stubReducedMotion(true)

    render(<PandaDemoPlayer track={PANDA_DEMOS.squat} />)

    expect(screen.getByText(/Movimento reduzido ativo/)).toBeDefined()
    // Uma figura estática por fase, com o mesmo rótulo da demonstração.
    expect(screen.getAllByText('Posição inicial').length).toBeGreaterThan(0)
    expect(screen.getByText('Descida')).toBeDefined()
    expect(screen.getByText('Posição baixa')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
