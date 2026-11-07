/**
 * Tipos do Panda Personal Trainer.
 *
 * O panda é uma entidade **de apresentação**: recebe um estado (personalidade)
 * ou uma track de demonstração (instrutiva) e devolve a ilustração
 * correspondente. Nenhum destes tipos conhece o Workout Engine — a ligação é
 * feita apenas por seletores (`pandaState.ts`).
 *
 * ## Convenção de ângulos
 *
 * Todos os ângulos usam a **mesma** convenção, para que a interpolação entre
 * poses seja coerente:
 *
 * - `0°` → membro apontando para **baixo** (+y).
 * - `90°` → membro apontando para a **direita** (+x).
 * - `180°` → membro apontando para **cima** (−y).
 * - Valores positivos giram o membro do "baixo" em direção à direita.
 *
 * O vetor de direção de um ângulo `a` é `(sin a, cos a)`. Um tronco ereto tem
 * `torso = 180`; inclinar o tronco para a frente (direita) reduz o ângulo.
 */

/** Ponto no plano do SVG. */
export interface Point {
  x: number
  y: number
}

/**
 * Pose do panda: a posição do quadril e os ângulos de cada segmento.
 *
 * `Front` é o lado **próximo** do observador (desenhado por cima) e `Back` o
 * lado distante (desenhado por baixo, com leve deslocamento para dar
 * profundidade). O personagem é visto de perfil, olhando para a direita.
 */
export interface PandaPose {
  /** Quadril (centro do corpo) em coordenadas do viewBox. */
  pelvisX: number
  pelvisY: number
  /** Ângulo do tronco (quadril → pescoço). `180` = ereto. */
  torso: number
  /** Inclinação da cabeça em graus, relativa ao tronco. Positivo = olha para a frente. */
  headTilt: number
  /** [ombro, cotovelo] do braço próximo, em ângulos absolutos. */
  shoulderFront: number
  elbowFront: number
  /** [ombro, cotovelo] do braço distante. */
  shoulderBack: number
  elbowBack: number
  /** [quadril, joelho] da perna próxima, em ângulos absolutos. */
  hipFront: number
  kneeFront: number
  /** [quadril, joelho] da perna distante. */
  hipBack: number
  kneeBack: number
}

/** Expressão facial — desenhada no rig, sobre a cabeça. */
export type PandaExpression = 'neutral' | 'closed' | 'happy' | 'focused'

/**
 * Estados de personalidade do mascote.
 *
 * Momentos curtos de interação, sem conteúdo instrutivo:
 * `welcome` (saudação), `ready` (preparado), `rest` (descanso),
 * `encouraging` (incentivo), `celebrating` (comemoração), `streak`
 * (sequência) e `idle` (espera).
 */
export type PandaState =
  | 'welcome'
  | 'ready'
  | 'rest'
  | 'encouraging'
  | 'celebrating'
  | 'streak'
  | 'idle'

/** Keyframe de uma demonstração: uma pose em um instante da track. */
export interface DemoKeyframe {
  /** Instante do keyframe, em milissegundos desde o início da track. */
  t: number
  pose: PandaPose
}

/**
 * Fase da demonstração — o trecho nomeado que sincroniza a pose com a
 * explicação exibida ("Posição inicial", "Descida", "Posição baixa"...).
 */
export interface DemoPhase {
  id: string
  label: string
  /** Início da fase, em ms. */
  from: number
  /** Fim da fase, em ms (exclusivo). */
  to: number
}

/** Cenário opcional desenhado junto ao panda. */
export type DemoProp = 'wall' | 'bench' | 'floor'

/**
 * Demonstração instrutiva de um movimento.
 *
 * Uma track por movimento; movimentos repetidos entre treinos (a prancha em A
 * e B) compartilham a mesma track.
 */
export interface DemoTrack {
  /** Movimento demonstrado — mesma taxonomia das ilustrações stick figure. */
  key: string
  /** Nome legível do movimento. */
  label: string
  /** Duração total do ciclo, em ms. */
  duration: number
  /** Se o ciclo recomeça automaticamente ao final. */
  loop: boolean
  keyframes: DemoKeyframe[]
  phases: DemoPhase[]
  /** Cenário (parede, banco, solo). */
  prop?: DemoProp
}

/** Pose + fase resultantes da resolução de uma track em um instante. */
export interface ResolvedTrack {
  pose: PandaPose
  phase: DemoPhase
  /** Progresso normalizado no ciclo (0–1). */
  progress: number
}
