import type { CustomWorkout, ExecutionType, Exercise } from './types'
import { estimateWorkoutMinutes } from './workoutSelectors'
import { createCustomWorkoutId } from './workoutTransitions'
import { WorkoutValidationError } from './workoutValidation'

/**
 * Regras de negócio do editor de treinos personalizados.
 *
 * Funções puras: recebem o rascunho (`CustomWorkoutDraft`) e devolvem um novo
 * rascunho, sem mutar a entrada. A biblioteca de exercícios é **injetada** —
 * este módulo não conhece o catálogo nem a persistência.
 *
 * Cada exercício carrega a **sua própria** configuração (modo, alvo, séries e
 * descanso), então um mesmo treino pode misturar exercícios por tempo e por
 * repetições. O resultado (`toCustomWorkout`) continua sendo um `Workout`
 * comum, consumido pelo motor existente.
 */

export const CUSTOM_WORKOUT_LIMITS = {
  minExercises: 1,
  maxExercises: 10,
  minSets: 1,
  maxSets: 10,
  minRestSeconds: 0,
  maxRestSeconds: 300,
  minRepetitions: 1,
  maxRepetitions: 100,
  minSeconds: 5,
  maxSeconds: 300,
  nameMaxLength: 40,
} as const

/** Alvo padrão de cada modalidade, usado ao criar o primeiro exercício. */
const DEFAULT_TARGET: Record<ExecutionType, number> = {
  timed: 30,
  reps: 12,
}

/**
 * Configuração de execução de um exercício.
 *
 * Todos os campos são obrigatórios: cada exercício é independente, sem herdar
 * valores de um "padrão do treino".
 */
export interface ExerciseConfig {
  mode: ExecutionType
  /** Repetições por série (`reps`) ou segundos por série (`timed`). */
  target: number
  sets: number
  restDuration: number
  /** Descanso também após a última série, antes do próximo exercício. */
  restAfterExercise: boolean
}

/** Exercício escolhido para o treino. */
export interface DraftExercise extends ExerciseConfig {
  exerciseId: string
}

/** Estado editável de um treino personalizado. */
export interface CustomWorkoutDraft {
  /** Vazio ao criar; carregado ao editar. */
  id: string
  name: string
  /** Limite de exercícios escolhido pelo usuário. */
  exerciseCount: number
  exercises: DraftExercise[]
  /** Data de criação original (edição); `null` ao criar. */
  createdAt: string | null
}

export type MoveDirection = 'up' | 'down'

const INITIAL_CONFIG: ExerciseConfig = {
  mode: 'timed',
  target: DEFAULT_TARGET.timed,
  sets: 3,
  restDuration: 20,
  restAfterExercise: true,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampTarget(mode: ExecutionType, value: number): number {
  return mode === 'timed'
    ? clamp(Math.round(value), CUSTOM_WORKOUT_LIMITS.minSeconds, CUSTOM_WORKOUT_LIMITS.maxSeconds)
    : clamp(
        Math.round(value),
        CUSTOM_WORKOUT_LIMITS.minRepetitions,
        CUSTOM_WORKOUT_LIMITS.maxRepetitions,
      )
}

function normalizeConfig(config: ExerciseConfig): ExerciseConfig {
  return {
    mode: config.mode,
    target: clampTarget(config.mode, config.target),
    sets: clamp(Math.round(config.sets), CUSTOM_WORKOUT_LIMITS.minSets, CUSTOM_WORKOUT_LIMITS.maxSets),
    restDuration: clamp(
      Math.round(config.restDuration),
      CUSTOM_WORKOUT_LIMITS.minRestSeconds,
      CUSTOM_WORKOUT_LIMITS.maxRestSeconds,
    ),
    restAfterExercise: config.restAfterExercise,
  }
}

/** Rascunho vazio (novo treino). */
export function createDraft(): CustomWorkoutDraft {
  return {
    id: '',
    name: '',
    exerciseCount: 3,
    exercises: [],
    createdAt: null,
  }
}

/** Configuração herdada ao adicionar um exercício: a do último selecionado. */
function seedConfig(draft: CustomWorkoutDraft): ExerciseConfig {
  const last = draft.exercises[draft.exercises.length - 1]
  if (!last) return INITIAL_CONFIG

  return {
    mode: last.mode,
    target: last.target,
    sets: last.sets,
    restDuration: last.restDuration,
    restAfterExercise: last.restAfterExercise,
  }
}

function configOf(exercise: Exercise, previousRestAfterExercise: boolean): ExerciseConfig {
  const mode = exercise.executionType
  const target =
    mode === 'timed'
      ? (exercise.workDuration ?? DEFAULT_TARGET.timed)
      : (exercise.repetitions ?? DEFAULT_TARGET.reps)

  return {
    mode,
    target,
    sets: exercise.sets,
    restDuration: exercise.restDuration,
    // `restBetweenExercises` é do treino; o rascunho guarda a intenção por
    // exercício para permitir desligar apenas um deles.
    restAfterExercise: previousRestAfterExercise,
  }
}

/**
 * Reconstrói o rascunho a partir de um treino salvo (edição).
 *
 * Lê a configuração de cada exercício individualmente — é o que permite editar
 * um treino misto sem perder as escolhas dos demais exercícios.
 */
export function draftFromCustomWorkout(workout: CustomWorkout): CustomWorkoutDraft {
  const restAfterExercise = workout.restBetweenExercises ?? true

  return {
    id: workout.id,
    name: workout.name,
    exerciseCount: Math.max(workout.exerciseCount, workout.exercises.length),
    exercises: workout.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      ...configOf(exercise, restAfterExercise),
    })),
    createdAt: workout.createdAt,
  }
}

