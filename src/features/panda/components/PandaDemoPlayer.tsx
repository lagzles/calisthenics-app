import { PauseIcon, PlayIcon, ReplayIcon } from '../../../components/ui/icons'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import type { DemoTrack } from '../domain/pandaTypes'
import { computeViewBox, solveSkeleton } from '../domain/poseMath'
import { usePandaDemo } from '../hooks/usePandaDemo'
import { PandaRig } from './PandaRig'
import { PandaStaticSteps } from './PandaStaticSteps'
import styles from './PandaDemoPlayer.module.css'

/**
 * Player da demonstração instrutiva.
 *
 * O panda executa o movimento e o rótulo da fase acompanha a pose — é isso
 * que transforma a animação em **ensino**, e não em decoração. O controle
 * permite pausar, retomar e reproduzir novamente; com a preferência por
 * movimento reduzido, a animação é substituída pela alternativa estática por
 * fases.
 */

interface PandaDemoPlayerProps {
  track: DemoTrack
  /** Começa tocando assim que o componente aparece. */
  autoPlay?: boolean
  /** Congela a animação (ex.: enquanto o treino está pausado). */
  paused?: boolean
  className?: string
  /** Nome do exercício, usado no rótulo acessível. */
  title?: string
  /** Oculta os controles (ex.: quando o player é puramente decorativo). */
  hideControls?: boolean
  /** Controles compactos (só ícones) e sem barra de progresso. */
  compact?: boolean
}

export function PandaDemoPlayer({
  track,
  autoPlay = false,
  paused = false,
  className,
  title,
  hideControls = false,
  compact = false,
}: PandaDemoPlayerProps) {
  const reducedMotion = usePrefersReducedMotion()
  const playback = usePandaDemo(track, { autoPlay, reducedMotion, paused })

  const skeleton = solveSkeleton(playback.pose)

  // A câmera cobre todos os keyframes da demonstração: o personagem não dá
  // zoom durante o movimento e cada exercício preenche o palco do mesmo jeito.
  const viewBox = computeViewBox(track.keyframes.map((frame) => solveSkeleton(frame.pose)))

  return (
    <div
      className={[styles.player, compact && styles.compact, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.stage}>
        <PandaRig
          skeleton={skeleton}
          prop={track.prop}
          viewBox={viewBox}
          className={styles.rig}
          title={title ? `${title} — demonstração` : undefined}
        />
      </div>

      <p className={styles.phase} role="status">
        {playback.phase.label}
      </p>

      {!reducedMotion && !compact && (
        <div className={styles.progressTrack} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{ width: `${Math.round(playback.progress * 100)}%` }}
          />
        </div>
      )}

      {reducedMotion ? (
        <>
          <p className={styles.note}>
            Movimento reduzido ativo — a demonstração é apresentada passo a passo.
          </p>
          <PandaStaticSteps track={track} />
        </>
      ) : (
        !hideControls && (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.control}
              onClick={playback.toggle}
              aria-label={
                playback.isPlaying
                  ? 'Pausar demonstração'
                  : playback.elapsedMs === 0
                    ? 'Iniciar demonstração'
                    : 'Retomar demonstração'
              }
            >
              {playback.isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
              {!compact && (
                <span>
                  {playback.isPlaying
                    ? 'Pausar'
                    : playback.elapsedMs === 0
                      ? 'Iniciar'
                      : 'Retomar'}
                </span>
              )}
            </button>

            <button
              type="button"
              className={styles.control}
              onClick={playback.replay}
              aria-label="Repetir demonstração desde o início"
            >
              <ReplayIcon size={18} />
              {!compact && <span>Repetir</span>}
            </button>
          </div>
        )
      )}
    </div>
  )
}
