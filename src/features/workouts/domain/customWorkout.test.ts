import { describe, expect, it } from 'vitest'
import {
  addExercise,
  createDraft,
  CUSTOM_WORKOUT_LIMITS,
  describeExerciseConfig,
  draftFromCustomWorkout,
  isValidDraft,
  moveExercise,
  removeExercise,
  setExerciseConfig,
  setExerciseLimit,
  setName,
  toCustomWorkout,
  validateDraft,
  type CustomWorkoutDraft,
} from './customWorkout'
import { assertValidWorkout, validateWorkout } from './workoutValidation'
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary'
import type { Exercise } from './types'

const library: Exercise[] = EXERCISE_LIBRARY
const NOW = Date.parse('2026-03-01T09:00:00.000Z')

function firstIds(count: number): string[] {
  return library.slice(0, count).map((exercise) => exercise.id)
}

/** Rascunho válido pronto para salvar, com `count` exercícios. */
function validDraft(count = 2): CustomWorkoutDraft {
  const draft = setName(createDraft(), 'Meu treino')
  return firstIds(count).reduce(
    (current, id) => addExercise(setExerciseLimit(current, count), id),
    draft,
  )
}

describe('biblioteca de exercícios', () => {
  it('deriva os exercícios do catálogo existente, sem repetir movimentos', () => {
    const illustrations = library.map((exercise) => exercise.illustration)

    expect(library.length).toBeGreaterThan(0)
    expect(new Set(illustrations).size).toBe(illustrations.length)
  })

  it('mantém os dados de apresentação que o motor e o panda consomem', () => {
    for (const exercise of library) {
      expect(exercise.name).toBeTruthy()
      expect(exercise.instructions).toBeTruthy()
      expect(exercise.illustration).toBeTruthy()
    }
  })
})

describe('criação e edição do rascunho', () => {
  it('cria um rascunho vazio, sem configuração global de modo', () => {
    const draft = createDraft()

    expect(draft.name).toBe('')
    expect(draft.exercises).toEqual([])
    expect(draft.id).toBe('')
    expect('mode' in draft).toBe(false)
  })

  it('atualiza o nome e limita o tamanho', () => {
    const draft = setName(createDraft(), 'A'.repeat(CUSTOM_WORKOUT_LIMITS.nameMaxLength + 10))

    expect(draft.name).toHaveLength(CUSTOM_WORKOUT_LIMITS.nameMaxLength)
  })

  it('adiciona exercícios sem mutar o rascunho original', () => {
    const original = createDraft()
    const [first] = firstIds(1)
    const updated = addExercise(original, first)

    expect(original.exercises).toHaveLength(0)
    expect(updated.exercises).toHaveLength(1)
    expect(updated.exercises[0].exerciseId).toBe(first)
  })

  it('novo exercício herda a configuração do último selecionado', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(setExerciseLimit(validDraft(1), 2), a, {
      mode: 'reps',
      target: 15,
      sets: 4,
    })
    const withSecond = addExercise(draft, b)

    expect(withSecond.exercises[1].mode).toBe('reps')
    expect(withSecond.exercises[1].target).toBe(15)
    expect(withSecond.exercises[1].sets).toBe(4)
  })

  it('não permite o mesmo exercício duas vezes', () => {
    const [first] = firstIds(1)
    const once = addExercise(createDraft(), first)
    const twice = addExercise(once, first)

    expect(twice).toBe(once)
    expect(twice.exercises).toHaveLength(1)
  })

  it('respeita o limite configurado de exercícios', () => {
    const [a, b, c] = firstIds(3)
    const draft = setExerciseLimit(createDraft(), 2)

    const withTwo = addExercise(addExercise(draft, a), b)
    const withThree = addExercise(withTwo, c)

    expect(withTwo.exercises).toHaveLength(2)
    expect(withThree).toBe(withTwo)
    expect(withThree.exercises).toHaveLength(2)
  })

  it('não reduz o limite abaixo dos exercícios já selecionados', () => {
    const [a, b, c] = firstIds(3)
    const limited = setExerciseLimit(validDraft(3), 1)

    expect(limited.exerciseCount).toBe(3)
    expect(limited.exercises.map((item) => item.exerciseId)).toEqual([a, b, c])
  })

  it('remove um exercício selecionado', () => {
    const [a, b] = firstIds(2)
    const removed = removeExercise(validDraft(2), a)

    expect(removed.exercises.map((item) => item.exerciseId)).toEqual([b])
  })

  it('reordena exercícios para cima e para baixo', () => {
    const [a, b, c] = firstIds(3)
    const draft = validDraft(3)

    const up = moveExercise(draft, c, 'up')
    expect(up.exercises.map((item) => item.exerciseId)).toEqual([a, c, b])

    const down = moveExercise(up, a, 'down')
    expect(down.exercises.map((item) => item.exerciseId)).toEqual([c, a, b])
  })

  it('ignora a reordenação nas extremidades', () => {
    const [a, b] = firstIds(2)
    const draft = validDraft(2)

    expect(moveExercise(draft, a, 'up')).toBe(draft)
    expect(moveExercise(draft, b, 'down')).toBe(draft)
  })
})

