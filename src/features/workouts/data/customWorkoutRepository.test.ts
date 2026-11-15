import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCustomWorkouts,
  deleteCustomWorkout,
  getCustomWorkout,
  listCustomWorkouts,
  saveCustomWorkout,
} from './customWorkoutRepository'
import {
  clearSessions,
  closeDatabase,
  listSessions,
  saveSession,
} from './workoutRepository'
import type { CustomWorkout, WorkoutSession } from '../domain/types'

const DB_NAME = 'calisthenics-app'

function makeCustomWorkout(overrides: Partial<CustomWorkout> = {}): CustomWorkout {
  return {
    id: 'custom-1',
    name: 'Meu treino',
    description: '2 exercícios · por tempo',
    estimatedMinutes: 5,
    exerciseCount: 3,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    exercises: [
      {
        id: 'a-agachamento',
        name: 'Agachamento livre',
        illustration: 'squat',
        instructions: 'Desça e suba.',
        executionType: 'timed',
        sets: 3,
        workDuration: 30,
        restDuration: 20,
      },
    ],
    ...overrides,
  }
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    workoutId: 'A',
    workoutName: 'Corpo inteiro',
    status: 'completed',
    startedAt: '2026-01-01T10:00:00.000Z',
    pausedAt: null,
    finishedAt: '2026-01-01T10:15:00.000Z',
    currentExerciseIndex: 0,
    currentSet: 1,
    currentPhase: 'completed',
    remainingTime: 0,
    phaseStartedAt: null,
    phaseEndsAt: null,
    totalPausedMs: 0,
    completedSets: 1,
    exercisesProgress: [],
    duration: 900,
    ...overrides,
  }
}

describe('customWorkoutRepository (IndexedDB)', () => {
  beforeEach(async () => {
    await clearCustomWorkouts()
    await clearSessions()
  })

  it('salva e recupera um treino personalizado', async () => {
    const workout = makeCustomWorkout()
    await saveCustomWorkout(workout)

    expect(await getCustomWorkout(workout.id)).toEqual(workout)
  })

  it('devolve null para um treino inexistente', async () => {
    expect(await getCustomWorkout('nao-existe')).toBeNull()
  })

  it('atualiza o mesmo id sem duplicar (upsert)', async () => {
    await saveCustomWorkout(makeCustomWorkout())
    await saveCustomWorkout(makeCustomWorkout({ name: 'Renomeado' }))

    const all = await listCustomWorkouts()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Renomeado')
  })

  it('lista os treinos mais recentemente atualizados primeiro', async () => {
    await saveCustomWorkout(makeCustomWorkout({ id: 'custom-a', updatedAt: '2026-01-01T10:00:00.000Z' }))
    await saveCustomWorkout(makeCustomWorkout({ id: 'custom-b', updatedAt: '2026-02-01T10:00:00.000Z' }))
    await saveCustomWorkout(makeCustomWorkout({ id: 'custom-c', updatedAt: '2026-01-15T10:00:00.000Z' }))

    const ids = (await listCustomWorkouts()).map((workout) => workout.id)
    expect(ids).toEqual(['custom-b', 'custom-c', 'custom-a'])
  })

  it('remove apenas o treino indicado', async () => {
    await saveCustomWorkout(makeCustomWorkout({ id: 'custom-a' }))
    await saveCustomWorkout(makeCustomWorkout({ id: 'custom-b' }))

    await deleteCustomWorkout('custom-a')

    expect(await getCustomWorkout('custom-a')).toBeNull()
    expect((await listCustomWorkouts()).map((workout) => workout.id)).toEqual(['custom-b'])
  })

  it('mantém os treinos após fechar e reabrir o banco', async () => {
    await saveCustomWorkout(makeCustomWorkout())
    closeDatabase()

    expect((await listCustomWorkouts()).map((workout) => workout.id)).toEqual(['custom-1'])
  })

  it('não apaga as sessões ao limpar os treinos personalizados', async () => {
    await saveCustomWorkout(makeCustomWorkout())
    await saveSession(makeSession())

    await clearCustomWorkouts()

    expect(await listCustomWorkouts()).toEqual([])
    expect((await listSessions()).map((session) => session.id)).toEqual(['session-1'])
  })

  it('não apaga os treinos personalizados ao limpar as sessões', async () => {
    await saveCustomWorkout(makeCustomWorkout())
    await saveSession(makeSession())

    await clearSessions()

    expect(await listSessions()).toEqual([])
    expect((await listCustomWorkouts()).map((workout) => workout.id)).toEqual(['custom-1'])
  })
})

/** Fecha a conexão cacheada e apaga o banco, para simular um dispositivo novo. */
async function resetDatabase(): Promise<void> {
  closeDatabase()
  // A conexão é fechada de forma assíncrona pelo repositório.
  await new Promise((resolve) => setTimeout(resolve, 10))

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

describe('migração IndexedDB v1 → v2', () => {
  it('cria o store de treinos personalizados preservando as sessões existentes', async () => {
    await resetDatabase()

    // Recria o banco na versão 1, no formato publicado antes dos treinos
    // personalizados: apenas `workoutSessions`.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)

      request.onupgradeneeded = () => {
        const database = request.result
        const store = database.createObjectStore('workoutSessions', { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('startedAt', 'startedAt', { unique: false })
        store.createIndex('finishedAt', 'finishedAt', { unique: false })
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('workoutSessions', 'readwrite')
        transaction.objectStore('workoutSessions').put(makeSession({ id: 'legacy' }))
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
      request.onerror = () => reject(request.error)
    })

    // O próximo acesso sobe o banco para a versão atual.
    const legacySessions = await listSessions()
    expect(legacySessions.map((session) => session.id)).toEqual(['legacy'])

    const customWorkouts = await listCustomWorkouts()
    expect(customWorkouts).toEqual([])

    await saveCustomWorkout(makeCustomWorkout())
    expect((await listCustomWorkouts()).map((workout) => workout.id)).toEqual(['custom-1'])
    expect((await listSessions()).map((session) => session.id)).toEqual(['legacy'])
  })
})
