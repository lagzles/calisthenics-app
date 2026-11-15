import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ExerciseIllustration } from '../../components/ui/ExerciseIllustration'
import { ChevronRightIcon, ClockIcon, LayersIcon, PlayIcon } from '../../components/ui/icons'
import { getWorkouts } from '../../services/workoutService'
import { formatMinutes } from '../../utils/format'
import { CustomWorkoutsSection } from './CustomWorkoutsSection'
import styles from './WorkoutsPage.module.css'

export function WorkoutsPage() {
  const navigate = useNavigate()
  const workouts = getWorkouts()

  // Abre a tela de preparação; o cronômetro só inicia com um toque explícito.
  const startWorkout = (workoutId: string) => {
    navigate(`/treino/${workoutId}`)
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Treinos" subtitle="Consulte os detalhes ou comece a treinar." />

      <CustomWorkoutsSection />

      <h2 className={styles.presetsTitle}>Treinos do app</h2>

      <ul className={styles.list}>
        {workouts.map((workout) => (
          <li key={workout.id}>
            <Card variant="accent" className={styles.card}>
              <div className={styles.cardTop}>
                <Badge variant="primary">Treino {workout.id}</Badge>
                <Link to={`/treinos/${workout.id}`} className={styles.detailsLink}>
                  Detalhes
                  <ChevronRightIcon size={18} />
                </Link>
              </div>

              <div>
                <h2 className={styles.name}>{workout.name}</h2>
                <p className={styles.goal}>{workout.description}</p>
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
              </ul>

              <ul className={styles.exercises}>
                {workout.exercises.map((exercise) => (
                  <li key={exercise.id} className={styles.exerciseItem}>
                    <ExerciseIllustration
                      exercise={exercise}
                      size="sm"
                      className={styles.exerciseThumb}
                    />
                    <span className={styles.exerciseName}>{exercise.name}</span>
                  </li>
                ))}
              </ul>

              <Button
                fullWidth
                leftIcon={<PlayIcon size={18} />}
                onClick={() => startWorkout(workout.id)}
              >
                Iniciar treino {workout.id}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
