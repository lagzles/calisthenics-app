import { describe, expect, it } from 'vitest'
import { mixedWorkout, repsWorkout, timedWorkout } from '../data/workoutFixtures'
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
  startWorkout,
  tick,
  WorkoutEngineError,
} from './workoutEngine'
import { countCompletedSets, getRemainingTime, getSessionSnapshot } from './workoutSelectors'
import type { WorkoutSession } from './types'

const T0 = Date.parse('2026-01-01T10:00:00.000Z')
const at = (seconds: number): number => T0 + seconds * 1000
const iso = (seconds: number): string => new Date(at(seconds)).toISOString()

/** Cria a sessão inicial do treino por tempo no instante 0. */
function startTimed(): { session: WorkoutSession; workout: ReturnType<typeof timedWorkout> } {
  const workout = timedWorkout()
  const result = startWorkout(workout, { now: T0, id: 'session-timed' })
  return { session: result.session, workout }
}

describe('workoutEngine — exercício por tempo', () => {
  it('inicia na primeira série, em execução', () => {
    const { session } = startTimed()
    expect(session.status).toBe('active')
    expect(session.currentPhase).toBe('work')
    expect(session.currentSet).toBe(1)
    expect(session.phaseEndsAt).toBe(iso(30))
    expect(getRemainingTime(session, T0)).toBe(30)
  })

  it('alterna exercício e descanso automaticamente', () => {
    const { session: s0, workout } = startTimed()

    const afterWork1 = tick(s0, workout, at(30)).session
    expect(afterWork1.currentPhase).toBe('rest')
    expect(afterWork1.currentSet).toBe(1)
    expect(afterWork1.completedSets).toBe(1)
    expect(getRemainingTime(afterWork1, at(30))).toBe(10)

    const afterRest1 = tick(afterWork1, workout, at(40)).session
    expect(afterRest1.currentPhase).toBe('work')
    expect(afterRest1.currentSet).toBe(2)
    expect(getRemainingTime(afterRest1, at(40))).toBe(30)
  })

  it('não inicia descanso após a última série e conclui o treino', () => {
    const { session: s0, workout } = startTimed()
    const result = tick(s0, workout, at(110))

    expect(result.session.currentPhase).toBe('completed')
    expect(result.session.status).toBe('completed')
    expect(result.session.completedSets).toBe(3)
    expect(result.session.finishedAt).toBe(iso(110))

    // Nenhum descanso é iniciado depois da última série (set 3).
    const restsAfterLastSet = result.events.filter(
      (event) => event.type === 'rest-started' && event.set === 3,
    )
    expect(restsAfterLastSet).toHaveLength(0)
  })

  it('a conclusão usa o limite real da fase, não o instante da chamada', () => {
    const { session: s0, workout } = startTimed()
    const result = tick(s0, workout, at(3600))

    expect(result.session.status).toBe('completed')
    expect(result.session.completedSets).toBe(3)
    expect(result.session.finishedAt).toBe(iso(110))
  })
})

describe('workoutEngine — exercício por repetições', () => {
  it('aguarda conclusão manual, inicia descanso e avança de série', () => {
    const workout = repsWorkout()
    let session = startWorkout(workout, { now: T0, id: 'session-reps' }).session

    expect(session.currentPhase).toBe('work')
    expect(session.phaseEndsAt).toBeNull()

    // tick não avança sozinho um exercício por repetições.
    expect(tick(session, workout, at(999)).session).toBe(session)

    session = completeSet(session, workout, at(5), { actualRepetitions: 12 }).session
    expect(session.completedSets).toBe(1)
    expect(session.currentPhase).toBe('rest')
    expect(session.phaseEndsAt).toBe(iso(65))
    expect(session.exercisesProgress[0].sets[0].actualRepetitions).toBe(12)

    session = tick(session, workout, at(65)).session
    expect(session.currentPhase).toBe('work')
    expect(session.currentSet).toBe(2)

    session = completeSet(session, workout, at(70)).session
    session = tick(session, workout, at(130)).session
    expect(session.currentSet).toBe(3)

    session = completeSet(session, workout, at(140)).session
    expect(session.status).toBe('completed')
    expect(session.completedSets).toBe(3)
    expect(session.currentPhase).toBe('completed')
  })
})

