import type { WorkoutSession } from '../domain/types'

/**
 * Persistência das sessões de treino em IndexedDB.
 *
 * Camada isolada do motor: conhece apenas o modelo `WorkoutSession` e expõe
 * operações assíncronas. O motor (`workoutEngine`) e a interface não sabem como
 * os dados são gravados — apenas a `workoutService` faz a ponte.
 *
 * O banco possui versão e um ponto único de migração (`upgrade`), permitindo
 * evoluir o esquema sem recriar o banco.
 */

const DB_NAME = 'calisthenics-app'
const DB_VERSION = 1
const SESSIONS_STORE = 'workoutSessions'

let databasePromise: Promise<IDBDatabase> | null = null

/** Migrações, aplicadas conforme a versão anterior do banco. */
function upgradeDatabase(
  database: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
): void {
  void transaction

  if (oldVersion < 1) {
    const store = database.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
    store.createIndex('status', 'status', { unique: false })
    store.createIndex('startedAt', 'startedAt', { unique: false })
    store.createIndex('finishedAt', 'finishedAt', { unique: false })
  }
}

/** Abre (ou reaproveita) a conexão com o banco. */
export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      upgradeDatabase(
        request.result,
        request.transaction as IDBTransaction,
        event.oldVersion,
      )
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o IndexedDB.'))
    request.onblocked = () => reject(new Error('Abertura do IndexedDB bloqueada.'))
  })

  return databasePromise
}

/** Fecha a conexão (útil para testes e logout de dados). */
export function closeDatabase(): void {
  if (!databasePromise) return
  const current = databasePromise
  databasePromise = null
  void current.then((database) => database.close()).catch(() => undefined)
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Erro no IndexedDB.'))
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Erro na transação do IndexedDB.'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Transação do IndexedDB abortada.'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase()
  const transaction = database.transaction(SESSIONS_STORE, mode)
  const store = transaction.objectStore(SESSIONS_STORE)
  const result = await run(store)
  if (mode === 'readwrite') {
    await transactionToPromise(transaction)
  }
  return result
}

function byStartedAtDesc(a: WorkoutSession, b: WorkoutSession): number {
  return b.startedAt.localeCompare(a.startedAt)
}

function byFinishedAtDesc(a: WorkoutSession, b: WorkoutSession): number {
  return (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')
}

/** Insere ou atualiza uma sessão. */
export function saveSession(session: WorkoutSession): Promise<void> {
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.put(session))
  })
}

/** Recupera uma sessão pelo id. */
export async function getSession(id: string): Promise<WorkoutSession | null> {
  const result = await withStore('readonly', (store) =>
    requestToPromise<WorkoutSession | undefined>(store.get(id)),
  )
  return result ?? null
}

/** Lista todas as sessões, mais recentes primeiro. */
export async function listSessions(): Promise<WorkoutSession[]> {
  const all = await withStore('readonly', (store) =>
    requestToPromise<WorkoutSession[]>(store.getAll()),
  )
  return all.sort(byStartedAtDesc)
}

/** Lista apenas as sessões concluídas, mais recentes primeiro. */
export async function listCompletedSessions(): Promise<WorkoutSession[]> {
  const all = await listSessions()
  return all.filter((session) => session.status === 'completed').sort(byFinishedAtDesc)
}

/** Retorna a sessão ativa ou pausada mais recente, se houver. */
export async function getActiveSession(): Promise<WorkoutSession | null> {
  const all = await listSessions()
  const open = all.find(
    (session) => session.status === 'active' || session.status === 'paused',
  )
  return open ?? null
}

/** Remove uma sessão. */
export function deleteSession(id: string): Promise<void> {
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(id))
  })
}

/** Remove todas as sessões (histórico). */
export function clearSessions(): Promise<void> {
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.clear())
  })
}
