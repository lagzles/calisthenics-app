import type { CustomWorkout } from '../domain/types'
import { requestToPromise, withStore } from './workoutRepository'

/**
 * Persistência dos treinos personalizados em IndexedDB.
 *
 * Store separado das sessões (`workoutSessions`): aqui ficam as **definições**
 * de treino criadas pelo usuário, não execuções. A conexão e as migrações são
 * compartilhadas com `workoutRepository` (mesmo banco, mesma versão).
 */

const CUSTOM_WORKOUTS_STORE = 'customWorkouts'

function byUpdatedAtDesc(a: CustomWorkout, b: CustomWorkout): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}

/** Insere ou atualiza um treino personalizado. */
export function saveCustomWorkout(workout: CustomWorkout): Promise<void> {
  return withStore(CUSTOM_WORKOUTS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.put(workout))
  })
}

/** Recupera um treino personalizado pelo id. */
export async function getCustomWorkout(id: string): Promise<CustomWorkout | null> {
  const result = await withStore(CUSTOM_WORKOUTS_STORE, 'readonly', (store) =>
    requestToPromise<CustomWorkout | undefined>(store.get(id)),
  )
  return result ?? null
}

/** Lista os treinos personalizados, mais recentemente atualizados primeiro. */
export async function listCustomWorkouts(): Promise<CustomWorkout[]> {
  const all = await withStore(CUSTOM_WORKOUTS_STORE, 'readonly', (store) =>
    requestToPromise<CustomWorkout[]>(store.getAll()),
  )
  return all.sort(byUpdatedAtDesc)
}

/** Remove um treino personalizado. */
export function deleteCustomWorkout(id: string): Promise<void> {
  return withStore(CUSTOM_WORKOUTS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id))
  })
}

/** Remove todos os treinos personalizados (testes e "limpar dados"). */
export function clearCustomWorkouts(): Promise<void> {
  return withStore(CUSTOM_WORKOUTS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.clear())
  })
}