export function setName(draft: CustomWorkoutDraft, name: string): CustomWorkoutDraft {
  return { ...draft, name: name.slice(0, CUSTOM_WORKOUT_LIMITS.nameMaxLength) }
}

/**
 * Define o limite de exercícios.
 *
 * O limite nunca fica abaixo do que já foi selecionado — assim a configuração
 * atual permanece válida enquanto o usuário ajusta o número.
 */
export function setExerciseLimit(draft: CustomWorkoutDraft, limit: number): CustomWorkoutDraft {
  const min = Math.max(CUSTOM_WORKOUT_LIMITS.minExercises, draft.exercises.length)
  return {
    ...draft,
    exerciseCount: clamp(Math.round(limit), min, CUSTOM_WORKOUT_LIMITS.maxExercises),
  }
}

/**
 * Adiciona um exercício da biblioteca.
 *
 * O novo exercício começa com a configuração do último selecionado (ou o padrão
 * inicial), para que o fluxo continue curto. A partir daí ele é independente.
 *
 * Ignora a inclusão quando o exercício já está no treino ou quando o limite
 * configurado foi atingido — devolvendo o próprio rascunho, para que a
 * interface não re-renderize à toa.
 */
export function addExercise(draft: CustomWorkoutDraft, exerciseId: string): CustomWorkoutDraft {
  if (!exerciseId) return draft
  if (draft.exercises.some((item) => item.exerciseId === exerciseId)) return draft
  if (draft.exercises.length >= draft.exerciseCount) return draft

  return {
    ...draft,
    exercises: [...draft.exercises, { exerciseId, ...seedConfig(draft) }],
  }
}

export function removeExercise(draft: CustomWorkoutDraft, exerciseId: string): CustomWorkoutDraft {
  const exercises = draft.exercises.filter((item) => item.exerciseId !== exerciseId)
  if (exercises.length === draft.exercises.length) return draft

  return { ...draft, exercises }
}

/** Move um exercício uma posição para cima ou para baixo. */
export function moveExercise(
  draft: CustomWorkoutDraft,
  exerciseId: string,
  direction: MoveDirection,
): CustomWorkoutDraft {
  const index = draft.exercises.findIndex((item) => item.exerciseId === exerciseId)
  if (index < 0) return draft

  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= draft.exercises.length) return draft

  const exercises = [...draft.exercises]
  const [moved] = exercises.splice(index, 1)
  exercises.splice(target, 0, moved)

  return { ...draft, exercises }
}

/**
 * Atualiza a configuração de **um** exercício, sem tocar nos outros.
 *
 * Trocar o modo troca a unidade do alvo (repetições ↔ segundos), então o alvo
 * volta ao padrão da nova modalidade: "12 segundos" herdado de "12 repetições"
 * não faria sentido.
 */
export function setExerciseConfig(
  draft: CustomWorkoutDraft,
  exerciseId: string,
  patch: Partial<ExerciseConfig>,
): CustomWorkoutDraft {
  let changed = false

  const exercises = draft.exercises.map((item) => {
    if (item.exerciseId !== exerciseId) return item
    changed = true

    const mode = patch.mode ?? item.mode
    // Alvo explícito sempre vence; sem ele, trocar o modo volta ao padrão da
    // nova unidade ("12 segundos" herdado de "12 repetições" não faz sentido).
    const modeChanged = patch.mode !== undefined && patch.mode !== item.mode
    const target = patch.target ?? (modeChanged ? DEFAULT_TARGET[mode] : item.target)

    return {
      exerciseId,
      ...normalizeConfig({
        mode,
        target,
        sets: patch.sets ?? item.sets,
        restDuration: patch.restDuration ?? item.restDuration,
        restAfterExercise: patch.restAfterExercise ?? item.restAfterExercise,
      }),
    }
  })

  return changed ? { ...draft, exercises } : draft
}

/** Configuração efetiva de um exercício do rascunho. */
export function configOfExercise(exercise: DraftExercise): ExerciseConfig {
  return {
    mode: exercise.mode,
    target: exercise.target,
    sets: exercise.sets,
    restDuration: exercise.restDuration,
    restAfterExercise: exercise.restAfterExercise,
  }
}

