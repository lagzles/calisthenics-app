import type { Exercise, Workout, WorkoutEvent, WorkoutSession } from './types'

/**
 * Transições de fase do motor.
 *
 * Funções de baixo nível que alteram uma cópia de trabalho da sessão e emitem
 * eventos. São consumidas pelo `workoutEngine`, que garante a clonagem e a
 * validação de estado antes de chamá-las.
 *
 * Regra de tempo: os limites de fase são sempre derivados do instante de
 * término da fase anterior (não do "agora"), para que a reconciliação após o
 * aplicativo ficar fechado permaneça fiel à linha do tempo real.
 */

export function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

export function parseIso(iso: string): number {
  return Date.parse(iso)
}

export function cloneSession(session: WorkoutSession): WorkoutSession {
  return JSON.parse(JSON.stringify(session)) as WorkoutSession
}

export function createSessionId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Duração de treino efetivo (segundos), descontando o tempo em pausa. */
export function computeElapsedSeconds(session: WorkoutSession, atMs: number): number {
  const pausedMs =
    session.status === 'paused' && session.pausedAt ? atMs - parseIso(session.pausedAt) : 0
  const elapsed = atMs - parseIso(session.startedAt) - session.totalPausedMs - pausedMs
  return Math.max(0, Math.round(elapsed / 1000))
}

/** Inicia a fase de execução da série atual (reiniciando o temporizador). */
export function beginSetWork(
  draft: WorkoutSession,
  exercise: Exercise,
  atMs: number,
  events: WorkoutEvent[],
): void {
  draft.currentPhase = 'work'
  draft.phaseStartedAt = toIso(atMs)

  if (exercise.executionType === 'timed' && exercise.workDuration) {
    draft.phaseEndsAt = toIso(atMs + exercise.workDuration * 1000)
    draft.remainingTime = exercise.workDuration
  } else {
    // Série por repetições: aguarda conclusão manual.
    draft.phaseEndsAt = null
    draft.remainingTime = 0
  }

  events.push({
    type: 'set-started',
    phase: 'work',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: exercise.id,
    set: draft.currentSet,
    at: atMs,
  })
}

/** Inicia a fase de descanso (após uma série que não é a última). */
export function beginRest(
  draft: WorkoutSession,
  exercise: Exercise,
  atMs: number,
  events: WorkoutEvent[],
): void {
  draft.currentPhase = 'rest'
  draft.phaseStartedAt = toIso(atMs)
  draft.phaseEndsAt = toIso(atMs + exercise.restDuration * 1000)
  draft.remainingTime = exercise.restDuration

  events.push({
    type: 'rest-started',
    phase: 'rest',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: exercise.id,
    set: draft.currentSet,
    at: atMs,
  })
}

/** Encerra o descanso e inicia a próxima série. */
export function beginNextSetAfterRest(
  draft: WorkoutSession,
  exercise: Exercise,
  atMs: number,
  events: WorkoutEvent[],
): void {
  const restingSet = draft.currentSet
  draft.currentSet += 1

  events.push({
    type: 'rest-ended',
    phase: 'rest',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: exercise.id,
    set: restingSet,
    at: atMs,
  })

  beginSetWork(draft, exercise, atMs, events)
}

/**
 * Conclui a série atual. Registra o progresso e avança para o descanso, para a
 * próxima série ou para a conclusão do exercício.
 */
export function concludeCurrentSet(
  draft: WorkoutSession,
  workout: Workout,
  exercise: Exercise,
  atMs: number,
  events: WorkoutEvent[],
  actualRepetitions?: number,
): void {
  const progress = draft.exercisesProgress[draft.currentExerciseIndex]
  const workSeconds =
    exercise.executionType === 'timed' && draft.phaseStartedAt
      ? Math.round((atMs - parseIso(draft.phaseStartedAt)) / 1000)
      : undefined

  progress.sets.push({
    set: draft.currentSet,
    completedAt: toIso(atMs),
    ...(actualRepetitions !== undefined ? { actualRepetitions } : {}),
    ...(workSeconds !== undefined ? { workSeconds } : {}),
  })
  progress.completedSets = progress.sets.length
  draft.completedSets += 1

  events.push({
    type: 'set-completed',
    phase: 'work',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: exercise.id,
    set: draft.currentSet,
    at: atMs,
  })

  const isLastSet = draft.currentSet >= exercise.sets
  if (!isLastSet) {
    if (exercise.restDuration > 0) {
      beginRest(draft, exercise, atMs, events)
    } else {
      // Sem descanso configurado: encadeia direto na próxima série.
      draft.currentSet += 1
      beginSetWork(draft, exercise, atMs, events)
    }
    return
  }

  completeCurrentExercise(draft, workout, atMs, events)
}

