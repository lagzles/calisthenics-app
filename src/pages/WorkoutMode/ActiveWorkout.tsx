import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ExerciseGuide } from '../../components/ui/ExerciseGuide'
import { ExerciseIllustration } from '../../components/ui/ExerciseIllustration'
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  LayersIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
  XIcon,
} from '../../components/ui/icons'
import { Stat } from '../../components/ui/Stat'
import { PandaDemoPlayer } from '../../features/panda/components/PandaDemoPlayer'
import { PandaMascot } from '../../features/panda/components/PandaMascot'
import { getExercisePandaDemo } from '../../features/panda/domain/pandaCatalog'
import type { Workout, WorkoutEvent, WorkoutSession } from '../../features/workouts/domain/types'
import {
  describeExerciseTarget,
  describeModality,
  describeWorkoutLabel,
} from '../../features/workouts/format'
import { useWorkoutSession } from '../../features/workouts/hooks/useWorkoutSession'
import {
  buildTimerViewModel,
  EXERCISE_LIST_STATE_LABELS,
  getExerciseListState,
  getStageControlIds,
  needsAdvanceConfirmation,
  type ExerciseListState,
  type TimerViewModel,
  type WorkoutControlId,
} from '../../features/workouts/sessionView'
import { useWakeLock } from '../../hooks/useWakeLock'
import { shouldHoldWakeLock, wakeLockWarning } from '../../hooks/wakeLock'
import { getWorkoutAudio } from '../../services/audioService'
import { discardSession, persistSession } from '../../services/workoutService'
import { cx } from '../../utils/cx'
import { formatDateTime, formatDuration, formatSeconds } from '../../utils/format'
import styles from './WorkoutMode.module.css'

interface ActiveWorkoutProps {
  workout: Workout
  initialSession: WorkoutSession
}

type View = { name: 'session' } | { name: 'list' } | { name: 'detail'; index: number }

const STATE_BADGE_VARIANT: Record<ExerciseListState, 'primary' | 'rest' | 'neutral'> = {
  pending: 'neutral',
  active: 'primary',
  resting: 'rest',
  completed: 'neutral',
}

/**
 * Experiência de execução do treino.
 *
 * Toda a lógica de tempo vem do Workout Engine (via `useWorkoutSession`); este
 * componente apenas renderiza o snapshot e encaminha as ações. Áudio e Wake
 * Lock — que não pertencem ao motor — são ligados aqui.
 */
