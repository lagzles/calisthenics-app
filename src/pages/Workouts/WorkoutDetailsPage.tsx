import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ExerciseGuide } from '../../components/ui/ExerciseGuide'
import { ExerciseIllustration } from '../../components/ui/ExerciseIllustration'
import {
  ArrowLeftIcon,
  ClockIcon,
  LayersIcon,
  PlayIcon,
  TargetIcon,
} from '../../components/ui/icons'
import { describeExerciseTarget, describeModality } from '../../features/workouts/format'
import { getWorkoutById } from '../../services/workoutService'
import { formatMinutes, formatSeconds } from '../../utils/format'
import styles from './WorkoutDetailsPage.module.css'

/**
 * Tela de apresentação do treino (consulta de exercícios) e ponto de entrada do
 * Workout Mode. "Iniciar treino" abre a tela de preparação — o cronômetro só
 * começa após um toque explícito em "Iniciar treino" naquela tela.
 */
export function WorkoutDetailsPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const workout = workoutId ? getWorkoutById(workoutId) : undefined

  if (!workout) {
    return (
      <EmptyState
        title="Treino não encontrado"
        description="O treino que você procurou não existe ou foi movido."
        action={<Button onClick={() => navigate('/treinos')}>Voltar para treinos</Button>}
      />
    )
  }

  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.sets, 0)

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => navigate('/treinos')}>
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

      <h2 className={styles.sectionTitle}>Exercícios</h2>

      <div className={styles.exerciseList}>
        {workout.exercises.map((exercise, index) => (
          <Card key={exercise.id} className={styles.exerciseCard}>
            <div className={styles.exerciseHead}>
              <span className={styles.exerciseThumb}>
                <ExerciseIllustration exercise={exercise} size="md" />
              </span>
              <div>
                <span className={styles.exerciseIndex}>Exercício {index + 1}</span>
                <h3 className={styles.exerciseName}>{exercise.name}</h3>
              </div>
            </div>

            <div className={styles.tags}>
              <Badge variant={exercise.executionType === 'timed' ? 'primary' : 'neutral'}>
                {describeModality(exercise)}
              </Badge>
              <Badge variant="neutral">{describeExerciseTarget(exercise)}</Badge>
              <Badge variant="rest">Descanso {formatSeconds(exercise.restDuration)}</Badge>
            </div>

            <ExerciseGuide exercise={exercise} />
          </Card>
        ))}
      </div>

      <div className={styles.actions}>
        <Button
          fullWidth
          size="lg"
          leftIcon={<PlayIcon size={18} />}
          onClick={() => navigate(`/treino/${workout.id}`)}
        >
          Iniciar treino
        </Button>
      </div>
    </div>
  )
}