describe('workoutEngine — pausa e retomada', () => {
  it('congela o tempo durante a pausa (exercício)', () => {
    const { session: s0, workout } = startTimed()
    const paused = pauseWorkout(s0, at(5)).session

    expect(paused.status).toBe('paused')
    expect(paused.remainingTime).toBe(25)
    expect(paused.pausedAt).toBe(iso(5))

    // Mesmo com muito tempo decorrido, o tempo permanece congelado.
    const still = tick(paused, workout, at(600)).session
    expect(still).toBe(paused)
    expect(getRemainingTime(still, at(600))).toBe(25)

    const resumed = resumeWorkout(still, at(600)).session
    expect(resumed.status).toBe('active')
    expect(resumed.phaseEndsAt).toBe(iso(625))
    expect(getRemainingTime(resumed, at(600))).toBe(25)
    expect(getRemainingTime(resumed, at(610))).toBe(15)
    expect(resumed.totalPausedMs).toBe(595_000)
  })

  it('congela o tempo durante a pausa (descanso)', () => {
    const { session: s0, workout } = startTimed()
    const rest = tick(s0, workout, at(30)).session
    const restLater = tick(rest, workout, at(34)).session
    expect(getRemainingTime(restLater, at(34))).toBe(6)

    const paused = pauseWorkout(restLater, at(34)).session
    expect(paused.remainingTime).toBe(6)

    const resumed = resumeWorkout(paused, at(100)).session
    expect(resumed.currentPhase).toBe('rest')
    expect(resumed.phaseEndsAt).toBe(iso(106))
    expect(getRemainingTime(resumed, at(100))).toBe(6)
  })
})

describe('workoutEngine — ajuste do descanso', () => {
  it('adiciona 10s, 15s e permite extensões sucessivas', () => {
    const { session: s0, workout } = startTimed()
    const rest = tick(s0, workout, at(30)).session
    const current = tick(rest, workout, at(34)).session
    expect(getRemainingTime(current, at(34))).toBe(6)

    const plus10 = extendRest(current, at(34), 10).session
    expect(getRemainingTime(plus10, at(34))).toBe(16)

    const plus15 = extendRest(plus10, at(34), 15).session
    expect(getRemainingTime(plus15, at(34))).toBe(31)
    expect(plus15.phaseEndsAt).toBe(iso(65))
  })

  it('impede extensão durante o exercício', () => {
    const { session: s0 } = startTimed()
    expect(() => extendRest(s0, at(5), 10)).toThrow(WorkoutEngineError)
  })

  it('impede extensão fora da etapa de descanso (sessão concluída)', () => {
    const { session: s0, workout } = startTimed()
    const finished = tick(s0, workout, at(110)).session
    expect(() => extendRest(finished, at(110), 10)).toThrow(WorkoutEngineError)
  })
})

