/**
 * Modelo de domínio dos treinos.
 *
 * Reúne duas famílias de tipos:
 *
 * 1. Catálogo — `Workout` e `Exercise`: a definição de um treino e de seus
 *    exercícios (dados estáticos do MVP).
 * 2. Execução — `WorkoutSession` e tipos correlatos: o estado de uma execução
 *    real de um treino, reconciliável a partir de timestamps.
 *
 * O motor de execução (`workoutEngine`) opera de forma pura sobre esses tipos,
 * sem depender de React nem da camada de persistência.
 */

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                    */
/* -------------------------------------------------------------------------- */

export type WorkoutId = 'A' | 'B'

/**
 * Modalidade de execução de um exercício.
 * - `timed`: controlado por tempo (o app conta exercício e descanso).
 * - `reps`: por repetições (o usuário marca a conclusão da série).
 */
export type ExecutionType = 'timed' | 'reps'

/**
 * Chave da ilustração de um exercício.
 *
 * A interface resolve a chave para um asset SVG local
 * (`exerciseIllustrations.ts`). Movimentos repetidos entre treinos (ex.: prancha
 * em A e B) compartilham a mesma chave — e, portanto, a mesma ilustração.
 */
export type ExerciseIllustrationKey =
  | 'squat'
  | 'incline-push-up'
  | 'glute-bridge'
  | 'plank'
  | 'jumping-jacks'
  | 'running-in-place'
  | 'wall-sit'
  | 'abdominal-rower'
  | 'lying-leg-raise'

export interface Exercise {
  id: string
  name: string
  /** Resumo curto do exercício (apoio de apresentação). */
  description?: string
  /** Chave da ilustração que demonstra o movimento (asset SVG local). */
  illustration: ExerciseIllustrationKey
  /** Orientações resumidas de execução. */
  instructions: string
  /** Passos simples de execução ("Como executar"). */
  steps?: string[]
  /** Dica — um cuidado importante para executar corretamente. */
  tip?: string
  executionType: ExecutionType
  /** Quantidade de séries. */
  sets: number
  /** Duração de cada série, em segundos. Obrigatório quando `executionType === 'timed'`. */
  workDuration?: number
  /** Repetições por série. Obrigatório quando `executionType === 'reps'`. */
  repetitions?: number
  /** Descanso entre séries, em segundos. Não há descanso após a última série. */
  restDuration: number
  commonMistakes?: string[]
  adaptations?: string[]
}

export interface Workout {
  id: WorkoutId
  name: string
  /** Objetivo/descrição curta do treino. */
  description: string
  estimatedMinutes: number
  exercises: Exercise[]
}

/* -------------------------------------------------------------------------- */
/* Resumo da Home                                                              */
/* -------------------------------------------------------------------------- */

export interface LastWorkoutSummary {
  workoutId: WorkoutId
  daysAgo: number
  completedMinutes: number
}

export interface HomeSummary {
  weeklyWorkoutsCompleted: number
  weeklyWorkoutsGoal: number
  lastWorkout: LastWorkoutSummary | null
}

/* -------------------------------------------------------------------------- */
/* Execução                                                                    */
/* -------------------------------------------------------------------------- */

export type WorkoutSessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'

/**
 * Etapa atual da execução.
 * - `work`: execução de uma série (por tempo ou por repetições).
 * - `rest`: descanso entre séries.
 * - `completed`: a série final do exercício atual terminou. Quando há próximo
 *   exercício, a sessão aguarda a ação de avançar; quando é o último, o treino
 *   está concluído.
 */
export type WorkoutPhase = 'work' | 'rest' | 'completed'

/** Registro de uma série concluída (para histórico e idempotência). */
export interface CompletedSet {
  /** Número da série (1-based). */
  set: number
  completedAt: string
  /** Repetições efetivamente realizadas (modalidade `reps`, opcional). */
  actualRepetitions?: number
  /** Segundos efetivamente realizados (modalidade `timed`, opcional). */
  workSeconds?: number
}

