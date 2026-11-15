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

/**
 * Gera o id de um treino personalizado.
 *
 * O prefixo `custom-` mantém o id reconhecível e garante que ele nunca colida
 * com os ids dos presets (`'A'`/`'B'`). Só caracteres seguros para URL, pois o
 * id aparece em `/treino/:workoutId`.
 */
export function createCustomWorkoutId(): string {
  return `custom-${createSessionId()}`
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

/**
 * Inicia o descanso após uma série.
 *
 * Usado tanto entre séries quanto entre exercícios (quando o treino declara
 * `restBetweenExercises`). O tipo do descanso não é armazenado na sessão: é
 * derivado de `currentSet >= exercise.sets`, ou seja, o descanso iniciado depois
 * da última série é o descanso entre exercícios. Assim o esquema persistido não
 * muda e sessões antigas continuam válidas.
 */
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

/** Indica se o descanso em andamento é o que precede o próximo exercício. */
export function isRestBetweenExercises(draft: WorkoutSession, exercise: Exercise): boolean {
  return draft.currentSet >= exercise.sets
}

/**
 * Indica se a última série do exercício atual deve ser seguida de descanso antes
 * do próximo exercício.
 *
 * Condições: o treino declara `restBetweenExercises`, o descanso configurado é
 * maior que zero e **não** é o último exercício do treino (não há descanso
 * inútil depois da última série do treino).
 */
export function startsExerciseRest(
  draft: WorkoutSession,
  workout: Workout,
  exercise: Exercise,
): boolean {
  if (!workout.restBetweenExercises) return false
  if (exercise.restDuration <= 0) return false
  return draft.currentExerciseIndex < workout.exercises.length - 1
}

/**
 * Indica se, sem descanso a fazer, o treino deve avançar sozinho para o próximo
 * exercício (em vez de parar na etapa `completed` esperando o usuário).
 *
 * Só acontece quando o treino opta por descanso entre exercícios mas o exercício
 * atual não tem descanso configurado: não há nada a esperar, então a transição é
 * imediata — mesma convenção do encadeamento entre séries com `restDuration: 0`.
 */
function shouldChainNextExercise(
  draft: WorkoutSession,
  workout: Workout,
  exercise: Exercise,
): boolean {
  if (!workout.restBetweenExercises) return false
  if (exercise.restDuration > 0) return false
  return draft.currentExerciseIndex < workout.exercises.length - 1
}

/**
 * Encerra o descanso e continua o treino.
 *
 * - Descanso entre séries → inicia a próxima série do mesmo exercício.
 * - Descanso entre exercícios → avança para o próximo exercício, preservando o
 *   progresso já registrado (mesma convenção de `advanceExercise`).
 */
export function beginNextSetAfterRest(
  draft: WorkoutSession,
  workout: Workout,
  exercise: Exercise,
  atMs: number,
  events: WorkoutEvent[],
): void {
  const restingSet = draft.currentSet

  events.push({
    type: 'rest-ended',
    phase: 'rest',
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: exercise.id,
    set: restingSet,
    at: atMs,
  })

  if (isRestBetweenExercises(draft, exercise)) {
    beginExercise(draft, workout, draft.currentExerciseIndex + 1, atMs, events)
    return
  }

  draft.currentSet += 1
  beginSetWork(draft, exercise, atMs, events)
}

/**
 * Marca o exercício atual como concluído, **sem** alterar a etapa atual.
 *
 * Separado de `completeCurrentExercise` porque o descanso entre exercícios
 * precisa registrar a conclusão e ainda manter a fase de descanso.
 */
function markExerciseCompleted(
  draft: WorkoutSession,
  atMs: number,
  events: WorkoutEvent[],
): void {
  const progress = draft.exercisesProgress[draft.currentExerciseIndex]
  progress.completed = true
  progress.completedAt = toIso(atMs)

  events.push({
    type: 'exercise-completed',
    phase: draft.currentPhase,
    exerciseIndex: draft.currentExerciseIndex,
    exerciseId: progress.exerciseId,
    at: atMs,
  })
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

  // Última série: descansa antes do próximo exercício, quando o treino pede.
  if (startsExerciseRest(draft, workout, exercise)) {
    markExerciseCompleted(draft, atMs, events)
    beginRest(draft, exercise, atMs, events)
    return
  }

  // Treino encadeado, mas sem descanso configurado: segue direto.
  if (shouldChainNextExercise(draft, workout, exercise)) {
    markExerciseCompleted(draft, atMs, events)
    beginExercise(draft, workout, draft.currentExerciseIndex + 1, atMs, events)
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

  // Última série: descansa antes do próximo exercício, quando o treino pede.
  if (startsExerciseRest(draft, workout, exercise)) {
    markExerciseCompleted(draft, atMs, events)
    beginRest(draft, exercise, atMs, events)
    return
  }

  // Treino encadeado, mas sem descanso configurado: segue direto.
  if (shouldChainNextExercise(draft, workout, exercise)) {
    markExerciseCompleted(draft, atMs, events)
    beginExercise(draft, workout, draft.currentExerciseIndex + 1, atMs, events)
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
  draft.currentPhase = 'completed'
  draft.phaseStartedAt = toIso(atMs)
  draft.phaseEndsAt = null
  draft.remainingTime = 0

  markExerciseCompleted(draft, atMs, events)

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
