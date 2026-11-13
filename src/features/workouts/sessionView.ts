import type { Exercise, SessionSnapshot, WorkoutPhase, WorkoutSession } from './domain/types'

/**
 * Derivação de apresentação para o Workout Mode.
 *
 * Funções puras que traduzem o instantâneo do motor (`SessionSnapshot`) em
 * dados prontos para exibição: tom visual (verde/âmbar), rótulos, estado de
 * cada exercício na lista e o texto do temporizador. Nenhuma regra de tempo é
 * reimplementada aqui — o tempo vem sempre do snapshot (motor).
 */

/** Tom visual da etapa: verde para exercício, âmbar para descanso. */
export type PhaseTone = 'work' | 'rest' | 'done'

export interface PhasePresentation {
  tone: PhaseTone
  label: string
}

export function describePhase(phase: WorkoutPhase): PhasePresentation {
  if (phase === 'rest') return { tone: 'rest', label: 'DESCANSO' }
  if (phase === 'completed') return { tone: 'done', label: 'CONCLUÍDO' }
  return { tone: 'work', label: 'EXERCÍCIO' }
}

/** Estado de um exercício na lista completa (UI/UX §7.2). */
export type ExerciseListState = 'pending' | 'active' | 'resting' | 'completed'

export function getExerciseListState(session: WorkoutSession, index: number): ExerciseListState {
  const progress = session.exercisesProgress[index]
  if (progress?.completed) return 'completed'

  if (index === session.currentExerciseIndex) {
    if (session.currentPhase === 'rest') return 'resting'
    if (session.currentPhase === 'completed') return 'completed'
    return 'active'
  }

  return 'pending'
}

export const EXERCISE_LIST_STATE_LABELS: Record<ExerciseListState, string> = {
  pending: 'Pendente',
  active: 'Em execução',
  resting: 'Em descanso',
  completed: 'Concluído',
}

/** Identificadores dos controles da tela de execução. */
export type WorkoutControlId =
  | 'previous'
  | 'skipSet'
  | 'completeSet'
  | 'nextExercise'
  | 'extend10'
  | 'extend15'
  | 'skipRest'

/**
 * Controles disponíveis durante o descanso (produto).
 *
 * Somente extensões e "Pular descanso" — **não** há avanço para outro exercício
 * nem retrocesso a partir do descanso. O avanço só aparece após o descanso
 * terminar (exercício concluído).
 */
export const REST_CONTROLS: readonly WorkoutControlId[] = ['extend10', 'extend15', 'skipRest']

/**
 * Controles visíveis em cada etapa.
 *
 * Mantém a decisão de quais botões aparecem fora dos componentes (testável) e
 * garante que o descanso exponha apenas os três controles definidos.
 */
export function getStageControlIds(snapshot: SessionSnapshot): WorkoutControlId[] {
  if (snapshot.phase === 'rest') return [...REST_CONTROLS]
  if (snapshot.phase === 'completed') return ['previous', 'nextExercise']

  const isReps = snapshot.exercise?.executionType === 'reps'
  return ['previous', isReps ? 'completeSet' : 'skipSet', 'nextExercise']
}

/**
 * Indica se avançar para o próximo exercício exige confirmação.
 *
 * Durante a execução (`work`), avançar abandona as séries restantes do
 * exercício — por isso confirmamos. Quando o exercício já terminou (`completed`),
 * avançar é a ação esperada e não precisa de confirmação.
 */
export function needsAdvanceConfirmation(snapshot: SessionSnapshot): boolean {
  return snapshot.phase === 'work'
}

/** Formata segundos como `m:ss` para a contagem regressiva. */
export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export interface TimerViewModel {
  tone: PhaseTone
  phaseLabel: string
  exercise: Exercise | undefined
  exerciseName: string
  exerciseNumber: number
  exerciseCount: number
  currentSet: number
  totalSets: number
  nextSet: number
  isTimed: boolean
  /** Texto da contagem regressiva (ou `null` quando não se aplica). */
  timerText: string | null
  /** Alvo por repetições (ou `null`). */
  repetitions: number | null
  message: string
  exerciseProgress: number
  workoutProgress: number
}

/**
 * Monta o modelo da tela de execução a partir do snapshot do motor.
 *
 * A interface apenas renderiza; qualquer decisão de texto/estado vem daqui,
 * mantendo os componentes burros e a lógica testável.
 */
export function buildTimerViewModel(snapshot: SessionSnapshot): TimerViewModel {
  const { tone, label } = describePhase(snapshot.phase)
  const exercise = snapshot.exercise
  const isTimed = exercise?.executionType === 'timed'
  const isResting = snapshot.phase === 'rest'

  const currentSet = snapshot.currentSet
  const totalSets = snapshot.totalSets
  const nextSet = Math.min(currentSet + 1, totalSets)

  let timerText: string | null = null
  let message: string

  if (isResting) {
    timerText = formatTimer(snapshot.remainingTime)
    // Na última série do exercício o descanso antecede o próximo exercício.
    const isLastSet = currentSet >= totalSets
    const hasNextExercise = snapshot.exerciseIndex < snapshot.exerciseCount - 1

    message =
      isLastSet && hasNextExercise
        ? 'Exercício concluído. Descanse antes do próximo.'
        : `Recupere e prepare-se para a série ${nextSet}.`
  } else if (snapshot.phase === 'completed') {
    message = 'Exercício concluído. Avance para o próximo.'
  } else if (isTimed) {
    timerText = formatTimer(snapshot.remainingTime)
    message = 'Concentre-se na execução e respire normalmente.'
  } else {
    message = 'Execute as repetições e marque a série ao concluir.'
  }

  return {
    tone,
    phaseLabel: label,
    exercise,
    exerciseName: exercise?.name ?? '',
    exerciseNumber: snapshot.exerciseIndex + 1,
    exerciseCount: snapshot.exerciseCount,
    currentSet,
    totalSets,
    nextSet,
    isTimed,
    timerText,
    repetitions: exercise?.repetitions ?? null,
    message,
    exerciseProgress: snapshot.exerciseProgress,
    workoutProgress: snapshot.workoutProgress,
  }
}
