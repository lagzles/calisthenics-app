import type {
  EngineResult,
  ExerciseProgress,
  Workout,
  WorkoutEvent,
  WorkoutSession,
} from './types'
import { assertValidWorkout } from './workoutValidation'
import {
  abandonSession,
  beginExercise,
  beginNextSetAfterRest,
  beginSetWork,
  cloneSession,
  completeSession,
  concludeCurrentSet,
  createSessionId,
  parseIso,
  resetExerciseProgress,
  skipCurrentSet,
  toIso,
} from './workoutTransitions'

/**
 * Motor de execução dos treinos.
 *
 * Funções puras: cada operação recebe uma sessão, uma referência de tempo
 * (`now`, em epoch ms) e devolve um novo resultado `{ session, events }`. Nada
 * aqui depende de React, do DOM ou de `setInterval` como fonte de verdade — o
 * tempo é sempre derivado de timestamps reais persistidos na sessão.
 *
 * Referências de tempo:
 * - `phaseStartedAt` / `phaseEndsAt` delimitam a etapa atual.
 * - `tick`/`reconcile` percorre as etapas já vencidas usando o término real de
 *   cada uma, de modo que fechar o aplicativo e reabri-lo mais tarde
 *   reconstitui o progresso correto e de forma idempotente.
 */

export class WorkoutEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkoutEngineError'
  }
}

export interface StartWorkoutOptions {
  /** Instante de início (epoch ms). Padrão: `Date.now()`. */
  now?: number
  /** Identificador da sessão. Padrão: UUID gerado. */
  id?: string
}

function assertActive(session: WorkoutSession, operation: string): void {
  if (session.status !== 'active') {
    throw new WorkoutEngineError(
      `${operation}: a sessão precisa estar ativa (status atual: "${session.status}").`,
    )
  }
}

function remainingForSession(session: WorkoutSession, now: number): number {
  if (session.status === 'paused') return session.remainingTime
  if (session.status !== 'active') return 0
  if (!session.phaseEndsAt) return session.remainingTime
  return Math.max(0, Math.ceil((parseIso(session.phaseEndsAt) - now) / 1000))
}

/** Cria uma sessão nova e inicia a primeira série do primeiro exercício. */
export function startWorkout(workout: Workout, options: StartWorkoutOptions = {}): EngineResult {
  assertValidWorkout(workout)

  const now = options.now ?? Date.now()
  const events: WorkoutEvent[] = []
  const firstExercise = workout.exercises[0]

  const exercisesProgress: ExerciseProgress[] = workout.exercises.map((exercise) => ({
    exerciseId: exercise.id,
    completedSets: 0,
    sets: [],
    completed: false,
    completedAt: null,
  }))

  const session: WorkoutSession = {
    id: options.id ?? createSessionId(),
    workoutId: workout.id,
    workoutName: workout.name,
    status: 'active',
    startedAt: toIso(now),
    pausedAt: null,
    finishedAt: null,
    currentExerciseIndex: 0,
    currentSet: 1,
    currentPhase: 'work',
    remainingTime: 0,
    phaseStartedAt: toIso(now),
    phaseEndsAt: null,
    totalPausedMs: 0,
    completedSets: 0,
    exercisesProgress,
    duration: 0,
  }

  events.push({
    type: 'workout-started',
    phase: 'work',
    exerciseIndex: 0,
    exerciseId: firstExercise.id,
    at: now,
  })
  events.push({
    type: 'exercise-started',
    phase: 'work',
    exerciseIndex: 0,
    exerciseId: firstExercise.id,
    at: now,
  })
  beginSetWork(session, firstExercise, now, events)

  return { session, events }
}

/**
 * Avança o estado até o instante `now`, percorrendo as etapas já vencidas.
 *
 * É idempotente: chamado duas vezes com o mesmo `now` devolve o mesmo estado e
 * não duplica séries nem transições. Quando nada muda, devolve a própria sessão
 * de entrada (mesma referência), o que permite usá-lo como atualização visual
 * sem gerar gravações desnecessárias.
 */