describe('configuração individual por exercício', () => {
  it('cada exercício tem o seu próprio modo', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(setExerciseConfig(validDraft(2), a, { mode: 'reps' }), b, {
      mode: 'timed',
    })
    const workout = toCustomWorkout(draft, library, { now: NOW })

    expect(workout.exercises[0].executionType).toBe('reps')
    expect(workout.exercises[1].executionType).toBe('timed')
  })

  it('trocar o modo de um exercício não afeta os outros', () => {
    const [a] = firstIds(2)
    const original = validDraft(2)
    const before = original.exercises[1]

    const changed = setExerciseConfig(original, a, { mode: 'reps' })

    expect(changed.exercises[1]).toEqual(before)
    expect(changed.exercises[0].mode).toBe('reps')
  })

  it('mantém alvos diferentes por exercício', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(setExerciseConfig(validDraft(2), a, { target: 15 }), b, {
      target: 40,
    })
    const workout = toCustomWorkout(draft, library, { now: NOW })

    expect(workout.exercises[0].workDuration).toBe(15)
    expect(workout.exercises[1].workDuration).toBe(40)
  })

  it('mantém contagens de séries diferentes por exercício', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(setExerciseConfig(validDraft(2), a, { sets: 2 }), b, {
      sets: 5,
    })
    const workout = toCustomWorkout(draft, library, { now: NOW })

    expect(workout.exercises[0].sets).toBe(2)
    expect(workout.exercises[1].sets).toBe(5)
  })

  it('mantém descansos diferentes por exercício', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(
      setExerciseConfig(validDraft(2), a, { restDuration: 30 }),
      b,
      { restDuration: 45 },
    )
    const workout = toCustomWorkout(draft, library, { now: NOW })

    expect(workout.exercises[0].restDuration).toBe(30)
    expect(workout.exercises[1].restDuration).toBe(45)
  })

  it('suporta o exemplo completo de treino misto', () => {
    const [squat, pushup, plank, jacks] = firstIds(4)
    let draft = setExerciseLimit(validDraft(1), 4)

    draft = addExercise(addExercise(addExercise(draft, pushup), plank), jacks)
    draft = setExerciseConfig(draft, squat, { mode: 'reps', target: 15, sets: 3, restDuration: 30 })
    draft = setExerciseConfig(draft, pushup, { mode: 'reps', target: 10, sets: 4, restDuration: 45 })
    draft = setExerciseConfig(draft, plank, { mode: 'timed', target: 40, sets: 3, restDuration: 20 })
    draft = setExerciseConfig(draft, jacks, { mode: 'timed', target: 30, sets: 2, restDuration: 15 })

    const workout = toCustomWorkout(draft, library, { now: NOW })
    const summary = workout.exercises.map((exercise) => ({
      mode: exercise.executionType,
      target: exercise.workDuration ?? exercise.repetitions,
      sets: exercise.sets,
      rest: exercise.restDuration,
    }))

    expect(summary).toEqual([
      { mode: 'reps', target: 15, sets: 3, rest: 30 },
      { mode: 'reps', target: 10, sets: 4, rest: 45 },
      { mode: 'timed', target: 40, sets: 3, rest: 20 },
      { mode: 'timed', target: 30, sets: 2, rest: 15 },
    ])
    expect(validateWorkout(workout)).toEqual([])
  })

  it('ao trocar o modo, o alvo volta ao padrão da nova unidade', () => {
    const [a] = firstIds(1)
    const reps = setExerciseConfig(validDraft(1), a, { mode: 'reps', target: 15 })
    const timed = setExerciseConfig(reps, a, { mode: 'timed' })

    expect(timed.exercises[0].target).toBe(30)
  })

  it('limita os valores aos intervalos permitidos', () => {
    const [a] = firstIds(1)
    const draft = setExerciseConfig(validDraft(1), a, {
      sets: 999,
      restDuration: -10,
      target: 9999,
    })

    expect(draft.exercises[0].sets).toBe(CUSTOM_WORKOUT_LIMITS.maxSets)
    expect(draft.exercises[0].restDuration).toBe(CUSTOM_WORKOUT_LIMITS.minRestSeconds)
    expect(draft.exercises[0].target).toBe(CUSTOM_WORKOUT_LIMITS.maxSeconds)
  })

  it('descreve a configuração do exercício', () => {
    const [a] = firstIds(1)
    const reps = setExerciseConfig(validDraft(1), a, { mode: 'reps', target: 12, sets: 3 })
    const timed = setExerciseConfig(validDraft(1), a, { mode: 'timed', target: 40, sets: 2 })

    expect(describeExerciseConfig(reps.exercises[0])).toBe('3 × 12 reps')
    expect(describeExerciseConfig(timed.exercises[0])).toBe('2 × 40s')
  })
})