/** Rótulo curto da configuração ("3 × 12 reps" ou "3 × 30s"). */
export function describeExerciseConfig(exercise: DraftExercise): string {
  return exercise.mode === 'timed'
    ? `${exercise.sets} × ${exercise.target}s`
    : `${exercise.sets} × ${exercise.target} reps`
}

function describeDraft(draft: CustomWorkoutDraft): string {
  const count = draft.exercises.length
  const exercises = count === 1 ? '1 exercício' : `${count} exercícios`
  const modes = new Set(draft.exercises.map((item) => item.mode))

  if (modes.size > 1) return `${exercises} · misto`
  if (modes.size === 1) {
    return `${exercises} · ${modes.has('timed') ? 'por tempo' : 'por repetições'}`
  }
  return exercises
}

/** Erros de configuração do rascunho (vazio quando está pronto para salvar). */
export function validateDraft(draft: CustomWorkoutDraft, library: Exercise[]): string[] {
  const errors: string[] = []
  const known = new Set(library.map((exercise) => exercise.id))

  if (!draft.name.trim()) {
    errors.push('Informe um nome para o treino.')
  }

  if (draft.exerciseCount < CUSTOM_WORKOUT_LIMITS.minExercises) {
    errors.push(`O treino deve permitir ao menos ${CUSTOM_WORKOUT_LIMITS.minExercises} exercício.`)
  }

  if (draft.exercises.length === 0) {
    errors.push('Selecione ao menos um exercício.')
  }

  if (draft.exercises.length > draft.exerciseCount) {
    errors.push(
      `O limite é de ${draft.exerciseCount} exercício(s); remova ${draft.exercises.length - draft.exerciseCount}.`,
    )
  }

  const seen = new Set<string>()
  for (const item of draft.exercises) {
    const label = item.exerciseId

    if (!known.has(item.exerciseId)) {
      errors.push(`Exercício "${label}" não existe na biblioteca.`)
      continue
    }
    if (seen.has(item.exerciseId)) {
      errors.push(`Exercício "${label}" está repetido no treino.`)
    }
    seen.add(item.exerciseId)

    if (item.sets < CUSTOM_WORKOUT_LIMITS.minSets) {
      errors.push(`Exercício "${label}": informe ao menos 1 série.`)
    }
    if (item.target < 1) {
      errors.push(`Exercício "${label}": o alvo deve ser maior que zero.`)
    }
    if (item.restDuration < CUSTOM_WORKOUT_LIMITS.minRestSeconds) {
      errors.push(`Exercício "${label}": o descanso não pode ser negativo.`)
    }
  }

  return errors
}

export function isValidDraft(draft: CustomWorkoutDraft, library: Exercise[]): boolean {
  return validateDraft(draft, library).length === 0
}

export function assertValidDraft(draft: CustomWorkoutDraft, library: Exercise[]): void {
  const errors = validateDraft(draft, library)
  if (errors.length > 0) {
    throw new WorkoutValidationError(errors)
  }
}

export interface ToCustomWorkoutOptions {
  /** Instante das datas de criação/atualização. Padrão: `Date.now()`. */
  now?: number
}

/**
 * Converte o rascunho no treino que será persistido e executado.
 *
 * Os exercícios são **copiados** da biblioteca (ilustração, instruções, passos,
 * dicas, postura) e recebem a configuração individual de cada um. Como a
 * `illustration` vem da biblioteca, a demonstração do Panda segue disponível.
 */
export function toCustomWorkout(
  draft: CustomWorkoutDraft,
  library: Exercise[],
  options: ToCustomWorkoutOptions = {},
): CustomWorkout {
  const now = options.now ?? Date.now()
  const timestamp = new Date(now).toISOString()
  const byId = new Map(library.map((exercise) => [exercise.id, exercise]))

  const exercises: Exercise[] = draft.exercises.flatMap((item) => {
    const base = byId.get(item.exerciseId)
    if (!base) return []

    return [
      {
        id: base.id,
        name: base.name,
        description: base.description,
        illustration: base.illustration,
        instructions: base.instructions,
        steps: base.steps,
        tip: base.tip,
        startPosition: base.startPosition,
        breathing: base.breathing,
        posture: base.posture,
        demoUnavailableReason: base.demoUnavailableReason,
        executionType: item.mode,
        sets: item.sets,
        ...(item.mode === 'timed' ? { workDuration: item.target } : { repetitions: item.target }),
        restDuration: item.restDuration,
        commonMistakes: base.commonMistakes,
        adaptations: base.adaptations,
      },
    ]
  })

  const workout: CustomWorkout = {
    id: draft.id || createCustomWorkoutId(),
    name: draft.name.trim(),
    description: describeDraft(draft),
    estimatedMinutes: 0,
    exercises,
    exerciseCount: draft.exerciseCount,
    createdAt: draft.createdAt ?? timestamp,
    updatedAt: timestamp,
    // Treinos personalizados descansam entre exercícios; os presets não.
    restBetweenExercises: draft.exercises.some((item) => item.restAfterExercise),
  }

  return { ...workout, estimatedMinutes: estimateWorkoutMinutes(workout) }
}
