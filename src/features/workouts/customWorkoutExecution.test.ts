import { beforeEach, describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY } from './data/exerciseLibrary'
import {
  addExercise,
  createDraft,
  setExerciseConfig,
  setExerciseLimit,
  setName,
  toCustomWorkout,
  type CustomWorkoutDraft,
} from './domain/customWorkout'
import type { CustomWorkout } from './domain/types'
import {
  advanceExercise,
  completeSet,
  goToPreviousExercise,
  pauseWorkout,
  resumeWorkout,
  skipRest,
  skipSet,
  startWorkout,
  tick,
} from './domain/workoutEngine'
import { getSessionSnapshot, estimateWorkoutSeconds } from './domain/workoutSelectors'
import { clearCustomWorkouts, saveCustomWorkout } from './data/customWorkoutRepository'
import { clearSessions, listCompletedSessions, saveSession } from './data/workoutRepository'
import { recoverWorkoutSession } from '../../services/workoutService'

const T0 = Date.parse('2026-04-02T08:00:00.000Z')
const at = (seconds: number) => T0 + seconds * 1000
const [SQUAT, PUSHUP, PLANK] = EXERCISE_LIBRARY

/** Rascunho com `ids`, todos partindo do padrão inicial. */
function draftWith(ids: string[]): CustomWorkoutDraft {
  const draft = setExerciseLimit(setName(createDraft(), 'Circuito'), ids.length)
  return ids.reduce((current, id) => addExercise(current, id), draft)
}

function build(draft: CustomWorkoutDraft): CustomWorkout {
  return toCustomWorkout(draft, EXERCISE_LIBRARY, { now: T0 })
}

/** Treino misto: agachamento (reps) + prancha (tempo), ambos 2 séries. */
function mixedTwo(): CustomWorkout {
  const draft = draftWith([SQUAT.id, PLANK.id])
  const withSquat = setExerciseConfig(draft, SQUAT.id, {
    mode: 'reps',
    target: 12,
    sets: 2,
    restDuration: 10,
  })
  const withPlank = setExerciseConfig(withSquat, PLANK.id, {
    mode: 'timed',
    target: 20,
    sets: 2,
    restDuration: 15,
  })

  return build(withPlank)
}

