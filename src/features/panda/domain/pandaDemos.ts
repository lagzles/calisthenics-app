import type { ExerciseIllustrationKey } from '../../workouts/domain/types'
import type { DemoTrack } from './pandaTypes'
import {
  BRIDGE_START,
  BRIDGE_TOP,
  JACK_OPEN,
  JACK_START,
  LEG_RAISE_START,
  LEG_RAISE_TOP,
  PLANK_BREATH,
  PLANK_HOLD,
  PUSHUP_BOTTOM,
  PUSHUP_TOP,
  ROWER_START,
  ROWER_TOP,
  RUN_A,
  RUN_B,
  SQUAT_BOTTOM,
  SQUAT_START,
  WALL_HOLD,
  WALL_STAND,
} from './pandaPoses'

/**
 * Demonstrações instrutivas — uma track por movimento.
 *
 * Cada track percorre as fases do movimento real:
 * **posição inicial → execução → posição final → retorno**. As fases são
 * exibidas junto com a pose, para que a explicação acompanha exatamente o
 * que o panda está fazendo.
 *
 * Movimentos repetidos entre os treinos A e B (a prancha) compartilham a mesma
 * track — coerente com a reutilização já adotada para as ilustrações.
 */

/** Agachamento livre — descida controlada e subida emudiada. */
const SQUAT_TRACK: DemoTrack = {
  key: 'squat',
  label: 'Agachamento livre',
  duration: 2400,
  loop: true,
  keyframes: [
    { t: 0, pose: SQUAT_START },
    { t: 900, pose: SQUAT_BOTTOM },
    { t: 1300, pose: SQUAT_BOTTOM },
    { t: 2300, pose: SQUAT_START },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 500 },
    { id: 'descida', label: 'Descida', from: 500, to: 1000 },
    { id: 'baixa', label: 'Posição baixa', from: 1000, to: 1400 },
    { id: 'subida', label: 'Subida e retorno', from: 1400, to: 2400 },
  ],
}

/** Flexão com apoio — corpo em linha reta, mãos fixas no banco. */
const PUSHUP_TRACK: DemoTrack = {
  key: 'incline-push-up',
  label: 'Flexão com apoio',
  duration: 2600,
  loop: true,
  prop: 'bench',
  keyframes: [
    { t: 0, pose: PUSHUP_TOP },
    { t: 1000, pose: PUSHUP_BOTTOM },
    { t: 1500, pose: PUSHUP_BOTTOM },
    { t: 2400, pose: PUSHUP_TOP },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 600 },
    { id: 'descida', label: 'Descida', from: 600, to: 1100 },
    { id: 'baixa', label: 'Posição baixa', from: 1100, to: 1600 },
    { id: 'empurro', label: 'Empurro e retorno', from: 1600, to: 2600 },
  ],
}

/** Elevação de pelve — extensão de quadril sem arquear a lombar. */
const BRIDGE_TRACK: DemoTrack = {
  key: 'glute-bridge',
  label: 'Elevação de pelve',
  duration: 2600,
  loop: true,
  keyframes: [
    { t: 0, pose: BRIDGE_START },
    { t: 900, pose: BRIDGE_TOP },
    { t: 1500, pose: BRIDGE_TOP },
    { t: 2400, pose: BRIDGE_START },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 500 },
    { id: 'elevacao', label: 'Elevação do quadril', from: 500, to: 1000 },
    { id: 'alta', label: 'Posição alta', from: 1000, to: 1600 },
    { id: 'descida', label: 'Descida controlada', from: 1600, to: 2600 },
  ],
}

/**
 * Prancha — movimento isométrico.
 *
 * A track não simula uma flexão: mostra o alinhamento do corpo e a microvariação
 * da respiração, que é o que realmente acontece durante a isometria.
 */
const PLANK_TRACK: DemoTrack = {
  key: 'plank',
  label: 'Prancha',
  duration: 2400,
  loop: true,
  keyframes: [
    { t: 0, pose: PLANK_HOLD },
    { t: 1200, pose: PLANK_BREATH },
    { t: 2300, pose: PLANK_HOLD },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 500 },
    { id: 'alinhamento', label: 'Alinhamento do corpo', from: 500, to: 1100 },
    { id: 'isometria', label: 'Isometria com respiração', from: 1100, to: 1800 },
    { id: 'retorno', label: 'Manutenção', from: 1800, to: 2400 },
  ],
}

