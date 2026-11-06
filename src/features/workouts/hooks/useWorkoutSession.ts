import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveSession } from '../data/workoutRepository'
import type { EngineResult, Workout, WorkoutEvent, WorkoutSession } from '../domain/types'
import {
  abandonWorkout,
  advanceExercise,
  completeSet,
  extendRest,
  finishWorkout,
  goToPreviousExercise,
  pauseWorkout,
  restartExercise,
  resumeWorkout,
  skipRest,
  skipSet,
  tick,
} from '../domain/workoutEngine'
import { getSessionSnapshot } from '../domain/workoutSelectors'

/**
 * Hook de execução de um treino.
 *
 * É um invólucro fino sobre o motor: mantém a sessão em estado React, executa
 * um intervalo de atualização **apenas visual** e persiste a sessão quando há
 * transições reais.
 *
 * O intervalo NÃO é a fonte de verdade do temporizador: cada disparo recalcula
 * o estado a partir de `tick(session, workout, now)`, que usa timestamps reais.
 * Sem transições, `tick` devolve a mesma referência de sessão — logo nenhuma
 * gravação desnecessária acontece a cada segundo.
 *
 * Para iniciar/receber uma sessão recuperada, passe-a em `initialSession`. Um
 * novo treino deve montar um novo hook (ex.: via `key`).
 */
export interface UseWorkoutSessionOptions {
  workout: Workout
  initialSession: WorkoutSession
  /** Relógio injetável (padrão: `Date.now`). */
  now?: () => number
  /** Persistência injetável (padrão: repositório IndexedDB). */
  persist?: (session: WorkoutSession) => void | Promise<void>
  /** Recebe as transições para efeitos colaterais (ex.: áudio). */
  onEvents?: (events: WorkoutEvent[]) => void
  /** Intervalo de atualização visual, em ms. */
  refreshIntervalMs?: number
}

export function useWorkoutSession(options: UseWorkoutSessionOptions) {
  const {
    workout,
    initialSession,
    now = Date.now,
    persist = saveSession,
    onEvents,
    refreshIntervalMs = 250,
  } = options

  const [session, setSession] = useState<WorkoutSession>(initialSession)
  const [nowMs, setNowMs] = useState<number>(() => now())

  const sessionRef = useRef(session)
  const nowRef = useRef(now)
  const persistRef = useRef(persist)
  const eventsRef = useRef(onEvents)
  const skipFirstPersist = useRef(true)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    nowRef.current = now
  }, [now])

  useEffect(() => {
    persistRef.current = persist
  }, [persist])

  useEffect(() => {
    eventsRef.current = onEvents
  }, [onEvents])

  const commit = useCallback((result: EngineResult) => {
    sessionRef.current = result.session
    setSession(result.session)
    // Atualiza o relógio junto com a operação: evita um quadro com tempo
    // defasado ao retomar/estender antes do próximo disparo do intervalo.
    setNowMs(nowRef.current())
    if (result.events.length > 0 && eventsRef.current) {
      eventsRef.current(result.events)
    }
  }, [])

  const run = useCallback(
    (operation: (current: WorkoutSession) => EngineResult) => {
      const result = operation(sessionRef.current)
      commit(result)
      return result.session
    },
    [commit],
  )

  // Atualização visual: recalcula o tempo restante e avança fases vencidas.
  useEffect(() => {
    if (session.status !== 'active') return

    const intervalId = window.setInterval(() => {
      const current = nowRef.current()
      setNowMs(current)

      const currentSession = sessionRef.current
      const result = tick(currentSession, workout, current)
      if (result.session !== currentSession) {
        commit(result)
      }
    }, refreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [session.status, workout, refreshIntervalMs, commit])

  // Persiste apenas quando a sessão muda (transições), não a cada segundo.
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false
      return
    }
    void persistRef.current(session)
  }, [session])

  const snapshot = useMemo(
    () => getSessionSnapshot(session, workout, nowMs),
    [session, workout, nowMs],
  )

  const pause = useCallback(() => run((value) => pauseWorkout(value, nowRef.current())), [run])
  const resume = useCallback(() => run((value) => resumeWorkout(value, nowRef.current())), [run])
  const skip = useCallback(
    () => run((value) => skipRest(value, workout, nowRef.current())),
    [run, workout],
  )
  const skipCurrent = useCallback(
    () => run((value) => skipSet(value, workout, nowRef.current())),
    [run, workout],
  )
  const extend = useCallback(
    (seconds: number) => run((value) => extendRest(value, nowRef.current(), seconds)),
    [run],
  )
  const concludeSet = useCallback(
    (actualRepetitions?: number) =>
      run((value) =>
        completeSet(value, workout, nowRef.current(), {
          // Aceita apenas número: impede que um evento de clique (objeto não
          // clonável) seja gravado na sessão e quebre a persistência/`tick`.
          actualRepetitions: typeof actualRepetitions === 'number' ? actualRepetitions : undefined,
        }),
      ),
    [run, workout],
  )
  const next = useCallback(
    () => run((value) => advanceExercise(value, workout, nowRef.current())),
    [run, workout],
  )
  const previous = useCallback(
    () => run((value) => goToPreviousExercise(value, workout, nowRef.current())),
    [run, workout],
  )
  const restart = useCallback(
    () => run((value) => restartExercise(value, workout, nowRef.current())),
    [run, workout],
  )
  const finish = useCallback(() => run((value) => finishWorkout(value, nowRef.current())), [run])
  const abandon = useCallback(() => run((value) => abandonWorkout(value, nowRef.current())), [run])

  return {
    session,
    snapshot,
    pause,
    resume,
    skipRest: skip,
    skipSet: skipCurrent,
    extendRest: extend,
    completeSet: concludeSet,
    advanceExercise: next,
    goToPreviousExercise: previous,
    restartExercise: restart,
    finishWorkout: finish,
    abandonWorkout: abandon,
  }
}