describe('workoutEngine — pular e navegar', () => {
  it('pular descanso inicia imediatamente a próxima série', () => {
    const { session: s0, workout } = startTimed()
    const rest = tick(s0, workout, at(30)).session
    const skipped = skipRest(rest, workout, at(33)).session

    expect(skipped.currentPhase).toBe('work')
    expect(skipped.currentSet).toBe(2)
    expect(skipped.phaseEndsAt).toBe(iso(63))
  })

  it('pular descanso não registra série indevidamente', () => {
    const { session: s0, workout } = startTimed()
    const rest = tick(s0, workout, at(30)).session
    const skipped = skipRest(rest, workout, at(33)).session
    expect(skipped.completedSets).toBe(1)
  })

  it('volta ao exercício anterior sem perder as séries concluídas', () => {
    const workout = mixedWorkout()

    // Conclui o exercício 0 (por tempo, 2 séries) → etapa `completed`.
    let session = startWorkout(workout, { now: T0, id: 'session-mixed' }).session
    session = tick(session, workout, at(70)).session
    expect(session.currentPhase).toBe('completed')
    expect(session.currentExerciseIndex).toBe(0)
    expect(session.status).toBe('active')

    session = advanceExercise(session, workout, at(70)).session
    expect(session.currentExerciseIndex).toBe(1)
    expect(session.currentSet).toBe(1)
    expect(session.exercisesProgress[0].completed).toBe(true)

    const totalBefore = session.completedSets
    session = goToPreviousExercise(session, workout, at(70)).session

    expect(session.currentExerciseIndex).toBe(0)
    // As séries concluídas do exercício anterior permanecem intactas.
    expect(session.exercisesProgress[0].completed).toBe(true)
    expect(session.exercisesProgress[0].completedSets).toBe(2)
    expect(session.exercisesProgress[0].sets).toHaveLength(2)
    expect(session.currentPhase).toBe('completed')
    expect(session.currentSet).toBe(2)
    expect(session.completedSets).toBe(totalBefore)
  })

  it('retorna ao exercício em andamento sem perder o estado', () => {
    const workout = mixedWorkout()

    let session = startWorkout(workout, { now: T0, id: 'session-mixed' }).session
    session = tick(session, workout, at(70)).session
    session = advanceExercise(session, workout, at(70)).session

    // Exercício 1 (por repetições): conclui a 1ª série e entra no descanso.
    session = completeSet(session, workout, at(75), { actualRepetitions: 10 }).session
    expect(session.currentExerciseIndex).toBe(1)
    expect(session.currentPhase).toBe('rest')
    expect(session.exercisesProgress[1].completedSets).toBe(1)

    // Vai ao exercício 0 (concluído) e retorna ao exercício 1.
    session = goToPreviousExercise(session, workout, at(80)).session
    expect(session.currentExerciseIndex).toBe(0)
    expect(session.currentPhase).toBe('completed')

    session = advanceExercise(session, workout, at(80)).session
    expect(session.currentExerciseIndex).toBe(1)
    // Retoma na série seguinte, preservando a série já concluída.
    expect(session.currentSet).toBe(2)
    expect(session.currentPhase).toBe('work')
    expect(session.exercisesProgress[1].completedSets).toBe(1)
    expect(session.exercisesProgress[1].sets).toHaveLength(1)
  })

  it('preserva o estado da sessão após navegações entre exercícios', () => {
    const workout = mixedWorkout()

    let session = startWorkout(workout, { now: T0, id: 'session-mixed' }).session
    session = tick(session, workout, at(70)).session // exercício 0: 2 séries
    session = advanceExercise(session, workout, at(70)).session // exercício 1
    session = completeSet(session, workout, at(75), { actualRepetitions: 8 }).session // 1 série
    const totalBefore = session.completedSets

    session = goToPreviousExercise(session, workout, at(80)).session
    session = advanceExercise(session, workout, at(80)).session
    session = goToPreviousExercise(session, workout, at(80)).session

    expect(session.status).toBe('active')
    expect(session.completedSets).toBe(totalBefore)
    expect(countCompletedSets(session)).toBe(totalBefore)
    expect(session.exercisesProgress.map((progress) => progress.completedSets)).toEqual([2, 1])
  })

  it('reinicia explicitamente o exercício atual sem afetar os demais', () => {
    const workout = mixedWorkout()

    let session = startWorkout(workout, { now: T0, id: 'session-mixed' }).session
    session = tick(session, workout, at(70)).session // exercício 0 concluído
    session = advanceExercise(session, workout, at(70)).session
    session = completeSet(session, workout, at(75), { actualRepetitions: 10 }).session
    expect(session.completedSets).toBe(3)

    session = restartExercise(session, workout, at(80)).session

    expect(session.currentExerciseIndex).toBe(1)
    expect(session.currentSet).toBe(1)
    expect(session.currentPhase).toBe('work')
    expect(session.exercisesProgress[1].completedSets).toBe(0)
    expect(session.exercisesProgress[1].sets).toEqual([])
    // O exercício anterior permanece intacto.
    expect(session.exercisesProgress[0].completed).toBe(true)
    expect(session.exercisesProgress[0].completedSets).toBe(2)
    expect(session.completedSets).toBe(2)
  })

  it('não avança além do último exercício', () => {
    const workout = repsWorkout()
    const session = startWorkout(workout, { now: T0, id: 'session-single' }).session
    expect(() => advanceExercise(session, workout, at(1))).toThrow(WorkoutEngineError)
  })
})

