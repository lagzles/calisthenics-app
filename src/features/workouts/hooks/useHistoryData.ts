import { useEffect, useState } from 'react'
import { listCompletedSessions } from '../data/workoutRepository'
import type { WorkoutSession } from '../domain/types'

export interface HistoryData {
  loading: boolean
  sessions: WorkoutSession[]
}

/**
 * Carrega o histórico real (somente sessões concluídas) do IndexedDB.
 *
 * O calendário e os indicadores são derivados das sessões completas na própria
 * página (`historyCalendar`), permanecendo funções puras e testáveis.
 */
export function useHistoryData(): HistoryData {
  const [state, setState] = useState<HistoryData>({
    loading: true,
    sessions: [],
  })

  useEffect(() => {
    let cancelled = false

    void listCompletedSessions()
      .then((sessions) => {
        if (!cancelled) setState({ loading: false, sessions })
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
