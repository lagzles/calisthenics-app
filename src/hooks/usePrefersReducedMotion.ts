import { useEffect, useState } from 'react'

/**
 * Detecta a preferência do sistema por movimento reduzido.
 *
 * Usado pelo player de demonstrações: quando o usuário pede menos movimento,
 * a demo não anima e o panda é apresentado de forma estática, com a
 * description por fases.
 *
 * O `global.css` já zera animações CSS em `prefers-reduced-motion`; este hook
 * cobre o que é dirigido por `requestAnimationFrame`.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matches(QUERY))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(QUERY)
    const update = () => setReduced(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}