export function tick(session: WorkoutSession, workout: Workout, now: number): EngineResult {
  if (session.status !== 'active') {
    return { session, events: [] }
  }

  const events: WorkoutEvent[] = []
  let draft = session
  let mutated = false
  let steps = 0
  const maxSteps = workout.exercises.reduce((total, exercise) => total + exercise.sets * 2 + 2, 0)

  while (
    draft.status === 'active' &&
    draft.currentPhase !== 'completed' &&
    draft.phaseEndsAt !== null &&
    parseIso(draft.phaseEndsAt) <= now
  ) {
    if (steps++ > maxSteps) {
      throw new WorkoutEngineError('tick: número de transições excedeu o esperado.')
    }
    if (!mutated) {
      draft = cloneSession(session)
      mutated = true
    }

    const boundaryMs = parseIso(draft.phaseEndsAt as string)
    const exercise = workout.exercises[draft.currentExerciseIndex]

    if (draft.currentPhase === 'work') {
      concludeCurrentSet(draft, workout, exercise, boundaryMs, events)
    } else if (draft.currentPhase === 'rest') {
      beginNextSetAfterRest(draft, exercise, boundaryMs, events)
    }
  }

  if (!mutated) {
    return { session, events: [] }
  }

  draft.remainingTime = remainingForSession(draft, now)
  return { session: draft, events }
}

