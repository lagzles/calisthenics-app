import type { PandaExpression, PandaState } from '../domain/pandaTypes'
import { computeViewBox, solveSkeleton } from '../domain/poseMath'
import {
  CELEBRATE,
  ENCOURAGE,
  READY,
  REST,
  STAND,
  STREAK,
  WAVE,
} from '../domain/pandaPoses'
import { PandaRig } from './PandaRig'
import styles from './Panda.module.css'

/**
 * O mascote panda em modo "personalidade".
 *
 * Recebe **apenas o estado** e devolve a ilustração correspondente — a
 * apresentação fica desacoplada da lógica de treino. Os sete estados cobrem
 * os momentos de interação: saudação, prontidão, descanso, incentivo,
 * comemoração, sequência e espera.
 */

export type PandaMascotSize = 'sm' | 'md' | 'lg' | 'xl' | 'stage'

interface MascotPreset {
  pose: typeof STAND
  expression: PandaExpression
  /** Classe de animação leve aplicada ao contenedor. */
  motion: string
}

const MASCOT_PRESETS: Record<PandaState, MascotPreset> = {
  welcome: { pose: WAVE, expression: 'happy', motion: styles.wave },
  ready: { pose: READY, expression: 'focused', motion: styles.bounce },
  rest: { pose: REST, expression: 'closed', motion: styles.breathe },
  encouraging: { pose: ENCOURAGE, expression: 'happy', motion: styles.bounce },
  celebrating: { pose: CELEBRATE, expression: 'happy', motion: styles.celebrate },
  streak: { pose: STREAK, expression: 'happy', motion: styles.bounce },
  idle: { pose: STAND, expression: 'neutral', motion: styles.breathe },
}

interface PandaMascotProps {
  state: PandaState
  size?: PandaMascotSize
  className?: string
  /** Rótulo acessível (ex.: "Panda comemorando"). */
  label?: string
}

export function PandaMascot({ state, size = 'md', className, label }: PandaMascotProps) {
  const preset = MASCOT_PRESETS[state]
  const skeleton = solveSkeleton(preset.pose)
  // Cada estado tem o seu enquadramento: o panda ocupa bem o espaço
  // disponível, sem ficar minúsculo dentro de um palco vazio.
  const viewBox = computeViewBox([skeleton], 4)

  return (
    <div
      className={[styles.mascot, styles[size], preset.motion, className].filter(Boolean).join(' ')}
    >
      <PandaRig
        skeleton={skeleton}
        expression={preset.expression}
        viewBox={viewBox}
        className={styles.rig}
        title={label}
      />
    </div>
  )
}