export function ActiveWorkout({ workout, initialSession }: ActiveWorkoutProps) {
  const navigate = useNavigate()
  const audio = useMemo(() => getWorkoutAudio(), [])

  const handleEvents = useCallback((events: WorkoutEvent[]) => audio.handleEvents(events), [audio])

  const {
    snapshot,
    pause,
    resume,
    skipRest,
    skipSet,
    extendRest,
    completeSet,
    advanceExercise,
    goToPreviousExercise,
  } = useWorkoutSession({ workout, initialSession, onEvents: handleEvents })

  const [view, setView] = useState<View>({ name: 'session' })
  const [showAbandon, setShowAbandon] = useState(false)
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)

  // A tela permanece acesa enquanto a sessão estiver ativa — exercício,
  // descanso e transições. Só é liberada ao pausar, concluir ou abandonar.
  const wakeWarning = wakeLockWarning(useWakeLock(shouldHoldWakeLock(snapshot.status)))

  const vm = buildTimerViewModel(snapshot)
  const controlIds = getStageControlIds(snapshot)

  const goToList = useCallback(() => setView({ name: 'list' }), [])
  const goToSession = useCallback(() => setView({ name: 'session' }), [])
  const openDetail = useCallback((index: number) => setView({ name: 'detail', index }), [])

  const togglePause = useCallback(() => {
    if (snapshot.isPaused) resume()
    else pause()
  }, [snapshot.isPaused, resume, pause])

  const previous = useCallback(() => {
    goToPreviousExercise()
    setView({ name: 'session' })
  }, [goToPreviousExercise])

  // Avançar no meio do exercício abandona as séries restantes → confirma antes.
  const advance = useCallback(() => {
    advanceExercise()
    setView({ name: 'session' })
  }, [advanceExercise])

  const requestAdvance = useCallback(() => {
    if (needsAdvanceConfirmation(snapshot)) {
      setShowAdvanceConfirm(true)
      return
    }
    advance()
  }, [snapshot, advance])

  const confirmAdvance = useCallback(() => {
    setShowAdvanceConfirm(false)
    advance()
  }, [advance])

  const keepIncomplete = useCallback(() => {
    const next = snapshot.isPaused ? snapshot.session : pause()
    void persistSession(next)
    audio.dispose()
    navigate('/', { replace: true })
  }, [snapshot.isPaused, snapshot.session, pause, audio, navigate])

  const discard = useCallback(() => {
    const sessionId = snapshot.session.id
    audio.dispose()
    // Sai da tela primeiro (desmonta o hook e para o intervalo de atualização);
    // em seguida remove a sessão, evitando que uma transição a regrave.
    navigate('/', { replace: true })
    void discardSession(sessionId)
  }, [snapshot.session.id, audio, navigate])

  if (snapshot.isWorkoutComplete) {
    return <CompletionScreen workout={workout} session={snapshot.session} />
  }

  return (
    <div className={styles.mode}>
      <header className={styles.topbar}>
        <button type="button" className={styles.topButton} onClick={goToList}>
          <LayersIcon size={18} />
          <span>Lista</span>
        </button>

        <span className={styles.topTitle}>{describeWorkoutLabel(workout)}</span>

        <div className={styles.topActions}>
          <button type="button" className={styles.topButton} onClick={togglePause}>
            {snapshot.isPaused ? <PlayIcon size={16} /> : <PauseIcon size={18} />}
            <span>{snapshot.isPaused ? 'Retomar' : 'Pausar'}</span>
          </button>
          <button
            type="button"
            className={cx(styles.topButton, styles.topDanger)}
            onClick={() => setShowAbandon(true)}
            aria-label="Abandonar treino"
          >
            <XIcon size={18} />
          </button>
        </div>
      </header>

      {wakeWarning && (
        <div className={styles.wakeWarning} role="status">
          <AlertIcon size={16} />
          <span>{wakeWarning}</span>
        </div>
      )}

      <div className={styles.content}>
        {view.name === 'list' && (
          <ExerciseListView
            workout={workout}
            session={snapshot.session}
            currentIndex={snapshot.exerciseIndex}
            onOpenDetail={openDetail}
            onResume={goToSession}
          />
        )}

        {view.name === 'detail' && (
          <ExerciseDetailView workout={workout} index={view.index} onBack={goToList} />
        )}

        {view.name === 'session' && (
          <TimerScreen
            vm={vm}
            isPaused={snapshot.isPaused}
            controls={controlIds}
            canPrevious={snapshot.canGoBack}
            canAdvance={snapshot.canAdvance}
            canSkipRest={snapshot.canSkipRest}
            canCompleteSet={snapshot.canCompleteSet}
            onExtend={extendRest}
            onSkipRest={skipRest}
            onSkipSet={skipSet}
            onCompleteSet={completeSet}
            onRequestAdvance={requestAdvance}
            onPrevious={previous}
          />
        )}
      </div>

      {showAbandon && (
        <AbandonDialog
          onContinue={() => setShowAbandon(false)}
          onKeepIncomplete={keepIncomplete}
          onDiscard={discard}
        />
      )}

      {showAdvanceConfirm && (
        <ConfirmDialog
          title="Avançar para o próximo exercício?"
          message="As séries que não foram concluídas neste exercício não serão registradas."
          confirmLabel="Próximo exercício"
          cancelLabel="Continuar treino"
          onConfirm={confirmAdvance}
          onCancel={() => setShowAdvanceConfirm(false)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Tela do temporizador                                                        */
/* -------------------------------------------------------------------------- */

interface TimerScreenProps {
  vm: TimerViewModel
  isPaused: boolean
  controls: WorkoutControlId[]
  canPrevious: boolean
  canAdvance: boolean
  canSkipRest: boolean
  canCompleteSet: boolean
  onExtend: (seconds: number) => void
  onSkipRest: () => void
  onSkipSet: () => void
  onCompleteSet: () => void
  onRequestAdvance: () => void
  onPrevious: () => void
}

function TimerScreen({
  vm,
  isPaused,
  controls,
  canPrevious,
  canAdvance,
  canSkipRest,
  canCompleteSet,
  onExtend,
  onSkipRest,
  onSkipSet,
  onCompleteSet,
  onRequestAdvance,
  onPrevious,
}: TimerScreenProps) {
  const [guideOpen, setGuideOpen] = useState(false)
  const isResting = vm.tone === 'rest'
  const isDone = vm.tone === 'done'

  const toneClass = isResting ? styles.toneRest : isDone ? styles.toneDone : styles.toneWork
  const badgeVariant = isResting ? 'rest' : isDone ? 'neutral' : 'primary'
  const has = (id: WorkoutControlId) => controls.includes(id)

  const demo = vm.exercise ? getExercisePandaDemo(vm.exercise) : null

  return (
    <div className={cx(styles.stage, toneClass)}>
      <div className={styles.stageHead}>
        <Badge variant={badgeVariant}>{vm.phaseLabel}</Badge>
        {isPaused && <Badge variant="neutral">Pausado</Badge>}
      </div>

      <div className={styles.stageFigure}>
        {isDone || !vm.exercise ? (
          <div className={styles.illustrationDone} aria-hidden="true">
            {isDone && <CheckIcon size={44} />}
          </div>
        ) : isResting ? (
          <PandaMascot state="rest" size="stage" label="Panda descansando" />
        ) : demo ? (
          <PandaDemoPlayer
            key={demo.key}
            track={demo}
            title={vm.exerciseName}
            autoPlay
            paused={isPaused}
            compact
          />
        ) : (
          <PandaMascot state="idle" size="stage" label="Panda" />
        )}
      </div>

      <div className={styles.stageTitle}>
        <h1 className={styles.stageName}>{vm.exerciseName}</h1>
        {vm.exercise && (
          <ExerciseIllustration
            exercise={vm.exercise}
            size="sm"
            className={styles.stageThumb}
            alt={`Esquema do movimento: ${vm.exerciseName}`}
          />
        )}
      </div>

      {vm.timerText !== null ? (
        <div className={cx(styles.timer, isPaused && styles.timerPaused)}>{vm.timerText}</div>
      ) : isDone ? null : (
        <div className={styles.repsTarget}>
          <span className={styles.repsValue}>{vm.repetitions}</span>
          <span className={styles.repsLabel}>repetições</span>
        </div>
      )}

      <p className={styles.setInfo}>
        SÉRIE {vm.currentSet} DE {vm.totalSets} · EXERCÍCIO {vm.exerciseNumber} DE {vm.exerciseCount}
      </p>

      <div className={styles.progressTrack}>
        <div
          className={cx(styles.progressFill, toneClass)}
          style={{ width: `${Math.round(vm.exerciseProgress * 100)}%` }}
        />
      </div>

      <p className={styles.hint}>{vm.message}</p>

      {vm.exercise && (
        <div className={styles.guide}>
          <button
            type="button"
            className={styles.guideToggle}
            onClick={() => setGuideOpen((open) => !open)}
            aria-expanded={guideOpen}
          >
            Orientações do panda
            <span className={cx(styles.guideChevron, guideOpen && styles.guideChevronOpen)}>
              <ChevronRightIcon size={16} />
            </span>
          </button>

          {guideOpen && (
            <div className={styles.guidePanel}>
              <ExerciseGuide exercise={vm.exercise} compact />
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        {has('extend10') && (
          <div className={styles.restRow}>
            <Button variant="rest" size="lg" onClick={() => onExtend(10)}>
              +10s
            </Button>
            <Button variant="rest" size="lg" onClick={() => onExtend(15)}>
              +15s
            </Button>
          </div>
        )}

        {has('skipRest') && (
          <Button
            variant="surface"
            fullWidth
            size="lg"
            onClick={() => onSkipRest()}
            disabled={!canSkipRest}
          >
            Pular descanso
          </Button>
        )}

        {has('completeSet') && (
          <Button
            variant="primary"
            fullWidth
            size="lg"
            leftIcon={<CheckIcon size={18} />}
            onClick={() => onCompleteSet()}
            disabled={!canCompleteSet}
          >
            Concluir série
          </Button>
        )}

        {has('nextExercise') && (
          <Button
            variant={isDone ? 'primary' : 'surface'}
            fullWidth
            size="lg"
            rightIcon={<ChevronRightIcon size={18} />}
            onClick={() => onRequestAdvance()}
            disabled={!canAdvance}
          >
            Próximo exercício
          </Button>
        )}

        {(has('previous') || has('skipSet')) && (
          <div className={styles.secondary}>
            {has('previous') && (
              <Button
                variant="ghost"
                onClick={() => onPrevious()}
                disabled={!canPrevious}
                leftIcon={<ArrowLeftIcon size={16} />}
              >
                Anterior
              </Button>
            )}
            {has('skipSet') && (
              <Button variant="ghost" onClick={() => onSkipSet()} leftIcon={<SkipForwardIcon size={16} />}>
                Pular série
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Lista completa de exercícios                                                */
/* -------------------------------------------------------------------------- */

interface ExerciseListViewProps {
  workout: Workout
  session: WorkoutSession
  currentIndex: number
  onOpenDetail: (index: number) => void
  onResume: () => void
}

function ExerciseListView({
  workout,
  session,
  currentIndex,
  onOpenDetail,
  onResume,
}: ExerciseListViewProps) {
  return (
    <div className={styles.listView}>
      <h2 className={styles.viewTitle}>Exercícios do treino</h2>

      <ul className={styles.exerciseList}>
        {workout.exercises.map((exercise, index) => {
          const state = getExerciseListState(session, index)
          const completedSets = session.exercisesProgress[index]?.completedSets ?? 0
          const isCurrent = index === currentIndex

          return (
            <li key={exercise.id}>
              <button
                type="button"
                className={cx(styles.exerciseRow, isCurrent && styles.exerciseRowCurrent)}
                onClick={() => onOpenDetail(index)}
              >
                <ExerciseIllustration exercise={exercise} size="sm" className={styles.exerciseThumb} />
                <span className={styles.exerciseNumber}>
                  {state === 'completed' ? <CheckIcon size={16} /> : index + 1}
                </span>
                <span className={styles.exerciseInfo}>
                  <span className={styles.exerciseName}>{exercise.name}</span>
                  <span className={styles.exerciseMeta}>
                    {completedSets}/{exercise.sets} séries · {describeExerciseTarget(exercise)}
                  </span>
                </span>
                <Badge variant={STATE_BADGE_VARIANT[state]}>
                  {EXERCISE_LIST_STATE_LABELS[state]}
                </Badge>
              </button>
            </li>
          )
        })}
      </ul>

      <Button fullWidth size="lg" leftIcon={<PlayIcon size={18} />} onClick={() => onResume()}>
        Continuar treino
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Detalhe (consulta) de um exercício                                          */
/* -------------------------------------------------------------------------- */

interface ExerciseDetailViewProps {
  workout: Workout
  index: number
  onBack: () => void
}

function ExerciseDetailView({ workout, index, onBack }: ExerciseDetailViewProps) {
  const exercise = workout.exercises[index]
  if (!exercise) return null

  const demo = getExercisePandaDemo(exercise)

  return (
    <div className={styles.detailView}>
      <div className={styles.detailHead}>
        <span className={styles.detailFigure}>
          <ExerciseIllustration exercise={exercise} size="md" />
        </span>
        <div>
          <span className={styles.detailIndex}>Exercício {index + 1}</span>
          <h2 className={styles.detailName}>{exercise.name}</h2>
        </div>
      </div>

      <div className={styles.tags}>
        <Badge variant={exercise.executionType === 'timed' ? 'primary' : 'neutral'}>
          {describeModality(exercise)}
        </Badge>
        <Badge variant="neutral">{describeExerciseTarget(exercise)}</Badge>
        <Badge variant="rest">Descanso {formatSeconds(exercise.restDuration)}</Badge>
      </div>

      {demo ? (
        <PandaDemoPlayer key={demo.key} track={demo} title={exercise.name} />
      ) : (
        exercise.demoUnavailableReason && (
          <p className={styles.detailLimitation}>
            Sem demonstração visual para este movimento: {exercise.demoUnavailableReason}
          </p>
        )
      )}

      <ExerciseGuide exercise={exercise} />

      <Button fullWidth onClick={() => onBack()} leftIcon={<ArrowLeftIcon size={16} />}>
        Voltar ao treino
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Conclusão do treino                                                         */
/* -------------------------------------------------------------------------- */

interface CompletionScreenProps {
  workout: Workout
  session: WorkoutSession
}

function CompletionScreen({ workout, session }: CompletionScreenProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(false)

  const exercisesCompleted = session.exercisesProgress.filter((progress) => progress.completed).length

  const handleSave = useCallback(() => {
    // Evita salvar/navegar duas vezes em toques repetidos no botão.
    if (savedRef.current) return
    savedRef.current = true
    setSaving(true)

    void persistSession(session)
      .then(() => navigate('/historico', { replace: true }))
      .catch(() => {
        savedRef.current = false
        setSaving(false)
      })
  }, [session, navigate])

  return (
    <div className={styles.mode}>
      <div className={styles.completion}>
        <span className={styles.completionIcon}>
          <CheckIcon size={48} />
        </span>

        <PandaMascot
          state="celebrating"
          size="xl"
          className={styles.completionMascot}
          label="Panda comemorando o treino concluído"
        />

        <div>
          <h1 className={styles.completionTitle}>Treino concluído!</h1>
          <p className={styles.completionName}>{describeWorkoutLabel(workout)}</p>
        </div>

        <div className={styles.completionStats}>
          <Stat label="Duração" value={formatDuration(session.duration)} />
          <Stat label="Exercícios" value={`${exercisesCompleted}/${workout.exercises.length}`} />
          <Stat label="Séries" value={String(session.completedSets)} />
        </div>

        <p className={styles.completionDate}>{formatDateTime(session.finishedAt ?? session.startedAt)}</p>

        <div className={styles.completionActions}>
          <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Finalizar e salvar treino'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Diálogos                                                                    */
/* -------------------------------------------------------------------------- */

interface AbandonDialogProps {
  onContinue: () => void
  onKeepIncomplete: () => void
  onDiscard: () => void
}

function AbandonDialog({ onContinue, onKeepIncomplete, onDiscard }: AbandonDialogProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Abandonar treino">
      <Card className={styles.dialog}>
        <h2 className={styles.dialogTitle}>Abandonar treino?</h2>
        <p className={styles.dialogText}>
          Você pode continuar de onde parou mais tarde, ou descartar o progresso desta sessão.
        </p>

        <Button variant="primary" fullWidth onClick={() => onContinue()}>
          Continuar treinando
        </Button>
        <Button variant="surface" fullWidth onClick={() => onKeepIncomplete()}>
          Sair e manter incompleto
        </Button>
        <Button variant="ghost" fullWidth onClick={() => onDiscard()}>
          Descartar sessão
        </Button>
      </Card>
    </div>
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <Card className={styles.dialog}>
        <h2 className={styles.dialogTitle}>{title}</h2>
        <p className={styles.dialogText}>{message}</p>

        <Button variant="surface" fullWidth onClick={() => onConfirm()}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" fullWidth onClick={() => onCancel()}>
          {cancelLabel}
        </Button>
      </Card>
    </div>
  )
}