describe('execução de treinos personalizados com configuração por exercício', () => {
  beforeEach(async () => {
    await clearSessions()
    await clearCustomWorkouts()
  })

  it('aplica modo, alvo, séries e descanso de cada exercício', () => {
    const workout = mixedTwo()
    const [first, second] = workout.exercises

    expect(first.executionType).toBe('reps')
    expect(first.repetitions).toBe(12)
    expect(first.sets).toBe(2)
    expect(first.restDuration).toBe(10)

    expect(second.executionType).toBe('timed')
    expect(second.workDuration).toBe(20)
    expect(second.sets).toBe(2)
    expect(second.restDuration).toBe(15)
  })

  it('executa um exercício por repetições e passa ao próximo', () => {
    const workout = mixedTwo()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    // Série por repetições: sem fim automático.
    expect(tick(session, workout, at(10)).session).toBe(session)

    session = completeSet(session, workout, at(5)).session
    expect(session.currentPhase).toBe('rest')
    expect(session.currentSet).toBe(1)

    session = skipRest(session, workout, at(15)).session
    expect(session.currentPhase).toBe('work')
    expect(session.currentSet).toBe(2)

    session = completeSet(session, workout, at(20)).session
    // Última série → descanso entre exercícios (10s), não conclusão imediata.
    expect(session.currentPhase).toBe('rest')
    expect(session.exercisesProgress[0].completed).toBe(true)
    expect(session.currentExerciseIndex).toBe(0)

    session = tick(session, workout, at(30)).session
    expect(session.currentExerciseIndex).toBe(1)
    expect(session.currentPhase).toBe('work')
    expect(session.currentSet).toBe(1)
  })

  it('não descansa depois da última série do último exercício', () => {
    const workout = mixedTwo()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    session = completeSet(session, workout, at(5)).session
    session = skipRest(session, workout, at(10)).session
    session = completeSet(session, workout, at(15)).session
    session = tick(session, workout, at(25)).session

    expect(session.currentExerciseIndex).toBe(1)

    // Exercício por tempo: 2 séries de 20s com 15s de descanso, sem descanso final.
    session = tick(session, workout, at(45)).session
    expect(session.currentPhase).toBe('rest')

    session = skipRest(session, workout, at(45)).session
    session = tick(session, workout, at(65)).session

    expect(session.status).toBe('completed')
    expect(session.currentPhase).toBe('completed')
    expect(session.exercisesProgress[1].completed).toBe(true)
  })

  it('pausa e retoma durante o exercício', () => {
    const workout = mixedTwo()
    const started = startWorkout(workout, { now: T0, id: 's' }).session

    const paused = pauseWorkout(started, at(5)).session
    expect(paused.status).toBe('paused')
    expect(tick(paused, workout, at(60)).session).toBe(paused)

    const resumed = resumeWorkout(paused, at(60)).session
    expect(resumed.status).toBe('active')
    const snapshot = getSessionSnapshot(resumed, workout, at(60))
    expect(snapshot.isPaused).toBe(false)
  })

  it('pausa e retoma durante o descanso entre exercícios', () => {
    const workout = mixedTwo()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    session = completeSet(session, workout, at(5)).session
    session = skipRest(session, workout, at(10)).session
    session = completeSet(session, workout, at(15)).session

    expect(session.currentPhase).toBe('rest')
    const restingBefore = session.phaseEndsAt

    const paused = pauseWorkout(session, at(18)).session
    expect(paused.status).toBe('paused')
    expect(paused.currentPhase).toBe('rest')
    // O tempo congela enquanto pausado.
    expect(tick(paused, workout, at(999)).session).toBe(paused)

    const resumed = resumeWorkout(paused, at(50)).session
    expect(resumed.currentPhase).toBe('rest')
    expect(resumed.phaseEndsAt).not.toBe(restingBefore)
  })

  it('respeita a contagem de séries diferente em cada exercício', () => {
    const draft = draftWith([SQUAT.id, PUSHUP.id])
    const workout = build(
      setExerciseConfig(
        setExerciseConfig(draft, SQUAT.id, { mode: 'reps', sets: 2, restDuration: 0 }),
        PUSHUP.id,
        { mode: 'reps', sets: 4, restDuration: 0 },
      ),
    )

    let session = startWorkout(workout, { now: T0, id: 's' }).session
    for (let i = 0; i < 2; i += 1) {
      session = completeSet(session, workout, at(10 + i * 10)).session
    }

    expect(session.exercisesProgress[0].completed).toBe(true)
    // Sem descanso configurado, o próximo exercício começa direto.
    expect(session.currentExerciseIndex).toBe(1)
    expect(session.currentSet).toBe(1)

    for (let i = 0; i < 4; i += 1) {
      session = completeSet(session, workout, at(100 + i * 10)).session
    }
    expect(session.status).toBe('completed')
    expect(session.exercisesProgress[1].sets).toHaveLength(4)
  })

  it('pular série também leva ao descanso entre exercícios', () => {
    const workout = mixedTwo()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    session = skipSet(session, workout, at(5)).session
    session = skipRest(session, workout, at(10)).session
    session = skipSet(session, workout, at(15)).session

    expect(session.currentPhase).toBe('rest')
    expect(session.exercisesProgress[0].completed).toBe(true)

    session = tick(session, workout, at(25)).session
    expect(session.currentExerciseIndex).toBe(1)
  })

  it('permite voltar ao exercício anterior durante o descanso entre exercícios', () => {
    const workout = mixedTwo()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    session = completeSet(session, workout, at(5)).session
    session = skipRest(session, workout, at(10)).session
    session = completeSet(session, workout, at(15)).session
    session = tick(session, workout, at(25)).session

    expect(session.currentExerciseIndex).toBe(1)

    const previous = goToPreviousExercise(session, workout, at(30)).session
    expect(previous.currentExerciseIndex).toBe(0)
    expect(previous.exercisesProgress[0].completed).toBe(true)
  })

  it('avançar manualmente continua funcionando', () => {
    const workout = mixedTwo()
    const started = startWorkout(workout, { now: T0, id: 's' }).session
    const advanced = advanceExercise(started, workout, at(10)).session

    expect(advanced.currentExerciseIndex).toBe(1)
    expect(advanced.currentPhase).toBe('work')
    expect(advanced.currentSet).toBe(1)
  })

  it('não carrega configuração de um exercício para outro', () => {
    const workout = mixedTwo()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    // Agachamento por repetições: a sessão não tem fim automático.
    expect(session.phaseEndsAt).toBeNull()

    session = advanceExercise(session, workout, at(10)).session
    // Prancha por tempo: 20s configurados no próprio exercício.
    expect(session.phaseEndsAt).toBe(new Date(at(30)).toISOString())
    expect(session.remainingTime).toBe(20)
  })

  it('a duração estimada inclui o descanso entre exercícios', () => {
    const workout = mixedTwo()
    // reps: 2×12×3s + 1×10s = 82; timed: 2×20 + 1×15 = 55; transição: 10s.
    expect(estimateWorkoutSeconds(workout)).toBe(82 + 55 + 10)
  })

  it('presets continuam sem descanso entre exercícios', async () => {
    const { getWorkoutById } = await import('../../services/workoutService')
    const preset = getWorkoutById('A')

    expect(preset?.restBetweenExercises).toBeUndefined()
  })

  it('persiste a conclusão no histórico', async () => {
    const draft = draftWith([SQUAT.id])
    const workout = build(
      setExerciseConfig(draft, SQUAT.id, {
        mode: 'reps',
        sets: 1,
        target: 10,
        restDuration: 0,
      }),
    )
    await saveCustomWorkout(workout)

    const started = startWorkout(workout, { now: T0, id: 'exec-history' })
    const finished = completeSet(started.session, workout, at(10)).session

    expect(finished.status).toBe('completed')

    await saveSession(finished)
    const history = await listCompletedSessions()
    expect(history.map((session) => session.id)).toContain('exec-history')
    expect(history[0].exercisesProgress[0].exerciseName).toBe(SQUAT.name)
  })

  it('reconcilia um treino misto após reabrir o aplicativo', async () => {
    const workout = mixedTwo()
    await saveCustomWorkout(workout)

    const started = startWorkout(workout, { now: T0, id: 'exec-recover' })
    await saveSession(started.session)

    // 2 séries de 12 reps não avançam sozinhas; a reconciliação mantém o estado.
    const recovered = await recoverWorkoutSession(at(600))
    expect(recovered?.session.id).toBe('exec-recover')
    expect(recovered?.session.currentExerciseIndex).toBe(0)

    // Treino só por tempo: a reconciliação reconstrói o progresso.
    const timedOnly = build(
      setExerciseConfig(draftWith([PLANK.id]), PLANK.id, {
        mode: 'timed',
        sets: 1,
        target: 10,
        restDuration: 0,
      }),
    )
    await clearSessions()
    await saveCustomWorkout(timedOnly)

    const timedStart = startWorkout(timedOnly, { now: T0, id: 'exec-timed' })
    await saveSession(timedStart.session)

    const timedRecovered = await recoverWorkoutSession(at(20))
    expect(timedRecovered?.session.status).toBe('completed')
  })
})
