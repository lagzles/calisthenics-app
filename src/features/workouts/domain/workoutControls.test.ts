import { describe, expect, it } from 'vitest'
import { mixedWorkout, timedWorkout } from '../data/workoutFixtures'
import { advanceExercise, skipSet, startWorkout, tick, WorkoutEngineError } from './workoutEngine'

/**
 * Regras de produto dos controles durante o exercício:
 * - "Pular série" encerra a série sem contá-la como concluída;
 * - "Próximo exercício" preserva as séries concluídas e não registra incompletas.
 */

const T0 = Date.parse('2026-01-01T10:00:00.000Z')
const at = (seconds: number): number => T0 + seconds * 1000
const iso = (seconds: number): string => new Date(at(seconds)).toISOString()

describe('skipSet — pular série', () => {
  it('inicia o descanso quando ainda há séries pendentes, sem contar a série', () => {
    const workout = timedWorkout() // 3 séries · 30s · descanso 10s
    const started = startWorkout(workout, { now: T0, id: 's' }).session

    const skipped = skipSet(started, workout, at(12)).session

    expect(skipped.currentPhase).toBe('rest')
    expect(skipped.phaseEndsAt).toBe(iso(22)) // 12s + 10s de descanso
    // A série pulada NÃO entra como concluída.
    expect(skipped.completedSets).toBe(0)
    expect(skipped.exercisesProgress[0].completedSets).toBe(0)
    expect(skipped.exercisesProgress[0].sets).toHaveLength(0)
    // Mas fica registrada como pulada.
    expect(skipped.exercisesProgress[0].skippedSets).toBe(1)
  })

  it('finaliza o exercício na última série sem iniciar descanso', () => {
    const workout = mixedWorkout() // exercício 0: 2 séries · 30s · descanso 10s
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    session = skipSet(session, workout, at(5)).session // série 1 → descanso (termina em 15)
    session = tick(session, workout, at(15)).session
    expect(session.currentSet).toBe(2)

    const result = skipSet(session, workout, at(20))

    expect(result.session.currentPhase).toBe('completed')
    expect(result.session.status).toBe('active') // ainda há o exercício 1
    expect(result.session.completedSets).toBe(0)
    expect(result.events.some((event) => event.type === 'rest-started')).toBe(false)
    // A sessão aguarda o avanço para o próximo exercício.
    expect(result.events.some((event) => event.type === 'exercise-completed')).toBe(true)
  })

  it('não permite pular série fora da etapa de trabalho', () => {
    const workout = timedWorkout()
    const rest = tick(startWorkout(workout, { now: T0, id: 's' }).session, workout, at(30)).session
    expect(() => skipSet(rest, workout, at(31))).toThrow(WorkoutEngineError)
  })
})

describe('advanceExercise — próximo exercício', () => {
  it('preserva as séries concluídas e não registra as incompletas', () => {
    const workout = mixedWorkout()
    let session = startWorkout(workout, { now: T0, id: 's' }).session

    // Série 1 do exercício 0 concluída por tempo (30s).
    session = tick(session, workout, at(30)).session
    expect(session.completedSets).toBe(1)

    // Avança no meio do exercício (não conclui o exercício).
    const advanced = advanceExercise(session, workout, at(31)).session

    expect(advanced.currentExerciseIndex).toBe(1)
    // Série concluída preservada; nenhuma nova série registrada; exercício 0 não
    // é marcado como concluído.
    expect(advanced.completedSets).toBe(1)
    expect(advanced.exercisesProgress[0].completed).toBe(false)
    expect(advanced.exercisesProgress[0].completedSets).toBe(1)
    expect(advanced.currentPhase).toBe('work')
  })

  it('não inicia descanso ao avançar de exercício', () => {
    const workout = mixedWorkout()
    const session = startWorkout(workout, { now: T0, id: 's' }).session
    const result = advanceExercise(session, workout, at(10))
    expect(result.events.some((event) => event.type === 'rest-started')).toBe(false)
    expect(result.session.currentPhase).toBe('work')
  })
})
