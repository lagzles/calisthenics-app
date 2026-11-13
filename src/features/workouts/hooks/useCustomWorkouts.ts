import { useCallback, useEffect, useState } from 'react'
import { listCustomWorkouts } from '../data/customWorkoutRepository'
import type { CustomWorkout } from '../domain/types'

export interface CustomWorkoutsData {
  loading: boolean
  workouts: CustomWorkout[]
  /** Recarrega a lista (após criar, editar ou excluir). */
  reload: () => void
}

/**
 * Carrega os treinos personalizados salvos no IndexedDB.
 *
 * Mesmo padrão de `useHistoryData`: a leitura é assíncrona e falhas degradam em
 * silêncio (a seção apenas fica vazia), sem bloquear a tela de treinos.
 */
export function useCustomWorkouts(): CustomWorkoutsData {
  const [state, setState] = useState<{ loading: boolean; workouts: CustomWorkout[] }>({
    loading: true,
    workouts: [],
  })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false

    void listCustomWorkouts()
      .then((workouts) => {
        if (!cancelled) setState({ loading: false, workouts })
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ ...previous, loading: false }))
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { ...state, reload }
}
