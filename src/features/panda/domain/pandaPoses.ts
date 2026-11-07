import type { PandaPose, Point } from './pandaTypes'
import { PANDA_BASE, PANDA_SEGMENTS, solveArmIK, step } from './poseMath'

/**
 * Biblioteca de poses do panda.
 *
 * Cada pose é descrita por um **espaço legível** (posição do quadril, ângulo
 * do tronco e ângulos dos membros) e convertida para a representação numérica
 * usada pelo rig. Os ângulos seguem a convenção de `pandaTypes`: `0` = baixo,
 * `90` = direita, `180` = cima.
 *
 * Os braços podem ser definidos de duas formas:
 *
 * - `[ombro, cotovelo]` — ângulos absolutos (movimentos livres);
 * - `{ hand: Point }` — a mão vai para um ponto fixo do palco e o braço é
 *   resolvido por cinemática inversa. Usado nos apoios que não podem deslizar
 *   (mãos na flexão com apoio, antebraços na prancha).
 */

/** Definição de um braço. */
export type ArmSpec = [number, number] | { hand: Point }

/** Definição de uma perna: `[quadril, joelho]` em ângulos absolutos. */
export type LegSpec = [number, number]

export interface PoseSpec {
  /** Quadril (centro do corpo). */
  pelvis?: Point
  /** Ângulo do tronco (quadril → pescoço). `180` = ereto. */
  torso?: number
  /** Inclinação da cabeça em graus (positivo = olha para a frente). */
  headTilt?: number
  armFront?: ArmSpec
  armBack?: ArmSpec
  legFront?: LegSpec
  legBack?: LegSpec
}

const DEFAULT_ARM: ArmSpec = [20, 28]

/** Converte uma especificação legível em pose numérica. */
export function makePose(spec: PoseSpec): PandaPose {
  const pelvis = spec.pelvis ?? PANDA_BASE
  const torso = spec.torso ?? 180
  const legFront = spec.legFront ?? [3, -1]
  const legBack = spec.legBack ?? [1, -2]

  const neck = step(pelvis, torso, PANDA_SEGMENTS.torso)

  const resolveArm = (arm: ArmSpec | undefined, fallback: ArmSpec): [number, number] => {
    const value = arm ?? fallback
    if (Array.isArray(value)) return value
    const solved = solveArmIK(neck, value.hand)
    return [solved.shoulder, solved.elbow]
  }

  const [shoulderFront, elbowFront] = resolveArm(spec.armFront, DEFAULT_ARM)
  const [shoulderBack, elbowBack] = resolveArm(spec.armBack, DEFAULT_ARM)

  return {
    pelvisX: pelvis.x,
    pelvisY: pelvis.y,
    torso,
    headTilt: spec.headTilt ?? 0,
    shoulderFront,
    elbowFront,
    shoulderBack,
    elbowBack,
    hipFront: legFront[0],
    kneeFront: legFront[1],
    hipBack: legBack[0],
    kneeBack: legBack[1],
  }
}

/* -------------------------------------------------------------------------- */
/* Poses de personalidade                                                     */
/* -------------------------------------------------------------------------- */

/** Em pé, neutro — base de todos os estados. */
export const STAND = makePose({
  armFront: [20, 28],
  armBack: [16, 24],
  legFront: [3, -1],
  legBack: [1, -2],
})

/** Saudação: um braço erguido ao lado da cabeça. */
export const WAVE = makePose({
  torso: 178,
  headTilt: 4,
  armFront: [150, 168],
  armBack: [16, 24],
  legFront: [3, -1],
  legBack: [1, -2],
})

/** Pronto para treinar: punhos na altura do peito. */
export const READY = makePose({
  pelvis: { x: 100, y: 110 },
  torso: 178,
  armFront: [40, 165],
  armBack: [35, 160],
  legFront: [22, -10],
  legBack: [20, -12],
})

/** Descanso: sentado no chão, pernas flexionadas, ombros relaxados. */
export const REST = makePose({
  pelvis: { x: 98, y: 140 },
  torso: 186,
  headTilt: 5,
  armFront: [22, 34],
  armBack: [18, 30],
  legFront: [88, -4],
  legBack: [82, -8],
})

