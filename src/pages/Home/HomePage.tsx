import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LogoMark } from '../../components/ui/Logo'
import { PandaMascot } from '../../features/panda/components/PandaMascot'
import type { PandaState } from '../../features/panda/domain/pandaTypes'
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  FlameIcon,
  LayersIcon,
  PlayIcon,
  TargetIcon,
} from '../../components/ui/icons'
import { useHomeData } from '../../features/workouts/hooks/useHomeData'
import { cx } from '../../utils/cx'
import { formatMinutes, formatRelativeDays } from '../../utils/format'
import styles from './HomePage.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const { summary, recommended, lastWorkout, totalWorkouts } = useHomeData()

  const totalSets = recommended.exercises.reduce((total, exercise) => total + exercise.sets, 0)
  const lastWorkoutSummary = summary.lastWorkout

  // O panda acompanha o progresso da semana: sai da saudação para a
  // comemoração quando a meta semanal é batida.
  const goalReached = summary.weeklyWorkoutsCompleted >= summary.weeklyWorkoutsGoal
  const greetingState: PandaState = goalReached ? 'streak' : 'welcome'
  const greetingMessage = goalReached
    ? `Meta da semana batida: ${summary.weeklyWorkoutsCompleted} treinos. Bora manter?`
    : 'Pronto para se movimentar hoje?'

  // Abre a preparação do treino; o início (e o áudio) acontecem lá.
  const startWorkout = (workoutId: string) => {
    navigate(`/treino/${workoutId}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <LogoMark size={40} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>Calisthenics</span>
            <span className={styles.brandTag}>{totalWorkouts} treinos disponíveis</span>
          </div>
        </div>
      </header>

      <section className={styles.greeting}>
        <div className={styles.greetingMascot}>
          <PandaMascot
            state={greetingState}
            size="lg"
            label={greetingState === 'streak' ? 'Panda comemorando a sequência' : 'Panda saudando'}
          />
        </div>
        <div className={styles.greetingText}>
          <h1 className={styles.greetingTitle}>Olá! 👋</h1>
          <p className={styles.greetingSubtitle}>{greetingMessage}</p>
        </div>
      </section>

      <Card variant="accent" className={styles.recommended}>
        <div className={styles.recommendedTop}>
          <Badge variant="primary">Treino recomendado</Badge>
          <span className={styles.workoutMark}>{recommended.id}</span>
        </div>

        <div>
          <h2 className={styles.recommendedName}>{recommended.name}</h2>
          <p className={styles.recommendedGoal}>{recommended.description}</p>
        </div>

        <ul className={styles.metaRow}>
          <li>
            <ClockIcon size={16} />
            {formatMinutes(recommended.estimatedMinutes)}
          </li>
          <li>
            <LayersIcon size={16} />
            {recommended.exercises.length} exercícios
          </li>
          <li>
            <TargetIcon size={16} />
            {totalSets} séries
          </li>
        </ul>

        <Button
          fullWidth
          size="lg"
          leftIcon={<PlayIcon size={18} />}
          onClick={() => startWorkout(recommended.id)}
        >
          Iniciar treino {recommended.id}
        </Button>
      </Card>

      <Card className={styles.summary}>
        <div className={styles.summaryHead}>
          <h2 className={styles.sectionTitle}>Resumo da semana</h2>
          <FlameIcon size={18} className={styles.summaryIcon} />
        </div>
        <div className={styles.summaryBody}>
          <div className={styles.summaryNumbers}>
            <span className={styles.summaryBig}>{summary.weeklyWorkoutsCompleted}</span>
            <span className={styles.summaryOf}>de {summary.weeklyWorkoutsGoal} treinos</span>
          </div>
          <div className={styles.weekDots} aria-hidden="true">
            {Array.from({ length: summary.weeklyWorkoutsGoal }).map((_, index) => (
              <span
                key={index}
                className={cx(
                  styles.dot,
                  index < summary.weeklyWorkoutsCompleted && styles.dotDone,
                )}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className={styles.lastWorkout}>
        <span className={styles.lastIcon}>
          <CalendarIcon size={20} />
        </span>
        <div className={styles.lastBody}>
          <span className={styles.lastLabel}>Último treino</span>
          <span className={styles.lastValue}>
            {lastWorkout
              ? `Treino ${lastWorkout.id} · ${lastWorkout.name}`
              : 'Nenhum treino ainda'}
          </span>
        </div>
        {lastWorkoutSummary && (
          <div className={styles.lastMeta}>
            <span>{formatRelativeDays(lastWorkoutSummary.daysAgo)}</span>
            <span className={styles.lastDuration}>
              {formatMinutes(lastWorkoutSummary.completedMinutes)}
            </span>
          </div>
        )}
      </Card>

      <Link to="/treinos" className={styles.allLink}>
        Ver todos os treinos
        <ArrowRightIcon size={18} />
      </Link>
    </div>
  )
}