/**
 * Encerra a série atual antecipadamente, **sem** contabilizá-la como concluída.
 *
 * Difere de `concludeCurrentSet`: não registra a série em `progress.sets` nem
 * incrementa as séries concluídas — apenas contabiliza a série pulada. Em
 * seguida, inicia o descanso (se houver séries pendentes) ou finaliza o
 * exercício (na última série), sempre sem iniciar descanso após a última.
 */
export function skipCurrentSet(
  draft: WorkoutSession,
  workout: Workout,
  exercise: Exercise,
  atMs: number,
  events: WorkoutEvent[],
): void {
  const progress = draft.exercisesProgress[draft.currentExerciseIndex]
  progress.skippedSets = (progress.skippedSets ?? 0) + 1

  events.push({
    type: 'set-skipped',
    phase: 'work',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: exercise.id,
    set: draft.currentSet,
    at: atMs,
  })

  const isLastSet = draft.currentSet >= exercise.sets
  if (!isLastSet) {
    if (exercise.restDuration > 0) {
      beginRest(draft, exercise, atMs, events)
    } else {
      draft.currentSet += 1
      beginSetWork(draft, exercise, atMs, events)
    }
    return
  }

  completeCurrentExercise(draft, workout, atMs, events)
}

/**
 * Marca o exercício atual como concluído. Se for o último exercício, conclui o
 * treino; caso contrário, deixa a sessão na etapa `completed`, aguardando o
 * avanço para o próximo exercício.
 */
export function completeCurrentExercise(
  draft: WorkoutSession,
  workout: Workout,
  atMs: number,
  events: WorkoutEvent[],
): void {
  const progress = draft.exercisesProgress[draft.currentExerciseIndex]
  progress.completed = true
  progress.completedAt = toIso(atMs)

  draft.currentPhase = 'completed'
  draft.phaseStartedAt = toIso(atMs)
  draft.phaseEndsAt = null
  draft.remainingTime = 0

  events.push({
    type: 'exercise-completed',
    phase: 'completed',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: progress.exerciseId,
    at: atMs,
  })

  if (draft.currentExerciseIndex >= workout.exercises.length - 1) {
    completeSession(draft, atMs, events)
  }
}

/**
 * Inicia um exercício preservando o progresso já registrado.
 *
 * Navegar entre exercícios **não** reinicia o exercício: as séries concluídas
 * permanecem intactas. A sessão retoma a partir da próxima série não concluída
 * (ou exibe o exercício como concluído, quando ele já foi finalizado). Para
 * reiniciar deliberadamente, use a operação explícita `restartExercise`.
 */
export function beginExercise(
  draft: WorkoutSession,
  workout: Workout,
  index: number,
  atMs: number,
  events: WorkoutEvent[],
): void {
  draft.currentExerciseIndex = index

  const exercise = workout.exercises[index]
  const progress = draft.exercisesProgress[index]

  events.push({
    type: 'exercise-started',
    exerciseIndex: index,
    exerciseId: exercise.id,
    at: atMs,
  })

  // Exercício já concluído: preserva o progresso e o mantém em exibição.
  if (progress.completed) {
    draft.currentSet = exercise.sets
    draft.currentPhase = 'completed'
    draft.phaseStartedAt = toIso(atMs)
    draft.phaseEndsAt = null
    draft.remainingTime = 0
    return
  }

  draft.currentSet = progress.completedSets + 1
  beginSetWork(draft, exercise, atMs, events)
}

/**
 * Zera o progresso de um exercício.
 *
 * Usada **apenas** pela operação explícita de reinício (`restartExercise`);
 * a navegação entre exercícios nunca apaga séries concluídas.
 */
export function resetExerciseProgress(draft: WorkoutSession, index: number): void {
  const progress = draft.exercisesProgress[index]
  if (!progress) return
  draft.completedSets -= progress.completedSets
  progress.completedSets = 0
  progress.sets = []
  progress.completed = false
  progress.completedAt = null
}

/** Conclui o treino. */
export function completeSession(
  draft: WorkoutSession,
  atMs: number,
  events: WorkoutEvent[],
): void {
  draft.duration = computeElapsedSeconds(draft, atMs)
  draft.status = 'completed'
  draft.currentPhase = 'completed'
  draft.phaseEndsAt = null
  draft.remainingTime = 0
  draft.pausedAt = null
  draft.finishedAt = toIso(atMs)

  events.push({
    type: 'workout-completed',
    phase: 'completed',
    exerciseIndex: draft.currentExerciseIndex,
    at: atMs,
  })
}

/** Abandona o treino. */
export function abandonSession(
  draft: WorkoutSession,
  atMs: number,
  events: WorkoutEvent[],
): void {
  draft.duration = computeElapsedSeconds(draft, atMs)
  draft.status = 'abandoned'
  draft.phaseEndsAt = null
  draft.remainingTime = 0
  draft.pausedAt = null
  draft.finishedAt = toIso(atMs)

  events.push({
    type: 'workout-abandoned',
    phase: draft.currentPhase,
    exerciseIndex: draft.currentExerciseIndex,
    at: atMs,
  })
}