describe('toCustomWorkout', () => {
  it('gera um treino válido para o motor de execução', () => {
    const workout = toCustomWorkout(validDraft(), library, { now: NOW })

    expect(validateWorkout(workout)).toEqual([])
    expect(() => assertValidWorkout(workout)).not.toThrow()
  })

  it('copia a apresentação do exercício da biblioteca', () => {
    const [firstId] = firstIds(1)
    const base = library.find((exercise) => exercise.id === firstId)
    const workout = toCustomWorkout(validDraft(1), library, { now: NOW })

    expect(workout.exercises[0].illustration).toBe(base?.illustration)
    expect(workout.exercises[0].instructions).toBe(base?.instructions)
    expect(workout.exercises[0].steps).toEqual(base?.steps)
  })

  it('preserva a ordem escolhida', () => {
    const [a, b, c] = firstIds(3)
    const draft = moveExercise(validDraft(3), c, 'up')
    const workout = toCustomWorkout(draft, library, { now: NOW })

    expect(workout.exercises.map((exercise) => exercise.id)).toEqual([a, c, b])
  })

  it('gera um id com prefixo próprio e deriva descrição e duração', () => {
    const workout = toCustomWorkout(validDraft(), library, { now: NOW })

    expect(workout.id.startsWith('custom-')).toBe(true)
    expect(workout.description).toBe('2 exercícios · por tempo')
    expect(workout.estimatedMinutes).toBeGreaterThan(0)
    expect(workout.createdAt).toBe(new Date(NOW).toISOString())
    expect(workout.updatedAt).toBe(new Date(NOW).toISOString())
  })

  it('descreve treino misto', () => {
    const [a] = firstIds(2)
    const draft = setExerciseConfig(validDraft(2), a, { mode: 'reps' })
    const workout = toCustomWorkout(draft, library, { now: NOW })

    expect(workout.description).toBe('2 exercícios · misto')
  })

  it('marca o treino como tendo descanso entre exercícios', () => {
    const workout = toCustomWorkout(validDraft(), library, { now: NOW })

    expect(workout.restBetweenExercises).toBe(true)
  })

  it('não marca descanso entre exercícios quando todos desligam', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(
      setExerciseConfig(validDraft(2), a, { restAfterExercise: false }),
      b,
      { restAfterExercise: false },
    )

    expect(toCustomWorkout(draft, library, { now: NOW }).restBetweenExercises).toBe(false)
  })

  it('mantém id e createdAt ao editar um treino existente', () => {
    const existing = toCustomWorkout(validDraft(), library, { now: NOW })
    const later = NOW + 86_400_000
    const edited = toCustomWorkout(draftFromCustomWorkout(existing), library, { now: later })

    expect(edited.id).toBe(existing.id)
    expect(edited.createdAt).toBe(existing.createdAt)
    expect(edited.updatedAt).toBe(new Date(later).toISOString())
  })

  it('reconstrói o rascunho preservando a configuração de cada exercício', () => {
    const [a, b] = firstIds(2)
    const draft = setExerciseConfig(
      setExerciseConfig(validDraft(2), a, { mode: 'reps', target: 15, sets: 4, restDuration: 45 }),
      b,
      { mode: 'timed', target: 50, sets: 2, restDuration: 10 },
    )
    const original = toCustomWorkout(draft, library, { now: NOW })
    const rebuilt = toCustomWorkout(draftFromCustomWorkout(original), library, { now: NOW })

    expect(rebuilt.exercises.map((exercise) => exercise.executionType)).toEqual([
      'reps',
      'timed',
    ])
    expect(rebuilt.exercises.map((exercise) => exercise.repetitions)).toEqual([15, undefined])
    expect(rebuilt.exercises.map((exercise) => exercise.workDuration)).toEqual([undefined, 50])
    expect(rebuilt.exercises.map((exercise) => exercise.sets)).toEqual([4, 2])
    expect(rebuilt.exercises.map((exercise) => exercise.restDuration)).toEqual([45, 10])
  })
})