describe('workoutEngine — finalizar e abandonar', () => {
  it('finaliza registrando a duração efetiva', () => {
    const { session: s0 } = startTimed()
    const finished = finishWorkout(s0, at(5)).session
    expect(finished.status).toBe('completed')
    expect(finished.duration).toBe(5)
    expect(finished.finishedAt).toBe(iso(5))
  })

  it('abandona a sessão', () => {
    const { session: s0 } = startTimed()
    const abandoned = abandonWorkout(s0, at(45)).session
    expect(abandoned.status).toBe('abandoned')
    expect(abandoned.duration).toBe(45)
  })

  it('não finaliza uma sessão já finalizada', () => {
    const { session: s0 } = startTimed()
    const finished = finishWorkout(s0, at(5)).session
    expect(() => finishWorkout(finished, at(6))).toThrow(WorkoutEngineError)
    expect(() => abandonWorkout(finished, at(6))).toThrow(WorkoutEngineError)
  })
})

describe('workoutEngine — reconciliação e idempotência', () => {
  it('tick é idempotente (não duplica séries nem transições)', () => {
    const { session: s0, workout } = startTimed()
    const first = tick(s0, workout, at(110))
    const second = tick(first.session, workout, at(110))

    expect(second.session).toBe(first.session)
    expect(second.events).toEqual([])
    expect(first.session.completedSets).toBe(3)

    const repeated = tick(s0, workout, at(110))
    expect(repeated.session).toEqual(first.session)
  })

  it('sem transições, devolve a mesma referência de sessão', () => {
    const { session: s0, workout } = startTimed()
    const result = tick(s0, workout, at(10))
    expect(result.session).toBe(s0)
    expect(result.events).toEqual([])
  })

  it('simula o app fechado durante o exercício', () => {
    const { session: s0, workout } = startTimed()
    const duringWork = tick(s0, workout, at(10)).session
    // Reabre 50s depois: a série 1 terminou em 30 e o descanso em 40.
    const reopened = tick(duringWork, workout, at(50)).session

    expect(reopened.currentPhase).toBe('work')
    expect(reopened.currentSet).toBe(2)
    expect(reopened.phaseStartedAt).toBe(iso(40))
    expect(getRemainingTime(reopened, at(50))).toBe(20)
  })

  it('simula o app fechado durante o descanso', () => {
    const { session: s0, workout } = startTimed()
    const duringRest = tick(s0, workout, at(35)).session
    expect(duringRest.currentPhase).toBe('rest')

    const reopened = tick(duringRest, workout, at(45)).session
    expect(reopened.currentPhase).toBe('work')
    expect(reopened.currentSet).toBe(2)
    expect(reopened.phaseStartedAt).toBe(iso(40))
  })

  it('atravessa múltiplas etapas até a conclusão', () => {
    const { session: s0, workout } = startTimed()
    const result = tick(s0, workout, at(600))
    expect(result.session.status).toBe('completed')
    expect(result.session.completedSets).toBe(3)
  })

  it('reconciliando um treino de vários exercícios, para na conclusão do exercício', () => {
    const workout = mixedWorkout()
    const s0 = startWorkout(workout, { now: T0, id: 'session-mixed' }).session
    const reconciled = tick(s0, workout, at(600)).session

    expect(reconciled.status).toBe('active')
    expect(reconciled.currentPhase).toBe('completed')
    expect(reconciled.currentExerciseIndex).toBe(0)
    expect(reconciled.exercisesProgress[0].completed).toBe(true)
    expect(reconciled.exercisesProgress[1].completedSets).toBe(0)
  })
})

describe('workoutEngine — snapshot para a interface', () => {
  it('expoe os dados necessários durante a execução', () => {
    const { session, workout } = startTimed()
    const snapshot = getSessionSnapshot(session, workout, T0)

    expect(snapshot.exercise?.id).toBe('squat')
    expect(snapshot.currentSet).toBe(1)
    expect(snapshot.totalSets).toBe(3)
    expect(snapshot.remainingTime).toBe(30)
    expect(snapshot.canPause).toBe(true)
    expect(snapshot.canResume).toBe(false)
    expect(snapshot.canCompleteSet).toBe(false)
    expect(snapshot.workoutProgress).toBe(0)
  })
})
