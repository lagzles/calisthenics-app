import type { DemoProp, PandaExpression } from '../domain/pandaTypes'
import { PANDA_FLOOR_Y, PANDA_SEGMENTS, PANDA_VIEWBOX } from '../domain/poseMath'
import type { PandaSkeleton, ViewBox } from '../domain/poseMath'

/**
 * O panda — personagem-base do Personal Trainer.
 *
 * Este é o **único** lugar onde o personagem é desenhado. Estados de
 * personalidade e demonstrações instrutivas passam por aqui, o que garante
 * automaticamente a consistência exigida pela identidade visual: mesmo rosto,
 * mesmas proporções, mesmas manchas, mesma paleta e o mesmo acessório
 * (a pulseira esportiva verde).
 *
 * Vista de perfil, olhando para a direita. O lado distante é desenhado
 * primeiro, em tom mais escuro, para sugerir profundidade.
 */

const COLORS = {
  body: '#f4f7f5',
  bodyShade: '#dde5e1',
  black: '#1b211f',
  blackFar: '#39423f',
  /** Contorno claro: separa os membros pretos do fundo escuro. */
  rim: '#5d6e67',
  rimFar: '#485651',
  bracelet: '#2fe06b',
  ground: '#2c3b35',
  prop: '#24322c',
} as const

/**
 * Larguras de desenho dos membros.
 *
 * Independentes do comprimento dos segmentos (que define a anatomia): um
 * membro mais grosso demais transforma a perna numa mancha única e esconde o
 * joelho — justamente a articulação que o aluno precisa enxergar.
 */
const WIDTH = {
  upperArm: 11,
  forearm: 10,
  thigh: 12.5,
  shin: 11,
  foot: 9.5,
} as const

/** Member do panda desenhado em duas passadas: contorno claro + preenchimento. */
function Limb({
  d,
  width,
  color,
  rim,
}: {
  d: string
  width: number
  color: string
  rim: string
}) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={rim} strokeWidth={width + 3} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  )
}

interface PandaRigProps {
  skeleton: PandaSkeleton
  /** Expressão facial. */
  expression?: PandaExpression
  /** Cenário desenhado junto do personagem. */
  prop?: DemoProp
  /** Desenha a linha do piso. */
  showFloor?: boolean
  /** Enquadramento da câmera (por padrão, o palco inteiro). */
  viewBox?: ViewBox
  className?: string
  /** Rótulo acessível do personagem (o nome do exercício acompanha). */
  title?: string
}