export interface ExerciseProgress {
  exerciseId: string
  completedSets: number
  /** Séries encerradas antecipadamente sem contar como concluídas. */
  skippedSets?: number
  sets: CompletedSet[]
  completed: boolean
  completedAt: string | null
}

/**
 * Estado de uma execução real de um treino.
 *
 * Timestamps são strings ISO (UTC). `remainingTime` está em segundos e é
 * autoritativo apenas quando a sessão está `paused`; quando `active`, o tempo
 * restante é derivado de `phaseEndsAt` (ver `workoutSelectors.getRemainingTime`).
 */
export interface WorkoutSession {
  id: string
  workoutId: string
  workoutName: string
  status: WorkoutSessionStatus
  startedAt: string
  pausedAt: string | null
  finishedAt: string | null
  /** Índice (0-based) do exercício atual em `Workout.exercises`. */
  currentExerciseIndex: number
  /** Série atual (1-based). */
  currentSet: number
  currentPhase: WorkoutPhase
  /** Segundos restantes na etapa atual. */
  remainingTime: number
  /** Início da etapa atual (ISO). */
  phaseStartedAt: string | null
  /**
   * Fim previsto da etapa atual (ISO). `null` quando a etapa não é controlada
   * por tempo (série por repetições ou etapa concluída).
   */
  phaseEndsAt: string | null
  /** Total acumulado de tempo em pausa (ms), descontado da duração. */
  totalPausedMs: number
  /** Total de séries concluídas no treino. */
  completedSets: number
  exercisesProgress: ExerciseProgress[]
  /** Duração total de treino efetivo, em segundos. */
  duration: number
}

/* -------------------------------------------------------------------------- */
/* Transições (eventos)                                                        */
/* -------------------------------------------------------------------------- */

export type WorkoutEventType =
  | 'workout-started'
  | 'exercise-started'
  | 'set-started'
  | 'set-completed'
  | 'set-skipped'
  | 'rest-started'
  | 'rest-ended'
  | 'rest-extended'
  | 'exercise-completed'
  | 'workout-completed'
  | 'workout-paused'
  | 'workout-resumed'
  | 'workout-abandoned'

/**
 * Transição ocorrida durante uma operação do motor.
 *
 * A camada de apresentação reage a esses eventos (avisos sonoros, animações),
 * sem que o motor precise conhecer áudio ou UI.
 */
export interface WorkoutEvent {
  type: WorkoutEventType
  /** Instante do evento (epoch ms). */
  at: number
  exerciseIndex: number
  exerciseId?: string
  set?: number
  phase?: WorkoutPhase
  /** Dados extras (ex.: segundos adicionados em `rest-extended`). */
  seconds?: number
}

/** Resultado de uma operação do motor: novo estado + transições ocorridas. */
export interface EngineResult {
  session: WorkoutSession
  events: WorkoutEvent[]
}

/* -------------------------------------------------------------------------- */
/* Visão para a interface                                                      */
/* -------------------------------------------------------------------------- */

/** Instantâneo pronto para consumo pela interface de execução. */
export interface SessionSnapshot {
  session: WorkoutSession
  status: WorkoutSessionStatus
  phase: WorkoutPhase
  exercise: Exercise | undefined
  exerciseIndex: number
  exerciseCount: number
  nextExercise: Exercise | undefined
  currentSet: number
  totalSets: number
  remainingTime: number
  elapsedSeconds: number
  exerciseProgress: number
  workoutProgress: number
  isPaused: boolean
  isRunning: boolean
  isExerciseComplete: boolean
  isWorkoutComplete: boolean
  canPause: boolean
  canResume: boolean
  canSkipRest: boolean
  canExtendRest: boolean
  canSkipSet: boolean
  canCompleteSet: boolean
  canAdvance: boolean
  canGoBack: boolean
}
