import { describe, expect, it } from 'vitest'
import { describeExerciseTarget, describeModality } from '../format'
import type { Workout, WorkoutEvent } from '../domain/types'
import {
  advanceExercise,
  startWorkout,
  tick,
} from '../domain/workoutEngine'
import {
  estimateExerciseSeconds,
  estimateWorkoutMinutes,
  estimateWorkoutSeconds,
} from '../domain/workoutSelectors'
import { isValidWorkout } from '../domain/workoutValidation'
import { workouts } from './workouts.data'

/**
 * Configuração oficial dos treinos A e B (fonte de verdade do produto).
 *
 * Todos os exercícios são executados por tempo: 3 séries, 40s de atividade e
 * descanso de 20s ou 30s conforme a tabela oficial.
 */
const OFFICIAL_CONFIG: Record<string, { id: string; restDuration: number }[]> = {
  A: [
    { id: 'a-agachamento', restDuration: 30 },
    { id: 'a-flexao', restDuration: 30 },
    { id: 'a-ponte', restDuration: 20 },
    { id: 'a-prancha', restDuration: 30 },
    { id: 'a-polichinelo', restDuration: 20 },
  ],
  B: [
    { id: 'b-corrida', restDuration: 20 },
    { id: 'b-wall-sit', restDuration: 30 },
    { id: 'b-abdominal', restDuration: 30 },
    { id: 'b-pernas', restDuration: 30 },
    { id: 'b-prancha', restDuration: 30 },
  ],
}

function getWorkout(id: string): Workout {
  const workout = workouts.find((candidate) => candidate.id === id)
  if (!workout) throw new Error(`Treino ${id} não encontrado.`)
  return workout
}

const T0 = Date.parse('2026-01-01T10:00:00.000Z')

/**
 * Executa o treino inteiro pelo motor, avançando nos limites reais de cada fase,
 * e coleta todas as transições emitidas.
 */
function runToCompletion(workout: Workout): { completedSets: number; duration: number; events: WorkoutEvent[] } {
  const started = startWorkout(workout, { now: T0, id: 'session' })
  let session = started.session
  const events: WorkoutEvent[] = [...started.events]

  let guard = 0
  while (session.status === 'active' && guard++ < 1000) {
    if (session.phaseEndsAt) {
      const boundary = Date.parse(session.phaseEndsAt)
      const result = tick(session, workout, boundary)
      session = result.session
      events.push(...result.events)
      continue
    }
    if (session.currentPhase === 'completed' && session.phaseStartedAt) {
      const result = advanceExercise(session, workout, Date.parse(session.phaseStartedAt))
      session = result.session
      events.push(...result.events)
      continue
    }
    break
  }

  const duration = Math.round((Date.parse(session.finishedAt ?? session.startedAt) - T0) / 1000)
  return { completedSets: session.completedSets, duration, events }
}

describe.each(['A', 'B'])('treino %s — configuração oficial', (workoutId) => {
  const workout = getWorkout(workoutId)
  const config = OFFICIAL_CONFIG[workoutId]

  it('é um treino válido segundo o domínio', () => {
    expect(isValidWorkout(workout)).toBe(true)
  })

  it('possui exatamente os exercícios previstos, na ordem oficial', () => {
    expect(workout.exercises.map((exercise) => exercise.id)).toEqual(config.map((item) => item.id))
  })

  it('usa exclusivamente a modalidade por tempo (sem repetições)', () => {
    for (const exercise of workout.exercises) {
      expect(exercise.executionType).toBe('timed')
      expect(exercise.repetitions).toBeUndefined()
    }
  })

  it('define 3 séries e 40 segundos de atividade em todos os exercícios', () => {
    for (const exercise of workout.exercises) {
      expect(exercise.sets).toBe(3)
      expect(exercise.workDuration).toBe(40)
    }
  })

  it('define o descanso de 20s ou 30s conforme a configuração oficial', () => {
    const byId = new Map(config.map((item) => [item.id, item.restDuration]))
    for (const exercise of workout.exercises) {
      expect(exercise.restDuration).toBe(byId.get(exercise.id))
      expect([20, 30]).toContain(exercise.restDuration)
    }
  })

  it('não apresenta repetições na interface', () => {
    for (const exercise of workout.exercises) {
      expect(describeModality(exercise)).toBe('Por tempo')
      const target = describeExerciseTarget(exercise)
      expect(target).toBe('3 séries · 40s')
      expect(target.toLowerCase()).not.toContain('rep')
    }
  })
})

describe('durações estimadas', () => {
  it('Treino A: 860s (≈14 min) com 3 séries de 40s e descansos de 30/20s', () => {
    const workout = getWorkout('A')
    expect(estimateWorkoutSeconds(workout)).toBe(860)
    expect(estimateWorkoutMinutes(workout)).toBe(14)
    expect(workout.estimatedMinutes).toBe(14)
  })

  it('Treino B: 880s (≈15 min) com 3 séries de 40s e descansos de 20/30s', () => {
    const workout = getWorkout('B')
    expect(estimateWorkoutSeconds(workout)).toBe(880)
    expect(estimateWorkoutMinutes(workout)).toBe(15)
    expect(workout.estimatedMinutes).toBe(15)
  })

  it('não há descanso após a última série de cada exercício', () => {
    const workout = getWorkout('A')
    for (const exercise of workout.exercises) {
      expect(estimateExerciseSeconds(exercise)).toBe(exercise.sets * 40 + (exercise.sets - 1) * exercise.restDuration)
    }
  })

  it('a duração real do motor coincide com a estimativa', () => {
    for (const workoutId of ['A', 'B']) {
      const workout = getWorkout(workoutId)
      const { duration } = runToCompletion(workout)
      expect(duration).toBe(estimateWorkoutSeconds(workout))
    }
  })
})

describe.each(['A', 'B'])('treino %s — execução temporizada', (workoutId) => {
  it('alterna exercício e descanso automaticamente', () => {
    const workout = getWorkout(workoutId)
    const started = startWorkout(workout, { now: T0, id: 'session' })

    expect(started.session.currentPhase).toBe('work')
    expect(started.session.currentSet).toBe(1)

    const afterWork = tick(started.session, workout, T0 + 40_000).session
    expect(afterWork.currentPhase).toBe('rest')
    expect(afterWork.completedSets).toBe(1)

    const afterRest = tick(afterWork, workout, T0 + (40 + workout.exercises[0].restDuration) * 1000).session
    expect(afterRest.currentPhase).toBe('work')
    expect(afterRest.currentSet).toBe(2)
  })

  it('não inicia descanso após a última série e conclui o treino', () => {
    const workout = getWorkout(workoutId)
    const { completedSets, events } = runToCompletion(workout)

    expect(completedSets).toBe(workout.exercises.length * 3)
    expect(events.some((event) => event.type === 'workout-completed')).toBe(true)

    const restingAfterLastSet = events.filter(
      (event) => event.type === 'rest-started' && event.set === 3,
    )
    expect(restingAfterLastSet).toHaveLength(0)
  })
})

describe.each(['A', 'B'])('treino %s — orientações de execução', (workoutId) => {
  it('todo exercício tem instruções, passos ("Como executar") e dica', () => {
    const workout = getWorkout(workoutId)
    for (const exercise of workout.exercises) {
      expect(exercise.instructions.trim().length).toBeGreaterThan(0)
      expect(exercise.steps?.length ?? 0).toBeGreaterThanOrEqual(3)
      expect((exercise.tip ?? '').trim().length).toBeGreaterThan(0)
    }
  })
})