export function PandaRig({
  skeleton,
  expression = 'neutral',
  prop,
  showFloor = true,
  viewBox,
  className,
  title,
}: PandaRigProps) {
  const { head, neck, headTilt } = skeleton
  const frame = viewBox ?? {
    x: 0,
    y: 0,
    width: PANDA_VIEWBOX.width,
    height: PANDA_VIEWBOX.height,
  }

  // A pulseira fica no pulso do braço próximo, um pouco antes da mão.
  const forearmDir = {
    x: skeleton.handFront.x - skeleton.elbowFront.x,
    y: skeleton.handFront.y - skeleton.elbowFront.y,
  }
  const forearmLength = Math.hypot(forearmDir.x, forearmDir.y) || 1
  const bracelet = {
    x: skeleton.handFront.x - (forearmDir.x / forearmLength) * 6,
    y: skeleton.handFront.y - (forearmDir.y / forearmLength) * 6,
  }

  return (
    <svg
      className={className}
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}

      {/* Cenário — desenhado atrás do personagem. */}
      {prop === 'wall' && (
        <rect
          x={skeleton.shoulderBack.x - 8}
          y={8}
          width={14}
          height={PANDA_FLOOR_Y - 8}
          rx={4}
          fill={COLORS.prop}
        />
      )}
      {prop === 'bench' && (
        <g>
          <rect
            x={skeleton.handFront.x - 8}
            y={skeleton.handFront.y - 3}
            width={PANDA_VIEWBOX.width - skeleton.handFront.x + 8}
            height={8}
            rx={4}
            fill={COLORS.prop}
          />
          <rect
            x={PANDA_VIEWBOX.width - 22}
            y={skeleton.handFront.y}
            width={10}
            height={PANDA_FLOOR_Y - skeleton.handFront.y}
            rx={3}
            fill={COLORS.prop}
          />
        </g>
      )}

      {showFloor && (
        <line
          x1={frame.x}
          y1={PANDA_FLOOR_Y}
          x2={frame.x + frame.width}
          y2={PANDA_FLOOR_Y}
          stroke={COLORS.ground}
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}

      {/* Membros distantes. */}
      <g>
        <Limb
          d={`M ${skeleton.shoulderBack.x} ${skeleton.shoulderBack.y} L ${skeleton.elbowBack.x} ${skeleton.elbowBack.y}`}
          width={WIDTH.upperArm - 1}
          color={COLORS.blackFar}
          rim={COLORS.rimFar}
        />
        <Limb
          d={`M ${skeleton.elbowBack.x} ${skeleton.elbowBack.y} L ${skeleton.handBack.x} ${skeleton.handBack.y}`}
          width={WIDTH.forearm - 1}
          color={COLORS.blackFar}
          rim={COLORS.rimFar}
        />
        <Limb
          d={`M ${skeleton.hipBack.x} ${skeleton.hipBack.y} L ${skeleton.kneeBack.x} ${skeleton.kneeBack.y}`}
          width={WIDTH.thigh - 1}
          color={COLORS.blackFar}
          rim={COLORS.rimFar}
        />
        <Limb
          d={`M ${skeleton.kneeBack.x} ${skeleton.kneeBack.y} L ${skeleton.footBack.x} ${skeleton.footBack.y}`}
          width={WIDTH.shin - 1}
          color={COLORS.blackFar}
          rim={COLORS.rimFar}
        />
        <Limb
          d={`M ${skeleton.footBack.x} ${skeleton.footBack.y} L ${skeleton.toeBack.x} ${skeleton.toeBack.y}`}
          width={WIDTH.foot}
          color={COLORS.blackFar}
          rim={COLORS.rimFar}
        />
      </g>

      {/* Tronco. */}
      <path
        d={`M ${skeleton.pelvis.x} ${skeleton.pelvis.y} L ${neck.x} ${neck.y}`}
        stroke={COLORS.body}
        strokeWidth={26}
        strokeLinecap="round"
        fill="none"
      />

      {/* Membros próximos. */}
      <g>
        <Limb
          d={`M ${skeleton.hipFront.x} ${skeleton.hipFront.y} L ${skeleton.kneeFront.x} ${skeleton.kneeFront.y}`}
          width={WIDTH.thigh}
          color={COLORS.black}
          rim={COLORS.rim}
        />
        <Limb
          d={`M ${skeleton.kneeFront.x} ${skeleton.kneeFront.y} L ${skeleton.footFront.x} ${skeleton.footFront.y}`}
          width={WIDTH.shin}
          color={COLORS.black}
          rim={COLORS.rim}
        />
        <Limb
          d={`M ${skeleton.footFront.x} ${skeleton.footFront.y} L ${skeleton.toeFront.x} ${skeleton.toeFront.y}`}
          width={WIDTH.shin - 1}
          color={COLORS.black}
          rim={COLORS.rim}
        />
        <Limb
          d={`M ${skeleton.shoulderFront.x} ${skeleton.shoulderFront.y} L ${skeleton.elbowFront.x} ${skeleton.elbowFront.y}`}
          width={WIDTH.upperArm}
          color={COLORS.black}
          rim={COLORS.rim}
        />
        <Limb
          d={`M ${skeleton.elbowFront.x} ${skeleton.elbowFront.y} L ${skeleton.handFront.x} ${skeleton.handFront.y}`}
          width={WIDTH.forearm}
          color={COLORS.black}
          rim={COLORS.rim}
        />
      </g>

      {/* Cabeça — o rosto gira em torno do pescoço. */}
      <g transform={`rotate(${headTilt} ${neck.x} ${neck.y})`}>
        <circle cx={head.x - 15} cy={head.y - 13} r={9} fill={COLORS.black} />
        <circle cx={head.x + 15} cy={head.y - 13} r={9} fill={COLORS.black} />
        <ellipse
          cx={head.x}
          cy={head.y}
          rx={PANDA_SEGMENTS.headRadius}
          ry={PANDA_SEGMENTS.headRadius - 1}
          fill={COLORS.body}
        />

        {/* Manchas pretas ao redor dos olhos. */}
        <ellipse
          cx={head.x - 8.5}
          cy={head.y - 2}
          rx={7.5}
          ry={9.5}
          fill={COLORS.black}
          transform={`rotate(-18 ${head.x - 8.5} ${head.y - 2})`}
        />
        <ellipse
          cx={head.x + 8.5}
          cy={head.y - 2}
          rx={7.5}
          ry={9.5}
          fill={COLORS.black}
          transform={`rotate(18 ${head.x + 8.5} ${head.y - 2})`}
        />

        <Eyes head={head} expression={expression} />

        {/* Focinho, nariz e boca. */}
        <ellipse cx={head.x + 2} cy={head.y + 9} rx={9} ry={6.5} fill={COLORS.bodyShade} />
        <ellipse cx={head.x + 2} cy={head.y + 4} rx={3.6} ry={2.8} fill={COLORS.black} />
        <Mouth head={head} expression={expression} />
      </g>

      {/* Pulseira esportiva verde — acessório que identifica o personagem. */}
      <circle
        cx={bracelet.x}
        cy={bracelet.y}
        r={5}
        fill="none"
        stroke={COLORS.bracelet}
        strokeWidth={3.5}
      />
    </svg>
  )
}

