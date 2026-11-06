import { useEffect, useState } from 'react'
import { workouts } from '../data/workouts.data'
import { listCompletedSessions } from '../data/workoutRepository'
import type { HomeSummary, Workout, WorkoutSession } from '../domain/types'
import { getRecommendedWorkoutId } from '../recommendation'
import { buildHomeSummary, WEEKLY_WORKOUTS_GOAL } from '../sessionSummary'

export interface HomeData {
  loading: boolean
  summary: HomeSummary
  recommended: Workout
  lastWorkout: Workout | null
  totalWorkouts: number
}

const EMPTY_SUMMARY: HomeSummary = {
  weeklyWorkoutsCompleted: 0,
  weeklyWorkoutsGoal: WEEKLY_WORKOUTS_GOAL,
  lastWorkout: null,
}

const FALLBACK_WORKOUT = workouts[0]

function findByWorkoutId(id: string | null | undefined): Workout | null {
  if (!id) return null
  return workouts.find((workout) => workout.id === id) ?? null
}

/**
 * Carrega o resumo real da Home a partir das sessões concluídas no IndexedDB.
 *
 * A regra de recomendação (§4) e a contagem só usam sessões concluídas — o
 * histórico nunca contabiliza sessões abandonadas, pausadas ou ativas.
 */
export function useHomeData(): HomeData {
  const [state, setState] = useState<HomeData>({
    loading: true,
    summary: EMPTY_SUMMARY,
    recommended: FALLBACK_WORKOUT,
    lastWorkout: null,
    totalWorkouts: workouts.length,
  })

  useEffect(() => {
    let cancelled = false

    void listCompletedSessions()
      .then((sessions: WorkoutSession[]) => {
        if (cancelled) return
        const now = Date.now()
        const summary = buildHomeSummary(sessions, now)
        const lastWorkoutId = summary.lastWorkout?.workoutId ?? null
        const recommendedId = getRecommendedWorkoutId(lastWorkoutId)

        setState({
          loading: false,
          summary,
          recommended: findByWorkoutId(recommendedId) ?? FALLBACK_WORKOUT,
          lastWorkout: findByWorkoutId(lastWorkoutId),
          totalWorkouts: workouts.length,
        })
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ ...previous, loading: false }))
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
