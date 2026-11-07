import { poseOfPhase } from '../domain/timeline'
import { computeViewBox, solveSkeleton } from '../domain/poseMath'
import type { DemoTrack } from '../domain/pandaTypes'
import { PandaRig } from './PandaRig'
import styles from './PandaDemoPlayer.module.css'

/**
 * Alternativa estática da demonstração.
 *
 * Usada quando o sistema pede movimento reduzido: em vez de animar, o panda
 * é apresentado em cada fase do movimento, uma figura estática por fase, com
 * o mesmo rótulo. O usuário entende o movimento sem que nada se mova.
 */
export function PandaStaticSteps({ track }: { track: DemoTrack }) {
  // A mesma câmera da demonstração animada, para que as figuras estáticas
  // fiquem exatamente no lugar de onde a animação saiu.
  const viewBox = computeViewBox(track.keyframes.map((frame) => solveSkeleton(frame.pose)))

  return (
    <ol className={styles.steps}>
      {track.phases.map((phase) => (
        <li key={phase.id} className={styles.step}>
          <span className={styles.stepFigure}>
            <PandaRig
              skeleton={solveSkeleton(poseOfPhase(track, phase))}
              prop={track.prop}
              viewBox={viewBox}
              className={styles.stepRig}
            />
          </span>
          <span className={styles.stepLabel}>{phase.label}</span>
        </li>
      ))}
    </ol>
  )
}
