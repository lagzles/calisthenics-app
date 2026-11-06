import { useCallback, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ExerciseIllustration } from '../../components/ui/ExerciseIllustration'
import { ArrowLeftIcon, ClockIcon, LayersIcon, PlayIcon, TargetIcon } from '../../components/ui/icons'
import type { Workout } from '../../features/workouts/domain/types'
import { describeExerciseTarget } from '../../features/workouts/format'
import { countTotalSets } from '../../features/workouts/domain/workoutSelectors'
import { formatMinutes } from '../../utils/format'
import styles from './PreparationScreen.module.css'

interface PreparationScreenProps {
  workout: Workout
  /** Inicia o treino (a ação explícita do usuário). */
  onStart: () => Promise<void>
  onBack: () => void
}

/**
 * Tela de preparação do treino.
 *
 * Existe **antes** de criar a sessão: mostra as informações do treino e a
 * ilustração/instruções do primeiro exercício. O cronômetro não inicia sozinho —
 * só após o toque em "Iniciar treino" (que cria a sessão e prepara o áudio
 * dentro do gesto do usuário).
 */
export function PreparationScreen({ workout, onStart, onBack }: PreparationScreenProps) {
  const [starting, setStarting] = useState(false)
  const [failed, setFailed] = useState(false)

  const firstExercise = workout.exercises[0]
  const totalSets = countTotalSets(workout)

  const handleStart = useCallback(() => {
    if (starting) return
    setStarting(true)
    setFailed(false)
    onStart().catch(() => {
      setStarting(false)
      setFailed(true)
    })
  }, [starting, onStart])

  return (
    <div className={styles.prep}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeftIcon size={18} />
        Treinos
      </button>

      <Card variant="accent" className={styles.hero}>
        <Badge variant="primary">Treino {workout.id}</Badge>
        <div>
          <h1 className={styles.heroName}>{workout.name}</h1>
          <p className={styles.heroGoal}>{workout.description}</p>
        </div>
        <ul className={styles.metaRow}>
          <li>
            <ClockIcon size={16} />
            {formatMinutes(workout.estimatedMinutes)}
          </li>
          <li>
            <LayersIcon size={16} />
            {workout.exercises.length} exercícios
          </li>
          <li>
            <TargetIcon size={16} />
            {totalSets} séries
          </li>
        </ul>
      </Card>

      {firstExercise && (
        <Card className={styles.first}>
          <div className={styles.firstHead}>
            <span className={styles.firstIndex}>Exercício 1</span>
            <h2 className={styles.firstName}>{firstExercise.name}</h2>
          </div>

          <div className={styles.firstFigure}>
            <ExerciseIllustration exercise={firstExercise} size="lg" />
          </div>

          <p className={styles.firstDescription}>{firstExercise.instructions}</p>

          {firstExercise.steps && firstExercise.steps.length > 0 && (
            <ol className={styles.steps}>
              {firstExercise.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}

          <span className={styles.target}>{describeExerciseTarget(firstExercise)}</span>
        </Card>
      )}

      <p className={styles.note}>
        O cronômetro só começa quando você tocar em <strong>Iniciar treino</strong>.
      </p>

      {failed && <p className={styles.error}>Não foi possível iniciar. Tente novamente.</p>}

      <div className={styles.actions}>
        <Button
          fullWidth
          size="lg"
          leftIcon={<PlayIcon size={18} />}
          onClick={() => handleStart()}
          disabled={starting}
        >
          {starting ? 'Iniciando...' : 'Iniciar treino'}
        </Button>
      </div>
    </div>
  )
}
