import { useEffect, useState } from 'react'
import { listCompletedSessions } from '../data/workoutRepository'
import type { WorkoutSession } from '../domain/types'
import {
  buildHistorySummary,
  toSessionListItems,
  type HistorySummary,
  type SessionListItem,
} from '../sessionSummary'

export interface HistoryData {
  loading: boolean
  summary: HistorySummary
  items: SessionListItem[]
  sessions: WorkoutSession[]
}

const EMPTY_SUMMARY: HistorySummary = {
  totalWorkouts: 0,
  weeklyWorkouts: 0,
  totalMinutes: 0,
}

/**
 * Carrega o histórico real (somente sessões concluídas) do IndexedDB.
 *
 * Devolve tanto os itens prontos para a lista quanto as sessões completas, para
 * a tela de detalhes consultar as séries exercício a exercício.
 */
export function useHistoryData(): HistoryData {
  const [state, setState] = useState<HistoryData>({
    loading: true,
    summary: EMPTY_SUMMARY,
    items: [],
    sessions: [],
  })

  useEffect(() => {
    let cancelled = false

    void listCompletedSessions()
      .then((sessions) => {
        if (cancelled) return
        const now = Date.now()
        setState({
          loading: false,
          summary: buildHistorySummary(sessions, now),
          items: toSessionListItems(sessions),
          sessions,
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