/** Polichinelo — abertura e retorno dos braços e das pernas. */
const JACK_TRACK: DemoTrack = {
  key: 'jumping-jacks',
  label: 'Polichinelo',
  duration: 2200,
  loop: true,
  keyframes: [
    { t: 0, pose: JACK_START },
    { t: 550, pose: JACK_OPEN },
    { t: 1100, pose: JACK_START },
    { t: 1650, pose: JACK_OPEN },
    { t: 2200, pose: JACK_START },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 300 },
    { id: 'abertura', label: 'Abertura', from: 300, to: 850 },
    { id: 'juntos', label: 'Pés juntos', from: 850, to: 1200 },
    { id: 'abertura2', label: 'Abertura', from: 1200, to: 1750 },
    { id: 'juntos2', label: 'Pés juntos', from: 1750, to: 2200 },
  ],
}

/** Corrida estacionária — passadas alternadas, joelhos à altura do quadril. */
const RUN_TRACK: DemoTrack = {
  key: 'running-in-place',
  label: 'Corrida estacionária',
  duration: 1600,
  loop: true,
  keyframes: [
    { t: 0, pose: RUN_A },
    { t: 400, pose: RUN_B },
    { t: 800, pose: RUN_A },
    { t: 1200, pose: RUN_B },
    { t: 1600, pose: RUN_A },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 200 },
    { id: 'passada1', label: 'Passada — pé direito', from: 200, to: 800 },
    { id: 'passada2', label: 'Passada — pé esquerdo', from: 800, to: 1400 },
    { id: 'continuidade', label: 'Ritmo constante', from: 1400, to: 1600 },
  ],
}

/** Agachamento isométrico na parede — joelhos a 90°, costas no apoio. */
const WALL_SIT_TRACK: DemoTrack = {
  key: 'wall-sit',
  label: 'Agachamento isométrico na parede',
  duration: 2600,
  loop: true,
  prop: 'wall',
  keyframes: [
    { t: 0, pose: WALL_STAND },
    { t: 900, pose: WALL_HOLD },
    { t: 1700, pose: WALL_HOLD },
    { t: 2400, pose: WALL_STAND },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 400 },
    { id: 'deslize', label: 'Deslize pela parede', from: 400, to: 1000 },
    { id: 'isometria', label: 'Isometria na parede', from: 1000, to: 1700 },
    { id: 'subida', label: 'Subida', from: 1700, to: 2600 },
  ],
}

/** Abdominal remador — flexão e extensão controladas do tronco. */
const ROWER_TRACK: DemoTrack = {
  key: 'abdominal-rower',
  label: 'Abdominal remador',
  duration: 2600,
  loop: true,
  keyframes: [
    { t: 0, pose: ROWER_START },
    { t: 900, pose: ROWER_TOP },
    { t: 1400, pose: ROWER_TOP },
    { t: 2300, pose: ROWER_START },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 400 },
    { id: 'flexao', label: 'Flexão do tronco', from: 400, to: 1000 },
    { id: 'alta', label: 'Posição alta', from: 1000, to: 1500 },
    { id: 'descida', label: 'Descida controlada', from: 1500, to: 2600 },
  ],
}

/** Elevação de pernas — pernas estendidas até a vertical. */
const LEG_RAISE_TRACK: DemoTrack = {
  key: 'lying-leg-raise',
  label: 'Elevação de pernas deitado',
  duration: 2400,
  loop: true,
  keyframes: [
    { t: 0, pose: LEG_RAISE_START },
    { t: 800, pose: LEG_RAISE_TOP },
    { t: 1200, pose: LEG_RAISE_TOP },
    { t: 2100, pose: LEG_RAISE_START },
  ],
  phases: [
    { id: 'inicio', label: 'Posição inicial', from: 0, to: 400 },
    { id: 'elevacao', label: 'Elevação das pernas', from: 400, to: 900 },
    { id: 'alta', label: 'Posição alta', from: 900, to: 1300 },
    { id: 'descida', label: 'Descida controlada', from: 1300, to: 2400 },
  ],
}

/**
 * Todas as demonstrações, indexadas pelo movimento.
 *
 * A chave é a mesma taxonomia de `ExerciseIllustrationKey` — assim, o exercício
 * encontra a sua demo pela própria chave de ilustração, sem um segundo mapa.
 */
export const PANDA_DEMOS: Record<ExerciseIllustrationKey, DemoTrack> = {
  squat: SQUAT_TRACK,
  'incline-push-up': PUSHUP_TRACK,
  'glute-bridge': BRIDGE_TRACK,
  plank: PLANK_TRACK,
  'jumping-jacks': JACK_TRACK,
  'running-in-place': RUN_TRACK,
  'wall-sit': WALL_SIT_TRACK,
  'abdominal-rower': ROWER_TRACK,
  'lying-leg-raise': LEG_RAISE_TRACK,
}

/** Demonstração de um movimento (sempre presente no catálogo atual). */
export function getPandaDemo(key: ExerciseIllustrationKey): DemoTrack {
  return PANDA_DEMOS[key]
}

/** Todas as tracks, para inspeção e testes. */
export const PANDA_DEMO_LIST: DemoTrack[] = Object.values(PANDA_DEMOS)
