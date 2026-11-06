import { describe, expect, it } from 'vitest'
import { mixedWorkout, repsWorkout, timedWorkout } from './data/workoutFixtures'
import { advanceExercise, pauseWorkout, startWorkout, tick } from './domain/workoutEngine'
import { getSessionSnapshot } from './domain/workoutSelectors'
import {
  buildTimerViewModel,
  describePhase,
  formatTimer,
  getExerciseListState,
  getStageControlIds,
  needsAdvanceConfirmation,
  REST_CONTROLS,
} from './sessionView'

const T0 = Date.parse('2026-01-01T10:00:00.000Z')
const at = (seconds: number): number => T0 + seconds * 1000

describe('describePhase', () => {
  it('associa verde ao exercício, âmbar ao descanso e verde-escuro à conclusão', () => {
    expect(describePhase('work')).toEqual({ tone: 'work', label: 'EXERCÍCIO' })
    expect(describePhase('rest')).toEqual({ tone: 'rest', label: 'DESCANSO' })
    expect(describePhase('completed')).toEqual({ tone: 'done', label: 'CONCLUÍDO' })
  })
})

describe('formatTimer', () => {
  it('formata a contagem regressiva como m:ss', () => {
    expect(formatTimer(0)).toBe('0:00')
    expect(formatTimer(9)).toBe('0:09')
    expect(formatTimer(30)).toBe('0:30')
    expect(formatTimer(65)).toBe('1:05')
    expect(formatTimer(-5)).toBe('0:00')
  })
})

describe('getExerciseListState', () => {
  it('identifica pendente, em execução, em descanso e concluído', () => {
    const workout = mixedWorkout()
    const start = startWorkout(workout, { now: T0, id: 's' }).session

    expect(getExerciseListState(start, 0)).toBe('active')
    expect(getExerciseListState(start, 1)).toBe('pending')

    const resting = tick(start, workout, at(30)).session
    expect(getExerciseListState(resting, 0)).toBe('resting')

    const exerciseDone = tick(start, workout, at(70)).session
    expect(getExerciseListState(exerciseDone, 0)).toBe('completed')
    expect(getExerciseListState(exerciseDone, 1)).toBe('pending')

    const advanced = advanceExercise(exerciseDone, workout, at(70)).session
    expect(getExerciseListState(advanced, 0)).toBe('completed')
    expect(getExerciseListState(advanced, 1)).toBe('active')
  })
})

describe('buildTimerViewModel', () => {
  it('descreve o estado de exercício (por tempo)', () => {
    const workout = timedWorkout()
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const vm = buildTimerViewModel(getSessionSnapshot(session, workout, T0))

    expect(vm.tone).toBe('work')
    expect(vm.phaseLabel).toBe('EXERCÍCIO')
    expect(vm.exerciseName).toBe('Agachamento')
    expect(vm.timerText).toBe('0:30')
    expect(vm.currentSet).toBe(1)
    expect(vm.totalSets).toBe(3)
    expect(vm.isTimed).toBe(true)
    expect(vm.exerciseNumber).toBe(1)
    expect(vm.exerciseCount).toBe(1)
  })

  it('descreve o estado de descanso com a próxima série', () => {
    const workout = timedWorkout()
    const session = tick(startWorkout(workout, { now: T0, id: 's' }).session, workout, at(30)).session
    const vm = buildTimerViewModel(getSessionSnapshot(session, workout, at(30)))

    expect(vm.tone).toBe('rest')
    expect(vm.phaseLabel).toBe('DESCANSO')
    expect(vm.timerText).toBe('0:10')
    expect(vm.nextSet).toBe(2)
    expect(vm.message).toContain('série 2')
  })

  it('mostra repetições em exercícios por repetições', () => {
    const workout = repsWorkout()
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const vm = buildTimerViewModel(getSessionSnapshot(session, workout, T0))

    expect(vm.isTimed).toBe(false)
    expect(vm.timerText).toBeNull()
    expect(vm.repetitions).toBe(12)
  })

  it('indica a conclusão do exercício', () => {
    const workout = mixedWorkout()
    const session = tick(startWorkout(workout, { now: T0, id: 's' }).session, workout, at(70)).session
    const vm = buildTimerViewModel(getSessionSnapshot(session, workout, at(70)))

    expect(vm.tone).toBe('done')
    expect(vm.phaseLabel).toBe('CONCLUÍDO')
    expect(vm.timerText).toBeNull()
    expect(vm.message).toContain('concluído')
  })

  it('mantém o tempo congelado quando pausado', () => {
    const workout = timedWorkout()
    const paused = pauseWorkout(startWorkout(workout, { now: T0, id: 's' }).session, at(5)).session
    const snapshot = getSessionSnapshot(paused, workout, at(999))
    const vm = buildTimerViewModel(snapshot)

    expect(snapshot.isPaused).toBe(true)
    expect(vm.timerText).toBe('0:25')
  })
})

describe('getStageControlIds — controles por etapa', () => {
  it('no descanso expõe somente +10s, +15s e pular descanso', () => {
    const workout = timedWorkout()
    const rest = tick(startWorkout(workout, { now: T0, id: 's' }).session, workout, at(30)).session
    const ids = getStageControlIds(getSessionSnapshot(rest, workout, at(30)))

    expect(ids).toEqual(['extend10', 'extend15', 'skipRest'])
    expect(ids).toEqual([...REST_CONTROLS])
    // Não há avanço para outro exercício nem retrocesso a partir do descanso.
    expect(ids).not.toContain('nextExercise')
    expect(ids).not.toContain('previous')
  })

  it('no exercício por tempo expõe anterior, pular série e próximo exercício', () => {
    const workout = timedWorkout()
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const ids = getStageControlIds(getSessionSnapshot(session, workout, T0))

    expect(ids).toEqual(['previous', 'skipSet', 'nextExercise'])
  })

  it('no exercício por repetições troca "pular série" por "concluir série"', () => {
    const workout = repsWorkout()
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const ids = getStageControlIds(getSessionSnapshot(session, workout, T0))

    expect(ids).toContain('completeSet')
    expect(ids).not.toContain('skipSet')
  })

  it('exige confirmação para avançar durante o exercício, mas não após concluí-lo', () => {
    const workout = mixedWorkout()
    const working = startWorkout(workout, { now: T0, id: 's' }).session
    expect(needsAdvanceConfirmation(getSessionSnapshot(working, workout, T0))).toBe(true)

    const done = tick(working, workout, at(70)).session
    expect(done.currentPhase).toBe('completed')
    expect(needsAdvanceConfirmation(getSessionSnapshot(done, workout, at(70)))).toBe(false)
  })
})
