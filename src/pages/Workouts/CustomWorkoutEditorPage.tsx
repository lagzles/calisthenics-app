import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ExerciseIllustration } from '../../components/ui/ExerciseIllustration'
import { NumberStepper } from '../../components/ui/NumberStepper'
import { TextField } from '../../components/ui/TextField'
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '../../components/ui/icons'
import { EXERCISE_LIBRARY } from '../../features/workouts/data/exerciseLibrary'
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
  type DraftExercise,
  type ExerciseConfig,
} from '../../features/workouts/domain/customWorkout'
import { estimateWorkoutMinutes } from '../../features/workouts/domain/workoutSelectors'
import type { ExecutionType } from '../../features/workouts/domain/types'
import { getCustomWorkoutById, saveCustomWorkout } from '../../services/workoutService'
import { cx } from '../../utils/cx'
import styles from './CustomWorkoutEditorPage.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; draft: CustomWorkoutDraft }
  | { status: 'missing' }
  | { status: 'error' }

const MODES: Array<{ value: ExecutionType; label: string }> = [
  { value: 'reps', label: 'Repetições' },
  { value: 'timed', label: 'Tempo' },
]

/**
 * Editor de treinos personalizados (criação e edição).
 *
 * Página única com rolagem, dividida em blocos — o app não usa assistente em
 * etapas, e cada decisão fica visível e editável a qualquer momento.
 *
 * Cada exercício tem configuração própria (modo, alvo, séries e descanso), então
 * o mesmo treino pode misturar exercícios por tempo e por repetições. Toda a
 * regra de negócio está em `domain/customWorkout.ts`; aqui só há estado de
 * formulário e apresentação.
 */
export function CustomWorkoutEditorPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  return <CustomWorkoutEditor key={id ?? 'new'} id={id} editing={editing} />
}

function CustomWorkoutEditor({ id, editing }: { id: string | undefined; editing: boolean }) {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>(() =>
    editing ? { status: 'loading' } : { status: 'ready', draft: createDraft() },
  )
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!editing || !id) return
    let cancelled = false

    void getCustomWorkoutById(id)
      .then((workout) => {
        if (cancelled) return
        setState(
          workout
            ? { status: 'ready', draft: draftFromCustomWorkout(workout) }
            : { status: 'missing' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [editing, id])

  const update = useCallback((next: CustomWorkoutDraft) => {
    setState({ status: 'ready', draft: next })
  }, [])

  if (state.status === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.message}>Carregando treino…</p>
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Treino não encontrado"
          description="Este treino personalizado não existe mais."
          action={<Button onClick={() => navigate('/treinos')}>Ver treinos</Button>}
        />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Não foi possível carregar"
          description="Tente novamente a partir da tela de treinos."
          action={<Button onClick={() => navigate('/treinos')}>Ver treinos</Button>}
        />
      </div>
    )
  }

  if (state.status !== 'ready') {
    return null
  }

  const draft = state.draft

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => navigate('/treinos')}>
        <ArrowLeftIcon size={18} />
        Treinos
      </button>

      <header>
        <h1 className={styles.title}>{editing ? 'Editar treino' : 'Novo treino'}</h1>
        <p className={styles.subtitle}>
          Monte seu treino usando os exercícios do app. Ele fica salvo neste dispositivo.
        </p>
      </header>

      <Card className={styles.section}>
        <SectionLabel step={1}>Nome do treino</SectionLabel>
        <TextField
          id="workout-name"
          label="Nome"
          value={draft.name}
          onChange={(name) => update(setName(draft, name))}
          placeholder="Ex.: Treino de segunda"
          maxLength={CUSTOM_WORKOUT_LIMITS.nameMaxLength}
        />
      </Card>

      <Card className={styles.section}>
        <SectionLabel step={2}>Quantidade de exercícios</SectionLabel>
        <div className={styles.inlineFields}>
          <NumberStepper
            id="exercise-limit"
            label="Limite de exercícios"
            value={draft.exerciseCount}
            onChange={(limit) => update(setExerciseLimit(draft, limit))}
            min={CUSTOM_WORKOUT_LIMITS.minExercises}
            max={CUSTOM_WORKOUT_LIMITS.maxExercises}
          />
          <span className={styles.counter}>
            {draft.exercises.length} de {draft.exerciseCount} selecionados
          </span>
        </div>
      </Card>

      <LibrarySection draft={draft} onChange={update} />

      {draft.exercises.length > 0 && <ConfigSection draft={draft} onChange={update} />}

      <SaveSection
        draft={draft}
        editing={editing}
        saving={saving}
        saveFailed={saveFailed}
        showErrors={showErrors}
        onSaveFailedChange={setSaveFailed}
        onShowErrors={setShowErrors}
        onSavingChange={setSaving}
        onDone={() => navigate('/treinos')}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Blocos do editor                                                            */
