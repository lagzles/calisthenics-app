import type { PandaPose, Point } from './pandaTypes'

/**
 * Matemática do rig do panda.
 *
 * O personagem é reconstruído a partir da pose por **cinemática direta**:
 * o quadril define o tronco, e cada segmento é posicionado pelo seu ângulo
 * absoluto. Como os comprimentos dos segmentos são constantes, interpolar duas
 * poses **nunca estica o personagem** — a proporção do corpo é preservada em
 * todas as animações (requisito de consistência visual).
 */

/** Comprimentos dos segmentos — fixos, para preservar as proporções. */
export const PANDA_SEGMENTS = {
  torso: 40,
  headOffset: 24,
  headRadius: 20,
  upperArm: 26,
  forearm: 24,
  thigh: 30,
  shin: 28,
  foot: 10,
  /** Afastamento entre o membro próximo e o distante (profundidade). */
  depth: 7,
} as const

/** Quadril do panda em pé, sobre o piso. */
export const PANDA_BASE = { x: 100, y: 108 } as const

/** Linha do piso — os pés do panda apoiados. */
export const PANDA_FLOOR_Y = 166

/** Largura/altura do viewBox do rig. */
export const PANDA_VIEWBOX = { width: 200, height: 200 } as const

/** Vetor unitário de um ângulo (convenção: `0` = baixo, `90` = direita). */
export function dirVector(angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.sin(rad), y: Math.cos(rad) }
}

