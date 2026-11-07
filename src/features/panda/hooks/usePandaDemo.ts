import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoTrack } from '../domain/pandaTypes'
import { resolveTrack } from '../domain/timeline'

/**
 * Reprodução de uma demonstração do panda.
 *
 * O tempo é **acumulado**: só avança enquanto está tocando. Pausar congela a
 * pose exatamente onde parou e "Reproduzir" volta ao início — o comportamento
 * esperado de um player de vídeo, mas sem dependência de mídia.
 *
 * A renderização é limitada a ~30 quadros por segundo: os movimentos
 * demonstrados levam meio segundo ou mais, então 30 fps são suficientes e
 * custam metade do trabalho de renderização em aparelhos móveis.
 */

const FRAME_INTERVAL_MS = 1000 / 30

export interface UsePandaDemoOptions {
  /** Começa tocando assim que o componente aparece. */
  autoPlay?: boolean
  /** Desliga a animação (movimento reduzido) — a pose fica estática. */
  reducedMotion?: boolean
  /** Congela a animação sem alterar a intenção de reprodução. */
  paused?: boolean
}

export interface PandaDemoPlayback {
  /** Pose atual do personagem. */
  pose: ReturnType<typeof resolveTrack>['pose']
  /** Fase atual da demonstração. */
  phase: ReturnType<typeof resolveTrack>['phase']
  /** Progresso do ciclo (0–1). */
  progress: number
  isPlaying: boolean
  /** Instante dentro do ciclo, em ms. */
  elapsedMs: number
  play: () => void
  pause: () => void
  toggle: () => void
  /** Reinicia a demonstração do início. */
  replay: () => void
}

export function usePandaDemo(
  track: DemoTrack,
  options: UsePandaDemoOptions = {},
): PandaDemoPlayback {
  const { autoPlay = false, reducedMotion = false, paused = false } = options

  const [isPlaying, setIsPlaying] = useState(autoPlay && !reducedMotion)
  const [elapsedMs, setElapsedMs] = useState(0)

  const elapsedRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const lastRenderRef = useRef(0)

  // Ao trocar de demonstração, o tempo volta ao início. O estado é zerado no
  // próximo quadro do próprio loop (sem `setState` dentro de efeito); os
  // consumidores também usam `key={track.key}`, o que remonta o componente e
  // garante o recomeço limpo.
  useEffect(() => {
    elapsedRef.current = 0
    lastFrameRef.current = 0
    lastRenderRef.current = 0
  }, [track])

  useEffect(() => {
    if (!isPlaying || reducedMotion || paused) return

    let cancelled = false

    const step = (now: number) => {
      if (cancelled) return

      const delta = now - (lastFrameRef.current || now)
      lastFrameRef.current = now
      elapsedRef.current += delta

      if (track.loop) {
        if (elapsedRef.current >= track.duration) {
          elapsedRef.current -= track.duration
        }
      } else if (elapsedRef.current >= track.duration) {
        elapsedRef.current = track.duration
        lastRenderRef.current = now
        setElapsedMs(elapsedRef.current)
        setIsPlaying(false)
        return
      }

      if (now - lastRenderRef.current >= FRAME_INTERVAL_MS) {
        lastRenderRef.current = now
        setElapsedMs(elapsedRef.current)
      }

      frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      cancelled = true
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [isPlaying, reducedMotion, paused, track])

  const play = useCallback(() => {
    if (reducedMotion) return
    setIsPlaying(true)
  }, [reducedMotion])

  const pause = useCallback(() => setIsPlaying(false), [])

  const toggle = useCallback(() => {
    if (reducedMotion) return
    setIsPlaying((current) => !current)
  }, [reducedMotion])

  const replay = useCallback(() => {
    elapsedRef.current = 0
    lastFrameRef.current = 0
    setElapsedMs(0)
    if (!reducedMotion) setIsPlaying(true)
  }, [reducedMotion])

  const resolved = resolveTrack(track, elapsedMs)

  return {
    pose: resolved.pose,
    phase: resolved.phase,
    progress: resolved.progress,
    isPlaying: isPlaying && !reducedMotion && !paused,
    elapsedMs,
    play,
    pause,
    toggle,
    replay,
  }
}