/* -------------------------------------------------------------------------- */

interface SectionProps {
  draft: CustomWorkoutDraft
  onChange: (draft: CustomWorkoutDraft) => void
}

function SectionLabel({ step, children }: { step: number; children: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span className={styles.step}>{step}</span>
      <h2 className={styles.sectionTitle}>{children}</h2>
    </div>
  )
}

function LibrarySection({ draft, onChange }: SectionProps) {
  const full = draft.exercises.length >= draft.exerciseCount

  return (
    <Card className={styles.section}>
      <SectionLabel step={3}>Escolha os exercícios</SectionLabel>

      {full && (
        <p className={styles.notice} role="status">
          Limite atingido — remova um exercício ou aumente a quantidade para adicionar outro.
        </p>
      )}

      <ul className={styles.library}>
        {EXERCISE_LIBRARY.map((exercise) => {
          const selected = draft.exercises.some((item) => item.exerciseId === exercise.id)
          const disabled = selected || full

          return (
            <li key={exercise.id}>
              <button
                type="button"
                className={cx(styles.libraryItem, selected && styles.libraryItemSelected)}
                aria-pressed={selected}
                aria-label={`${exercise.name}${selected ? ' (no treino)' : ''}`}
                disabled={disabled}
                onClick={() => onChange(addExercise(draft, exercise.id))}
              >
                <ExerciseIllustration exercise={exercise} size="sm" className={styles.thumb} />
                <span className={styles.libraryName}>{exercise.name}</span>
                <span className={styles.libraryState}>
                  {selected ? <CheckIcon size={18} /> : <span className={styles.addMark}>+</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Configuração individual de um exercício: modo, alvo, séries e descanso. */
function ExerciseConfigCard({
  draft,
  item,
  index,
  onChange,
}: {
  draft: CustomWorkoutDraft
  item: DraftExercise
  index: number
  onChange: (draft: CustomWorkoutDraft) => void
}) {
  const exercise = EXERCISE_LIBRARY.find((entry) => entry.id === item.exerciseId)
  if (!exercise) return null

  const timed = item.mode === 'timed'
  const patch = (values: Partial<ExerciseConfig>) =>
    onChange(setExerciseConfig(draft, item.exerciseId, values))

  return (
    <li className={styles.exerciseConfig}>
      <div className={styles.exerciseHead}>
        <span className={styles.selectedIndex}>{index + 1}</span>
        <ExerciseIllustration exercise={exercise} size="sm" className={styles.thumb} />

        <div className={styles.exerciseIdentity}>
          <span className={styles.exerciseName}>{exercise.name}</span>
          <span className={styles.exerciseMeta}>{describeExerciseConfig(item)}</span>
        </div>

        <span className={styles.rowActions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Mover ${exercise.name} para cima`}
            disabled={index === 0}
            onClick={() => onChange(moveExercise(draft, item.exerciseId, 'up'))}
          >
            <ChevronUpIcon size={18} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Mover ${exercise.name} para baixo`}
            disabled={index === draft.exercises.length - 1}
            onClick={() => onChange(moveExercise(draft, item.exerciseId, 'down'))}
          >
            <ChevronDownIcon size={18} />
          </button>
          <button
            type="button"
            className={cx(styles.iconButton, styles.iconButtonDanger)}
            aria-label={`Remover ${exercise.name}`}
            onClick={() => onChange(removeExercise(draft, item.exerciseId))}
          >
            <TrashIcon size={18} />
          </button>
        </span>
      </div>

      <div className={styles.modeRow}>
        <span className={styles.modeLabel}>Modo</span>
        <div className={styles.segmented} role="group" aria-label={`Modo de ${exercise.name}`}>
          {MODES.map((mode) => {
            const active = item.mode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                className={cx(styles.segment, active && styles.segmentActive)}
                aria-pressed={active}
                onClick={() => patch({ mode: mode.value })}
              >
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.gridFields}>
        <NumberStepper
          id={`${item.exerciseId}-sets`}
          label="Séries"
          value={item.sets}
          onChange={(sets) => patch({ sets })}
          min={CUSTOM_WORKOUT_LIMITS.minSets}
          max={CUSTOM_WORKOUT_LIMITS.maxSets}
        />

        <NumberStepper
          id={`${item.exerciseId}-target`}
          label={timed ? 'Segundos por série' : 'Repetições por série'}
          value={item.target}
          onChange={(target) => patch({ target })}
          min={timed ? CUSTOM_WORKOUT_LIMITS.minSeconds : CUSTOM_WORKOUT_LIMITS.minRepetitions}
          max={timed ? CUSTOM_WORKOUT_LIMITS.maxSeconds : CUSTOM_WORKOUT_LIMITS.maxRepetitions}
          step={timed ? 5 : 1}
          unit={timed ? 's' : ' reps'}
        />

        <NumberStepper
          id={`${item.exerciseId}-rest`}
          label="Descanso"
          value={item.restDuration}
          onChange={(restDuration) => patch({ restDuration })}
          min={CUSTOM_WORKOUT_LIMITS.minRestSeconds}
          max={CUSTOM_WORKOUT_LIMITS.maxRestSeconds}
          step={5}
          unit="s"
        />
      </div>
    </li>
  )
}

function ConfigSection({ draft, onChange }: SectionProps) {
  return (
    <Card className={styles.section}>
      <SectionLabel step={4}>Configuração dos exercícios</SectionLabel>
      <p className={styles.hint}>
        Cada exercício tem o seu próprio modo, alvo, séries e descanso. É possível misturar
        exercícios por tempo e por repetições no mesmo treino.
      </p>

      <ol className={styles.selected}>
        {draft.exercises.map((item, index) => (
          <ExerciseConfigCard
            key={item.exerciseId}
            draft={draft}
            item={item}
            index={index}
            onChange={onChange}
          />
        ))}
      </ol>
    </Card>
  )
}

interface SaveSectionProps {
  draft: CustomWorkoutDraft
  editing: boolean
  saving: boolean
  saveFailed: boolean
  showErrors: boolean
  onSaveFailedChange: (value: boolean) => void
  onShowErrors: (value: boolean) => void
  onSavingChange: (value: boolean) => void
  onDone: () => void
}

function SaveSection({
  draft,
  editing,
  saving,
  saveFailed,
  showErrors,
  onSaveFailedChange,
  onShowErrors,
  onSavingChange,
  onDone,
}: SaveSectionProps) {
  const errors = useMemo(() => validateDraft(draft, EXERCISE_LIBRARY), [draft])
  const valid = errors.length === 0
  const preview = useMemo(
    () => estimateWorkoutMinutes(toCustomWorkout(draft, EXERCISE_LIBRARY)),
    [draft],
  )
  const distinctModes = new Set(draft.exercises.map((item) => item.mode)).size

  const handleSave = useCallback(() => {
    if (saving) return
    if (!isValidDraft(draft, EXERCISE_LIBRARY)) {
      onShowErrors(true)
      return
    }

    onSavingChange(true)
    onSaveFailedChange(false)

    void saveCustomWorkout(toCustomWorkout(draft, EXERCISE_LIBRARY))
      .then(() => onDone())
      .catch(() => {
        onSavingChange(false)
        onSaveFailedChange(true)
      })
  }, [draft, saving, onSavingChange, onSaveFailedChange, onShowErrors, onDone])

  return (
    <Card variant="accent" className={styles.section}>
      <SectionLabel step={5}>Revisar e salvar</SectionLabel>

      <dl className={styles.summary}>
        <div>
          <dt>Treino</dt>
          <dd>{draft.name.trim() || 'Sem nome'}</dd>
        </div>
        <div>
          <dt>Modos</dt>
          <dd>{distinctModes > 1 ? 'Misto' : 'Único'}</dd>
        </div>
        <div>
          <dt>Exercícios</dt>
          <dd>
            {draft.exercises.length} de {draft.exerciseCount}
          </dd>
        </div>
        <div>
          <dt>Duração estimada</dt>
          <dd>~{preview} min</dd>
        </div>
      </dl>

      {showErrors && !valid && (
        <ul className={styles.errors} role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {saveFailed && (
        <p className={styles.error} role="alert">
          Não foi possível salvar. Tente novamente.
        </p>
      )}

      <Button
        fullWidth
        size="lg"
        leftIcon={<CheckIcon size={18} />}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar treino'}
      </Button>
    </Card>
  )
}
