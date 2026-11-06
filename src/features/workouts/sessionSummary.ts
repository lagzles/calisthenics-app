import type { HomeSummary, LastWorkoutSummary, WorkoutId, WorkoutSession } from './domain/types'

/**
 * Agregações de sessões para a Home e o Histórico.
 *
 * Funções puras que recebem as sessões persistidas e devolvem os números
 * exibidos. A regra "somente sessões concluídas contam" vive aqui — sessões
 * ativas, pausadas ou abandonadas nunca entram nos indicadores.
 */

export const WEEKLY_WORKOUTS_GOAL = 4

const DAY_MS = 86_400_000

export function isCompletedSession(session: WorkoutSession): boolean {
  return session.status === 'completed'
}

/** Instante de conclusão (epoch ms) de uma sessão concluída. */
export function completedAtMs(session: WorkoutSession): number | null {
  if (!isCompletedSession(session)) return null
  const ms = Date.parse(session.finishedAt ?? session.startedAt)
  return Number.isNaN(ms) ? null : ms
}

/** Início da semana (segunda-feira, 00:00 local). */
export function startOfWeekMonday(now: number): number {
  const date = new Date(now)
  const daysSinceMonday = (date.getDay() + 6) % 7
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysSinceMonday)
  return date.getTime()
}

export function isSameWeek(session: WorkoutSession, now: number): boolean {
  const completed = completedAtMs(session)
  if (completed === null) return false
  return completed >= startOfWeekMonday(now) && completed <= now
}

export function daysAgo(thenMs: number, now: number): number {
  return Math.max(0, Math.floor((now - thenMs) / DAY_MS))
}

function toWorkoutId(value: string): WorkoutId | null {
  return value === 'A' || value === 'B' ? value : null
}

function sortByCompletionDesc(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => (completedAtMs(b) ?? 0) - (completedAtMs(a) ?? 0))
}

/** Última sessão concluída (mais recente), ou `null`. */
export function findLastCompletedSession(sessions: WorkoutSession[]): WorkoutSession | null {
  const completed = sessions.filter(isCompletedSession)
  if (completed.length === 0) return null
  return sortByCompletionDesc(completed)[0]
}

/** Resumo da Home a partir das sessões reais (UI/UX §4). */
export function buildHomeSummary(
  sessions: WorkoutSession[],
  now: number,
  goal: number = WEEKLY_WORKOUTS_GOAL,
): HomeSummary {
  const completed = sessions.filter(isCompletedSession)
  const weeklyWorkoutsCompleted = completed.filter((session) => isSameWeek(session, now)).length

  let lastWorkout: LastWorkoutSummary | null = null
  const last = findLastCompletedSession(completed)
  if (last) {
    const workoutId = toWorkoutId(last.workoutId)
    const ms = completedAtMs(last)
    if (workoutId && ms !== null) {
      lastWorkout = {
        workoutId,
        daysAgo: daysAgo(ms, now),
        completedMinutes: Math.round(last.duration / 60),
      }
    }
  }

  return { weeklyWorkoutsCompleted, weeklyWorkoutsGoal: goal, lastWorkout }
}

export interface HistorySummary {
  totalWorkouts: number
  weeklyWorkouts: number
  totalMinutes: number
}

/** Resumo do Histórico (UI/UX §11). */
export function buildHistorySummary(sessions: WorkoutSession[], now: number): HistorySummary {
  const completed = sessions.filter(isCompletedSession)
  const totalSeconds = completed.reduce((total, session) => total + (session.duration || 0), 0)

  return {
    totalWorkouts: completed.length,
    weeklyWorkouts: completed.filter((session) => isSameWeek(session, now)).length,
    totalMinutes: Math.round(totalSeconds / 60),
  }
}

export interface SessionListItem {
  id: string
  workoutId: string
  workoutName: string
  finishedAt: string
  dateMs: number
  durationMinutes: number
  exercisesCompleted: number
  exercisesTotal: number
  setsCompleted: number
}

/** Converte uma sessão concluída em item de lista (ou `null` se incompleta). */
export function toSessionListItem(session: WorkoutSession): SessionListItem | null {
  const dateMs = completedAtMs(session)
  if (dateMs === null) return null

  return {
    id: session.id,
    workoutId: session.workoutId,
    workoutName: session.workoutName,
    finishedAt: session.finishedAt ?? session.startedAt,
    dateMs,
    durationMinutes: Math.round(session.duration / 60),
    exercisesCompleted: session.exercisesProgress.filter((progress) => progress.completed).length,
    exercisesTotal: session.exercisesProgress.length,
    setsCompleted: session.completedSets,
  }
}

/** Lista de itens das sessões concluídas, mais recentes primeiro. */
export function toSessionListItems(sessions: WorkoutSession[]): SessionListItem[] {
  return sortByCompletionDesc(sessions.filter(isCompletedSession))
    .map(toSessionListItem)
    .filter((item): item is SessionListItem => item !== null)
}