describe('validateDraft', () => {
  it('aceita um rascunho completo', () => {
    expect(validateDraft(validDraft(), library)).toEqual([])
    expect(isValidDraft(validDraft(), library)).toBe(true)
  })

  it('exige nome', () => {
    const errors = validateDraft(setName(validDraft(), '   '), library)

    expect(errors).toContain('Informe um nome para o treino.')
  })

  it('exige ao menos um exercício', () => {
    expect(validateDraft(createDraft(), library)).toContain('Selecione ao menos um exercício.')
  })

  it('detecta limite excedido', () => {
    const draft = validDraft(2)

    expect(validateDraft({ ...draft, exerciseCount: 1 }, library)).toContain(
      'O limite é de 1 exercício(s); remova 1.',
    )
  })

  it('detecta exercício inexistente na biblioteca', () => {
    const draft = validDraft(1)
    const broken = {
      ...draft,
      exercises: [{ ...draft.exercises[0], exerciseId: 'inexistente' }],
    }

    expect(validateDraft(broken, library)).toContain(
      'Exercício "inexistente" não existe na biblioteca.',
    )
  })

  it('detecta séries inválidas', () => {
    const draft = validDraft(1)
    const broken = { ...draft, exercises: [{ ...draft.exercises[0], sets: 0 }] }

    expect(validateDraft(broken, library).some((error) => error.includes('1 série'))).toBe(true)
  })

  it('detecta alvo zerado', () => {
    const draft = validDraft(1)
    const broken = { ...draft, exercises: [{ ...draft.exercises[0], target: 0 }] }

    expect(validateDraft(broken, library).some((error) => error.includes('alvo'))).toBe(true)
  })
})
