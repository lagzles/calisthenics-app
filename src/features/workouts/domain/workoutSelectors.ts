import type { Exercise, SessionSnapshot, Workout, WorkoutSession } from './types'
import { computeElapsedSeconds } from './workoutTransitions'

/**
 * Seletores de leitura do motor.
 *
 * Calculam, a partir da sessão e de uma referência de tempo, os dados que a
 * interface de execução precisa exibir — sempre derivados de timestamps reais.
 * Nenhuma função aqui altera a sessão.
 */

/** Tempo restante (segundos) da etapa atual, calculado em tempo real. */
export function getRemainingTime(session: WorkoutSession, now: number): number {
  if (session.status === 'paused') return session.remainingTime
  if (session.status !== 'active') return 0
  if (!session.phaseEndsAt) return session.remainingTime
  return Math.max(0, Math.ceil((Date.parse(session.phaseEndsAt) - now) / 1000))
}

/** Duração efetiva do treino (segundos), descontando pausas. */
export function getElapsedSeconds(session: WorkoutSession, now: number): number {
  if (session.status === 'completed' || session.status === 'abandoned') {
    return session.duration
  }
  return computeElapsedSeconds(session, now)
}

/** Total de séries concluídas em um treino. */
export function countCompletedSets(session: WorkoutSession): number {
  return session.exercisesProgress.reduce((total, progress) => total + progress.completedSets, 0)
}

/** Total de séries do treino. */
export function countTotalSets(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets, 0)
}

/**
 * Tempo médio (segundos) considerado para uma repetição na estimativa.
 *
 * Aproximação de apresentação: exercícios por repetições não têm duração
 * previsível, mas sem esta constante o treino seria exibido como "0 min".
 */
export const SECONDS_PER_REPETITION = 3

/**
 * Duração estimada (segundos) de um exercício.
 *
 * Regra de produto: `workDuration` (ou repetições × `SECONDS_PER_REPETITION`)
 * por série + `restDuration` entre séries. **Não** há descanso após a última
 * série de cada exercício.
 */
export function estimateExerciseSeconds(exercise: Exercise): number {
  const workPerSet =
    exercise.executionType === 'timed'
      ? exercise.workDuration
      : exercise.repetitions
        ? exercise.repetitions * SECONDS_PER_REPETITION
        : undefined
  if (!workPerSet) return 0

  const work = exercise.sets * workPerSet
  const rests = Math.max(0, exercise.sets - 1) * exercise.restDuration
  return work + rests
}

/** Duração estimada (segundos) de um treino inteiro. */
export function estimateWorkoutSeconds(workout: Workout): number {
  const exercises = workout.exercises.reduce(
    (total, exercise) => total + estimateExerciseSeconds(exercise),
    0,
  )

  if (!workout.restBetweenExercises) return exercises

  // Descanso entre exercícios: o do exercício que acabou, exceto no último.
  const transitions = workout.exercises
    .slice(0, -1)
    .reduce((total, exercise) => total + exercise.restDuration, 0)

  return exercises + transitions
}

/** Duração estimada (minutos, arredondada) de um treino inteiro. */
export function estimateWorkoutMinutes(workout: Workout): number {
  return Math.round(estimateWorkoutSeconds(workout) / 60)
}

/** Instantâneo completo da sessão para a interface. */
export function getSessionSnapshot(
  session: WorkoutSession,
  workout: Workout,
  now: number,
): SessionSnapshot {
  const exerciseIndex = session.currentExerciseIndex
  const exercise = workout.exercises[exerciseIndex]
  const progress = session.exercisesProgress[exerciseIndex]

  const totalSets = countTotalSets(workout)
  const completedSets = countCompletedSets(session)

  const exerciseCompletedSets = progress ? progress.completedSets : 0
  const exerciseProgress =
    exercise && exercise.sets > 0 ? Math.min(1, exerciseCompletedSets / exercise.sets) : 0
  const workoutProgress = totalSets > 0 ? Math.min(1, completedSets / totalSets) : 0

  const isActive = session.status === 'active'
  const isPaused = session.status === 'paused'

  return {
    session,
    status: session.status,
    phase: session.currentPhase,
    exercise,
    exerciseIndex,
    exerciseCount: workout.exercises.length,
    nextExercise: workout.exercises[exerciseIndex + 1],
    currentSet: session.currentSet,
    totalSets: exercise ? exercise.sets : 0,
    remainingTime: getRemainingTime(session, now),
    elapsedSeconds: getElapsedSeconds(session, now),
    exerciseProgress,
    workoutProgress,
    isPaused,
    isRunning: isActive && session.currentPhase !== 'completed',
    isExerciseComplete: progress ? progress.completed : false,
    isWorkoutComplete: session.status === 'completed',
    canPause: isActive,
    canResume: isPaused,
    canSkipRest: isActive && session.currentPhase === 'rest',
    canExtendRest: isActive && session.currentPhase === 'rest',
    canSkipSet: isActive && session.currentPhase === 'work',
    canCompleteSet:
      isActive && session.currentPhase === 'work' && exercise?.executionType === 'reps',
    canAdvance: isActive && exerciseIndex < workout.exercises.length - 1,
    canGoBack: isActive && exerciseIndex > 0,
  }
}