/** Conclui manualmente a série atual (modalidade `reps`; também encerra `timed`). */
export function completeSet(
  session: WorkoutSession,
  workout: Workout,
  now: number,
  options: { actualRepetitions?: number } = {},
): EngineResult {
  assertActive(session, 'completeSet')
  if (session.currentPhase !== 'work') {
    throw new WorkoutEngineError('completeSet: não há série em andamento.')
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []
  const exercise = workout.exercises[draft.currentExerciseIndex]

  concludeCurrentSet(draft, workout, exercise, now, events, options.actualRepetitions)
  draft.remainingTime = remainingForSession(draft, now)

  return { session: draft, events }
}

/**
 * Encerra a série atual antecipadamente **sem** contabilizá-la como concluída.
 *
 * Regras (produto):
 * - havendo séries pendentes, inicia imediatamente o descanso configurado;
 * - na última série, finaliza o exercício sem iniciar descanso;
 * - como não conclui a série, não incrementa as séries concluídas (a série é
 *   registrada como pulada).
 *
 * É distinto de `completeSet`, que marca a série como concluída.
 */
export function skipSet(session: WorkoutSession, workout: Workout, now: number): EngineResult {
  assertActive(session, 'skipSet')
  if (session.currentPhase !== 'work') {
    throw new WorkoutEngineError('skipSet: não há série em andamento.')
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []
  const exercise = workout.exercises[draft.currentExerciseIndex]

  skipCurrentSet(draft, workout, exercise, now, events)
  draft.remainingTime = remainingForSession(draft, now)

  return { session: draft, events }
}

/** Pula o descanso e inicia imediatamente a próxima série. */
export function skipRest(session: WorkoutSession, workout: Workout, now: number): EngineResult {
  assertActive(session, 'skipRest')
  if (session.currentPhase !== 'rest') {
    throw new WorkoutEngineError('skipRest: não há descanso em andamento.')
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []
  const exercise = workout.exercises[draft.currentExerciseIndex]

  beginNextSetAfterRest(draft, exercise, now, events)
  draft.remainingTime = remainingForSession(draft, now)

  return { session: draft, events }
}

/** Estende o descanso atual em `seconds`. Não permitido fora da etapa de descanso. */
export function extendRest(
  session: WorkoutSession,
  now: number,
  seconds: number,
): EngineResult {
  assertActive(session, 'extendRest')
  if (session.currentPhase !== 'rest') {
    throw new WorkoutEngineError('extendRest: só é possível estender durante o descanso.')
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new WorkoutEngineError('extendRest: o acréscimo deve ser positivo.')
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []
  const currentEnd = draft.phaseEndsAt ? parseIso(draft.phaseEndsAt) : now
  const newEnd = Math.max(currentEnd, now) + seconds * 1000

  draft.phaseEndsAt = toIso(newEnd)
  draft.remainingTime = Math.max(0, Math.ceil((newEnd - now) / 1000))

  events.push({
    type: 'rest-extended',
    phase: 'rest',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: draft.exercisesProgress[draft.currentExerciseIndex]?.exerciseId,
    set: draft.currentSet,
    seconds,
    at: now,
  })

  return { session: draft, events }
}

/** Pausa a sessão congelando o tempo restante da etapa atual. */
export function pauseWorkout(session: WorkoutSession, now: number): EngineResult {
  assertActive(session, 'pauseWorkout')

  const draft = cloneSession(session)
  const frozen = remainingForSession(session, now)

  draft.status = 'paused'
  draft.pausedAt = toIso(now)
  draft.remainingTime = frozen

  return {
    session: draft,
    events: [
      {
        type: 'workout-paused',
        phase: draft.currentPhase,
        exerciseIndex: draft.currentExerciseIndex,
        set: draft.currentSet,
        at: now,
      },
    ],
  }
}

/** Retoma a sessão a partir do tempo restante congelado, com novas referências. */
export function resumeWorkout(session: WorkoutSession, now: number): EngineResult {
  if (session.status !== 'paused') {
    throw new WorkoutEngineError('resumeWorkout: a sessão não está pausada.')
  }

  const draft = cloneSession(session)
  const pausedAtMs = draft.pausedAt ? parseIso(draft.pausedAt) : now
  draft.totalPausedMs += Math.max(0, now - pausedAtMs)

  const wasTimed = session.phaseEndsAt !== null

  draft.status = 'active'
  draft.pausedAt = null

  if (draft.currentPhase === 'work' || draft.currentPhase === 'rest') {
    draft.phaseStartedAt = toIso(now)
    draft.phaseEndsAt = wasTimed ? toIso(now + draft.remainingTime * 1000) : null
  }

  return {
    session: draft,
    events: [
      {
        type: 'workout-resumed',
        phase: draft.currentPhase,
        exerciseIndex: draft.currentExerciseIndex,
        set: draft.currentSet,
        at: now,
      },
    ],
  }
}

/**
 * Avança manualmente para o próximo exercício, preservando o progresso já
 * registrado de cada exercício.
 */
export function advanceExercise(
  session: WorkoutSession,
  workout: Workout,
  now: number,
): EngineResult {
  assertActive(session, 'advanceExercise')

  const nextIndex = session.currentExerciseIndex + 1
  if (nextIndex >= workout.exercises.length) {
    throw new WorkoutEngineError('advanceExercise: já está no último exercício.')
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []

  beginExercise(draft, workout, nextIndex, now, events)
  draft.remainingTime = remainingForSession(draft, now)

  return { session: draft, events }
}

/**
 * Volta ao exercício anterior preservando o progresso já registrado.
 *
 * Não reinicia o exercício de destino: as séries concluídas permanecem
 * intactas. Para reiniciar, use `restartExercise`.
 */
export function goToPreviousExercise(
  session: WorkoutSession,
  workout: Workout,
  now: number,
): EngineResult {
  assertActive(session, 'goToPreviousExercise')

  const previousIndex = session.currentExerciseIndex - 1
  if (previousIndex < 0) {
    throw new WorkoutEngineError('goToPreviousExercise: já está no primeiro exercício.')
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []

  beginExercise(draft, workout, previousIndex, now, events)
  draft.remainingTime = remainingForSession(draft, now)

  return { session: draft, events }
}

/**
 * Reinicia explicitamente o exercício atual, apagando as séries já concluídas.
 *
 * É uma operação deliberada e **separada** da navegação: `advanceExercise` e
 * `goToPreviousExercise` preservam o progresso; apenas `restartExercise` o zera.
 */
export function restartExercise(
  session: WorkoutSession,
  workout: Workout,
  now: number,
): EngineResult {
  assertActive(session, 'restartExercise')

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []
  const index = draft.currentExerciseIndex

  resetExerciseProgress(draft, index)
  beginExercise(draft, workout, index, now, events)
  draft.remainingTime = remainingForSession(draft, now)

  return { session: draft, events }
}

/** Finaliza o treino (concluído pelo usuário). */
export function finishWorkout(session: WorkoutSession, now: number): EngineResult {
  if (session.status === 'completed' || session.status === 'abandoned') {
    throw new WorkoutEngineError(`finishWorkout: a sessão já está finalizada ("${session.status}").`)
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []

  completeSession(draft, now, events)

  return { session: draft, events }
}

/** Abandona o treino. */
export function abandonWorkout(session: WorkoutSession, now: number): EngineResult {
  if (session.status === 'completed' || session.status === 'abandoned') {
    throw new WorkoutEngineError(`abandonWorkout: a sessão já está finalizada ("${session.status}").`)
  }

  const draft = cloneSession(session)
  const events: WorkoutEvent[] = []

  abandonSession(draft, now, events)

  return { session: draft, events }
}