/** Incentivo: braço erguido em Joinha. */
export const ENCOURAGE = makePose({
  torso: 179,
  headTilt: 3,
  armFront: [100, 180],
  armBack: [12, 22],
  legFront: [3, -1],
  legBack: [1, -2],
})

/** Comemoração: braços erguidos em "V", corpo levemente no ar. */
export const CELEBRATE = makePose({
  pelvis: { x: 100, y: 102 },
  torso: 181,
  headTilt: -4,
  armFront: [133, 143],
  armBack: [166, 176],
  legFront: [8, -10],
  legBack: [6, -12],
})

/** Sequência: um braço erguido, pronto para o próximo desafio. */
export const STREAK = makePose({
  pelvis: { x: 100, y: 104 },
  torso: 180,
  headTilt: -2,
  armFront: [148, 164],
  armBack: [12, 22],
  legFront: [5, -6],
  legBack: [3, -8],
})

/* -------------------------------------------------------------------------- */
/* Poses das demonstrações                                                    */
/* -------------------------------------------------------------------------- */

/* Agachamento livre --------------------------------------------------------- */

/** Agachamento: em pé, braços ao longo do corpo. */
export const SQUAT_START = makePose({
  armFront: [20, 28],
  armBack: [16, 24],
  legFront: [3, -1],
  legBack: [1, -2],
})

/** Agachamento: posição baixa, tronco inclinado, braços à frente. */
export const SQUAT_BOTTOM = makePose({
  pelvis: { x: 94, y: 126 },
  torso: 163,
  headTilt: 4,
  armFront: [80, 88],
  armBack: [76, 84],
  legFront: [64, -6],
  legBack: [60, -10],
})

/* Flexão com apoio ---------------------------------------------------------- */

/**
 * Flexão com apoio: corpo em linha reta, mãos fixas no banco à direita.
 *
 * As mãos são fixadas por cinemática inversa — o apoio não "desliza" entre a
 * posição alta e a posição baixa, como acontece na execução real.
 */
export const PUSHUP_TOP = makePose({
  pelvis: { x: 92.6, y: 141.5 },
  torso: 115,
  headTilt: -10,
  armFront: { hand: { x: 175, y: 141 } },
  armBack: { hand: { x: 170, y: 144 } },
  legFront: [295, 295],
  legBack: [295, 295],
})

/** Flexão com apoio: posição baixa, cotovelos flexionados, corpo em linha. */
export const PUSHUP_BOTTOM = makePose({
  pelvis: { x: 95.2, y: 148.1 },
  torso: 108,
  headTilt: -8,
  armFront: { hand: { x: 175, y: 141 } },
  armBack: { hand: { x: 170, y: 144 } },
  legFront: [288, 288],
  legBack: [288, 288],
})

/* Elevação de pelve --------------------------------------------------------- */

/** Elevação de pelve: deitada, quadril no chão, joelhos flexionados. */
export const BRIDGE_START = makePose({
  pelvis: { x: 100, y: 152 },
  torso: 101,
  headTilt: 11,
  armFront: [280, 285],
  armBack: [276, 281],
  legFront: [112, 26],
  legBack: [108, 22],
})

/** Elevação de pelve: quadril elevado, linha do corpo preservada. */
export const BRIDGE_TOP = makePose({
  pelvis: { x: 100, y: 132 },
  torso: 73,
  headTilt: -17,
  armFront: [280, 285],
  armBack: [276, 281],
  legFront: [74, 23],
  legBack: [70, 19],
})

/* Prancha ------------------------------------------------------------------- */

/**
 * Prancha: antebraços no chão, corpo em linha reta.
 *
 * O movimento é isométrico: a demo mostra o alinhamento com uma microvariação
 * respiratória, sem simular um movimento que não existe.
 */
export const PLANK_HOLD = makePose({
  pelvis: { x: 78, y: 144 },
  torso: 90,
  headTilt: 0,
  armFront: { hand: { x: 148, y: 166 } },
  armBack: { hand: { x: 144, y: 168 } },
  legFront: [292, 292],
  legBack: [292, 292],
})

