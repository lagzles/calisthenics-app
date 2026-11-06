import { workouts } from '../features/workouts/data/workouts.data'
import * as repository from '../features/workouts/data/workoutRepository'
import type { EngineResult, Workout, WorkoutSession } from '../features/workouts/domain/types'
import { startWorkout, tick, type StartWorkoutOptions } from '../features/workouts/domain/workoutEngine'

/**
 * Camada de acesso a dados.
 *
 * Combina duas responsabilidades:
 *
 * - Catálogo: consultas síncronas aos treinos estáticos (Home e tela de treinos).
 * - Sessões: operações assíncronas que orquestram o motor (`workoutEngine`) e a
 *   persistência (`workoutRepository`). É o único ponto que liga os dois.
 */

export function getWorkouts(): Workout[] {
  return workouts
}

export function getWorkoutById(id: string): Workout | undefined {
  return workouts.find((workout) => workout.id === id)
}

/**
 * Resultado do carregamento da tela de execução (Workout Mode).
 *
 * - `ready`: há uma sessão em andamento recuperada — retomar a execução.
 * - `prepare`: nenhuma sessão ativa; exibir a **preparação** do treino
 *   solicitado. Nenhuma sessão é criada nesta etapa (o usuário inicia
 *   explicitamente).
 * - `missing`: o treino solicitado não existe.
 */
export type WorkoutModeLoad =
  | { status: 'ready'; workout: Workout; session: WorkoutSession }
  | { status: 'prepare'; workout: Workout }
  | { status: 'missing' }

/**
 * Prepara a tela de execução SEM iniciar o cronômetro.
 *
 * Recupera uma sessão em andamento quando existir; caso contrário, devolve o
 * estado de preparação do treino da rota. Importante: **não** cria sessão —
 * iniciar o treino é uma ação explícita do usuário (ver `startWorkoutSession`).
 */
export async function loadWorkoutMode(workoutId: string | undefined): Promise<WorkoutModeLoad> {
  const recovered = await recoverWorkoutSession()
  if (recovered) {
    const workout = getWorkoutById(recovered.session.workoutId)
    if (workout) return { status: 'ready', workout, session: recovered.session }
  }

  const requested = workoutId ? getWorkoutById(workoutId) : undefined
  if (!requested) return { status: 'missing' }

  return { status: 'prepare', workout: requested }
}

/* -------------------------------------------------------------------------- */
/* Sessões                                                                     */
/* -------------------------------------------------------------------------- */

/** Cria e persiste uma nova sessão para o treino indicado. */
export async function startWorkoutSession(
  workoutId: string,
  options: StartWorkoutOptions = {},
): Promise<EngineResult> {
  const workout = getWorkoutById(workoutId)
  if (!workout) {
    throw new Error(`Treino "${workoutId}" não encontrado.`)
  }

  const result = startWorkout(workout, options)
  await repository.saveSession(result.session)
  return result
}

/** Persiste (insere ou atualiza) uma sessão. */
export function persistSession(session: WorkoutSession): Promise<void> {
  return repository.saveSession(session)
}

/** Retorna a sessão ativa ou pausada mais recente. */
export function getActiveSession(): Promise<WorkoutSession | null> {
  return repository.getActiveSession()
}

/** Recupera uma sessão pelo id. */
export function getSessionById(id: string): Promise<WorkoutSession | null> {
  return repository.getSession(id)
}

/** Lista as sessões concluídas (histórico), mais recentes primeiro. */
export function getSessionHistory(): Promise<WorkoutSession[]> {
  return repository.listCompletedSessions()
}

/**
 * Descarta uma sessão em andamento (ação "Descartar sessão").
 *
 * Remove o registro do IndexedDB: a sessão não pode ser recuperada nem
 * contabilizada no histórico. Sessões descartadas nunca foram concluídas, então
 * não aparecem nos indicadores da Home nem do Histórico.
 */
export function discardSession(sessionId: string): Promise<void> {
  return repository.deleteSession(sessionId)
}

/**
 * Recupera e reconcilia a sessão em andamento, se houver.
 *
 * Aplicar `tick` com o horário atual reconstrói o progresso transcorrido
 * enquanto o aplicativo esteve fechado, sem reproduzir movimentos "atrasados".
 * A chamada é idempotente: repetir não duplica séries nem transições.
 *
 * Observação para a interface: os eventos retornados são **históricos** e não
 * devem disparar avisos sonoros.
 */
export async function recoverWorkoutSession(now: number = Date.now()): Promise<EngineResult | null> {
  const active = await repository.getActiveSession()
  if (!active) return null

  const workout = getWorkoutById(active.workoutId)
  if (!workout) {
    return { session: active, events: [] }
  }

  const result = tick(active, workout, now)
  if (result.session !== active) {
    await repository.saveSession(result.session)
  }
  return result
}
