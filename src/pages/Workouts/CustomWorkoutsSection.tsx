import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ExerciseIllustration } from '../../components/ui/ExerciseIllustration'
import {
  ClockIcon,
  EditIcon,
  LayersIcon,
  PlayIcon,
  PlusIcon,
  TargetIcon,
  TrashIcon,
} from '../../components/ui/icons'
import { useCustomWorkouts } from '../../features/workouts/hooks/useCustomWorkouts'
import { countTotalSets } from '../../features/workouts/domain/workoutSelectors'
import type { CustomWorkout } from '../../features/workouts/domain/types'
import { describeExerciseTarget } from '../../features/workouts/format'
import { deleteCustomWorkout } from '../../services/workoutService'
import { formatMinutes } from '../../utils/format'
import styles from './CustomWorkoutsSection.module.css'

/** Indica se o treino mistura exercícios por tempo e por repetições. */
function isMixed(workout: CustomWorkout): boolean {
  return new Set(workout.exercises.map((exercise) => exercise.executionType)).size > 1
}

/** Rótulo do modo do treino: único ou misto. */
function describeModes(workout: CustomWorkout): string {
  if (isMixed(workout)) return 'Misto'
  return workout.exercises[0]?.executionType === 'timed' ? 'Por tempo' : 'Por repetições'
}

/**
 * Seção "Meus treinos" da página de treinos.
 *
 * Lista os treinos personalizados e oferece as quatro ações do ciclo de vida:
 * iniciar (reaproveitando a rota `/treino/:workoutId`), editar, excluir e criar.
 */
export function CustomWorkoutsSection() {
  const navigate = useNavigate()
  const { loading, workouts, reload } = useCustomWorkouts()
  const [pendingDelete, setPendingDelete] = useState<CustomWorkout | null>(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = useCallback(() => {
    if (!pendingDelete || deleting) return
    setDeleting(true)

    void deleteCustomWorkout(pendingDelete.id)
      .then(() => {
        setPendingDelete(null)
        setDeleting(false)
        reload()
      })
      .catch(() => {
        setDeleting(false)
      })
  }, [pendingDelete, deleting, reload])

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Meus treinos</h2>
          <p className={styles.subtitle}>Treinos montados por você com os exercícios do app.</p>
        </div>

        <Button
          variant="surface"
          leftIcon={<PlusIcon size={18} />}
          onClick={() => navigate('/treinos/personalizados/novo')}
        >
          Criar
        </Button>
      </header>

      {loading ? (
        <p className={styles.loading}>Carregando seus treinos…</p>
      ) : workouts.length === 0 ? (
        <EmptyState
          title="Nenhum treino personalizado"
          description="Crie um treino escolhendo os exercícios, o modo de execução e o descanso."
          action={
            <Button
              leftIcon={<PlusIcon size={18} />}
              onClick={() => navigate('/treinos/personalizados/novo')}
            >
              Criar treino
            </Button>
          }
        />
      ) : (
        <ul className={styles.list}>
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Card variant="accent" className={styles.card}>
                <div className={styles.cardTop}>
                  <Badge variant={isMixed(workout) ? 'rest' : 'primary'}>
                    {describeModes(workout)}
                  </Badge>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Editar ${workout.name}`}
                      onClick={() => navigate(`/treinos/personalizados/${workout.id}/editar`)}
                    >
                      <EditIcon size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Excluir ${workout.name}`}
                      onClick={() => setPendingDelete(workout)}
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className={styles.name}>{workout.name}</h3>
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
                  <li>
                    <TargetIcon size={16} />
                    {countTotalSets(workout)} séries
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
                      <span className={styles.exerciseTarget}>
                        {describeExerciseTarget(exercise)}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  fullWidth
                  leftIcon={<PlayIcon size={18} />}
                  onClick={() => navigate(`/treino/${workout.id}`)}
                >
                  Iniciar treino
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Excluir treino"
        >
          <Card className={styles.dialog}>
            <h2 className={styles.dialogTitle}>Excluir treino?</h2>
            <p className={styles.dialogText}>
              <strong>{pendingDelete.name}</strong> será removido. O histórico de treinos já
              concluídos continua salvo.
            </p>

            <Button variant="surface" fullWidth onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir treino'}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
          </Card>
        </div>
      )}
    </section>
  )
}