/** Ângulo (na convenção do rig) do vetor que vai de `from` para `to`. */
export function angleBetween(from: Point, to: Point): number {
  return (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI
}

/** Deslocamento de `length` unidades na direção do ângulo. */
export function step(origin: Point, angleDeg: number, length: number): Point {
  const dir = dirVector(angleDeg)
  return { x: origin.x + dir.x * length, y: origin.y + dir.y * length }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Suavização padrão: desacelera no fim do movimento articular. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Interpolação linear de uma pose, campo a campo. */
export function lerpPose(a: PandaPose, b: PandaPose, t: number): PandaPose {
  return {
    pelvisX: lerp(a.pelvisX, b.pelvisX, t),
    pelvisY: lerp(a.pelvisY, b.pelvisY, t),
    torso: lerp(a.torso, b.torso, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
    shoulderFront: lerp(a.shoulderFront, b.shoulderFront, t),
    elbowFront: lerp(a.elbowFront, b.elbowFront, t),
    shoulderBack: lerp(a.shoulderBack, b.shoulderBack, t),
    elbowBack: lerp(a.elbowBack, b.elbowBack, t),
    hipFront: lerp(a.hipFront, b.hipFront, t),
    kneeFront: lerp(a.kneeFront, b.kneeFront, t),
    hipBack: lerp(a.hipBack, b.hipBack, t),
    kneeBack: lerp(a.kneeBack, b.kneeBack, t),
  }
}

/** Todas as juntas do personagem, já resolvidas em coordenadas. */
export interface PandaSkeleton {
  pelvis: Point
  neck: Point
  head: Point
  shoulderFront: Point
  elbowFront: Point
  handFront: Point
  shoulderBack: Point
  elbowBack: Point
  handBack: Point
  hipFront: Point
  kneeFront: Point
  footFront: Point
  toeFront: Point
  hipBack: Point
  kneeBack: Point
  footBack: Point
  toeBack: Point
  /** Inclinação da cabeça, em graus (aplicada como rotação em torno do pescoço). */
  headTilt: number
}

/** Retângulo de enquadramento do personagem. */
export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Enquadra um conjunto de poses.
 *
 * A câmera é calculada sobre **todos** os keyframes de uma demonstração, e não
 * sobre a pose atual: assim o personagem não "dá zoom" durante o movimento, e
 * cada exercício preenche o palco do mesmo jeito.
 */
export function computeViewBox(skeletons: PandaSkeleton[], padding = 10): ViewBox {
  const points: Point[] = []

  for (const skeleton of skeletons) {
    points.push(
      skeleton.pelvis,
      skeleton.neck,
      skeleton.head,
      skeleton.shoulderFront,
      skeleton.elbowFront,
      skeleton.handFront,
      skeleton.shoulderBack,
      skeleton.elbowBack,
      skeleton.handBack,
      skeleton.hipFront,
      skeleton.kneeFront,
      skeleton.footFront,
      skeleton.toeFront,
      skeleton.hipBack,
      skeleton.kneeBack,
      skeleton.footBack,
      skeleton.toeBack,
    )
  }

  if (points.length === 0) {
    return { x: 0, y: 0, width: PANDA_VIEWBOX.width, height: PANDA_VIEWBOX.height }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  // A cabeça e as extremidades mais grossas precisam de folga.
  const margin = PANDA_SEGMENTS.headRadius + padding
  minX -= margin
  minY -= margin
  maxX += margin
  maxY += margin

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Resolve a pose em coordenadas.
 *
 * A perna "próxima" e a "distante" partem do mesmo quadril; a distante recebe
 * um pequeno deslocamento para trás, sugerindo profundidade.
 */
export function solveSkeleton(pose: PandaPose): PandaSkeleton {
  const pelvis = { x: pose.pelvisX, y: pose.pelvisY }
  const neck = step(pelvis, pose.torso, PANDA_SEGMENTS.torso)
  const head = step(neck, pose.torso - pose.headTilt, PANDA_SEGMENTS.headOffset)

  // Profundidade: o par distante fica deslocado para trás (perpendicular ao
  // tronco, do lado oposto ao rosto), sugerindo que está atrás do corpo.
  const depthDir = dirVector(pose.torso + 90)
  const offset = {
    x: depthDir.x * PANDA_SEGMENTS.depth,
    y: depthDir.y * PANDA_SEGMENTS.depth,
  }

  const shoulderFront = neck
  const elbowFront = step(shoulderFront, pose.shoulderFront, PANDA_SEGMENTS.upperArm)
  const handFront = step(elbowFront, pose.elbowFront, PANDA_SEGMENTS.forearm)

  const shoulderBack = { x: shoulderFront.x + offset.x, y: shoulderFront.y + offset.y }
  const elbowBack = step(shoulderBack, pose.shoulderBack, PANDA_SEGMENTS.upperArm)
  const handBack = step(elbowBack, pose.elbowBack, PANDA_SEGMENTS.forearm)

  const hipFront = pelvis
  const kneeFront = step(hipFront, pose.hipFront, PANDA_SEGMENTS.thigh)
  const footFront = step(kneeFront, pose.kneeFront, PANDA_SEGMENTS.shin)

  const hipBack = { x: hipFront.x + offset.x, y: hipFront.y + offset.y }
  const kneeBack = step(hipBack, pose.hipBack, PANDA_SEGMENTS.thigh)
  const footBack = step(kneeBack, pose.kneeBack, PANDA_SEGMENTS.shin)

  // O pé aponta para a frente (direita) a partir do tornozelo.
  const toeFront = { x: footFront.x + PANDA_SEGMENTS.foot, y: footFront.y }
  const toeBack = { x: footBack.x + PANDA_SEGMENTS.foot, y: footBack.y }

  return {
    pelvis,
    neck,
    head,
    shoulderFront,
    elbowFront,
    handFront,
    shoulderBack,
    elbowBack,
    handBack,
    hipFront,
    kneeFront,
    footFront,
    toeFront,
    hipBack,
    kneeBack,
    footBack,
    toeBack,
    headTilt: pose.headTilt,
  }
}

/**
 * Cinemática inversa do braço.
 *
 * Devolve os ângulos (ombro, cotovelo) que levam o ombro até a mão desejada.
 * O cotovelo é posicionado **para baixo** da linha ombro→mão (ramo "cotovelo
 * baixo"), que é a postura natural em flexões e apoios.
 *
 * @throws Error quando a mão está fora do alcance do braço.
 */
export function solveArmIK(shoulder: Point, hand: Point): { shoulder: number; elbow: number } {
  const upper = PANDA_SEGMENTS.upperArm
  const fore = PANDA_SEGMENTS.forearm
  const reach = distance(shoulder, hand)

  const maxReach = upper + fore - 0.01
  const minReach = Math.abs(upper - fore) + 0.01
  if (reach > maxReach || reach < minReach) {
    throw new Error(`Mão fora do alcance do braço (${reach.toFixed(1)})`)
  }

  const handAngle = angleBetween(shoulder, hand)
  const alpha =
    (Math.acos((upper * upper + reach * reach - fore * fore) / (2 * upper * reach)) * 180) /
    Math.PI

  const candidates = [handAngle - alpha, handAngle + alpha].map((shoulderAngle) => {
    const elbow = step(shoulder, shoulderAngle, upper)
    return { shoulderAngle, elbow, elbowAngle: angleBetween(elbow, hand) }
  })

  // Ramo "cotovelo baixo": o cotovelo mais afastado da linha de cima.
  const chosen = candidates.reduce((best, current) =>
    current.elbow.y > best.elbow.y ? current : best,
  )

  return { shoulder: chosen.shoulderAngle, elbow: chosen.elbowAngle }
}