/**
 * Prancha durante a inspiração — microvariação do tronco e do quadril.
 *
 * Na isometria o corpo não se move; o que muda é a expansão da caixa torácica.
 * A variação é de poucos pixels, apenas para que o movimento da respiração
 * fique visível — e continua sendo fiel ao que acontece no exercício.
 */
export const PLANK_BREATH = makePose({
  pelvis: { x: 78, y: 142.5 },
  torso: 90.6,
  headTilt: 0,
  armFront: { hand: { x: 148, y: 166 } },
  armBack: { hand: { x: 144, y: 168 } },
  legFront: [292, 292],
  legBack: [292, 292],
})

/* Polichinelo --------------------------------------------------------------- */

/** Polichinelo: pés juntos, braços ao lado do corpo. */
export const JACK_START = makePose({
  armFront: [16, 20],
  armBack: [14, 18],
  legFront: [2, 0],
  legBack: [0, -2],
})

/** Polichinelo: pernas abertas, braços erguidos. */
export const JACK_OPEN = makePose({
  pelvis: { x: 100, y: 110 },
  torso: 180,
  armFront: [125, 135],
  armBack: [132, 142],
  legFront: [25, -5],
  legBack: [-25, 5],
})

/* Corrida estacionária ------------------------------------------------------ */

/** Corrida: joelho da frente elevado, apoio na perna de trás. */
export const RUN_A = makePose({
  pelvis: { x: 100, y: 108 },
  torso: 180,
  headTilt: 2,
  armFront: [-25, 65],
  armBack: [40, 120],
  legFront: [70, -18],
  legBack: [-4, 2],
})

/** Corrida: o contralateral — o outro joelho sobe. */
export const RUN_B = makePose({
  pelvis: { x: 100, y: 108 },
  torso: 180,
  headTilt: 2,
  armFront: [40, 120],
  armBack: [-25, 65],
  legFront: [-4, 2],
  legBack: [70, -18],
})

/* Agachamento isométrico na parede ------------------------------------------ */

/** Parede: em pé, encostado, antes de deslizar. */
export const WALL_STAND = makePose({
  pelvis: { x: 122, y: 108 },
  torso: 178,
  headTilt: 2,
  armFront: [20, 28],
  armBack: [16, 24],
  legFront: [3, -1],
  legBack: [1, -2],
})

/** Parede: joelhos a 90°, costas apoiadas, pés à frente. */
export const WALL_HOLD = makePose({
  pelvis: { x: 122, y: 138 },
  torso: 180,
  headTilt: 0,
  armFront: [16, 26],
  armBack: [12, 22],
  legFront: [90, 0],
  legBack: [86, -4],
})

/* Abdominal remador ---------------------------------------------------------- */

/** Abdominal remador: sentado, tronco recuado, braços à frente. */
export const ROWER_START = makePose({
  pelvis: { x: 100, y: 130 },
  torso: 218,
  headTilt: 8,
  armFront: { hand: { x: 118, y: 96 } },
  armBack: { hand: { x: 114, y: 99 } },
  legFront: [74, 0],
  legBack: [70, -4],
})

/** Abdominal remador: tronco flexionado, peito perto dos joelhos. */
export const ROWER_TOP = makePose({
  pelvis: { x: 100, y: 130 },
  torso: 158,
  headTilt: 8,
  armFront: { hand: { x: 148, y: 104 } },
  armBack: { hand: { x: 144, y: 107 } },
  legFront: [74, 0],
  legBack: [70, -4],
})

/* Elevação de pernas -------------------------------------------------------- */

/** Elevação de pernas: deitada, pernas estendidas no chão. */
export const LEG_RAISE_START = makePose({
  pelvis: { x: 100, y: 152 },
  torso: 101,
  headTilt: 11,
  armFront: [282, 287],
  armBack: [278, 283],
  legFront: [284, 284],
  legBack: [284, 284],
})

/** Elevação de pernas: pernas na vertical, lombar apoiada no chão. */
export const LEG_RAISE_TOP = makePose({
  pelvis: { x: 100, y: 152 },
  torso: 101,
  headTilt: 11,
  armFront: [282, 287],
  armBack: [278, 283],
  legFront: [180, 180],
  legBack: [180, 180],
})