interface FacePartProps {
  head: { x: number; y: number }
  expression: PandaExpression
}

/** Olhos — mudam conforme a expressão (o rosto continua sendo o mesmo). */
function Eyes({ head, expression }: FacePartProps) {
  if (expression === 'closed' || expression === 'happy') {
    const lift = expression === 'happy' ? -4 : 2
    return (
      <g
        stroke={COLORS.black}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      >
        <path
          d={`M ${head.x - 12} ${head.y + lift} q 3.5 ${expression === 'happy' ? -5 : 5} 7 0`}
        />
        <path
          d={`M ${head.x + 5} ${head.y + lift} q 3.5 ${expression === 'happy' ? -5 : 5} 7 0`}
        />
      </g>
    )
  }

  return (
    <g>
      <ellipse cx={head.x - 8.5} cy={head.y - 1} rx={3.6} ry={4.6} fill="#ffffff" />
      <ellipse cx={head.x + 8.5} cy={head.y - 1} rx={3.6} ry={4.6} fill="#ffffff" />
      <circle cx={head.x - 8} cy={head.y - 0.5} r={1.9} fill={COLORS.black} />
      <circle cx={head.x + 9} cy={head.y - 0.5} r={1.9} fill={COLORS.black} />
    </g>
  )
}

/** Boca — um traço curto, um sorriso ou um sorriso discreto. */
function Mouth({ head, expression }: FacePartProps) {
  const x = head.x + 2
  const y = head.y + 10

  if (expression === 'happy') {
    return (
      <path
        d={`M ${x - 4} ${y - 1} q 4 4 8 0`}
        stroke={COLORS.black}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    )
  }

  if (expression === 'closed') {
    return (
      <path
        d={`M ${x - 3} ${y} q 3 2 6 0`}
        stroke={COLORS.black}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    )
  }

  return (
    <path
      d={`M ${x - 3.5} ${y} q 3.5 2.4 7 0`}
      stroke={COLORS.black}
      strokeWidth={2.2}
      strokeLinecap="round"
      fill="none"
    />
  )
}
