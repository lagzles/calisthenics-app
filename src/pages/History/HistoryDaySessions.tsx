import { Card } from '../../components/ui/Card'
import { CheckIcon, DumbbellIcon } from '../../components/ui/icons'
import { PandaMascot } from '../../features/panda/components/PandaMascot'
import type { WorkoutSession } from '../../features/workouts/domain/types'
import { isPresetWorkoutId } from '../../features/workouts/format'
import { dayLabel, monthLabel, type CalendarMonth } from '../../features/workouts/historyCalendar'
import { getWorkoutById } from '../../services/workoutService'
import { formatDuration, formatSeconds, formatTime } from '../../utils/format'
import styles from './HistoryDaySessions.module.css'

interface HistoryDaySessionsProps {
  selectedDay: string | null
  sessions: WorkoutSession[]
  month: CalendarMonth
  monthHasSessions: boolean
}

/**
 * Detalhes do dia selecionado no calendário.
 *
 * Exibe todas as sessões concluídas daquele dia, individualmente, com horário,
 * duração, exercícios e séries registrados pelo Workout Engine. Dias sem treino
 * recebem uma mensagem simples e amigável do Panda.
 */
export function HistoryDaySessions({
  selectedDay,
  sessions,
  month,
  monthHasSessions,
}: HistoryDaySessionsProps) {
  if (!selectedDay) {
    return (
      <DayNotice
        title={
          monthHasSessions
            ? 'Selecione um dia'
            : `Nenhum treino em ${monthLabel(month)}`
        }
        description={
          monthHasSessions
            ? 'Toque em um dia destacado para consultar as sessões concluídas.'
            : 'Seu calendário vai preencher à medida que você concluir treinos.'
        }
      />
    )
  }

  if (sessions.length === 0) {
    return (
      <section className={styles.details} aria-labelledby="history-day-title">
        <header className={styles.detailsHead}>
          <h2 id="history-day-title" className={styles.detailsTitle}>
            {dayLabel(selectedDay)}
          </h2>
        </header>

        <div className={styles.notice}>
          <PandaMascot
            state="encouraging"
            size="sm"
            label="Panda incentivando o descanso"
          />
          <div className={styles.noticeText}>
            <p className={styles.noticeTitle}>Nenhum treino concluído neste dia</p>
            <p className={styles.noticeDescription}>
              Descanso também faz parte do plano. Que tal um treino hoje?
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.details} aria-labelledby="history-day-title">
      <header className={styles.detailsHead}>
        <h2 id="history-day-title" className={styles.detailsTitle}>
          {dayLabel(selectedDay)}
        </h2>
        <span className={styles.detailsCount}>
          {sessions.length} {sessions.length === 1 ? 'treino' : 'treinos'}
        </span>
      </header>

      <ul className={styles.sessionList}>
        {sessions.map((session) => (
          <li key={session.id}>
            <SessionCard session={session} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SessionCard({ session }: { session: WorkoutSession }) {
  const workout = getWorkoutById(session.workoutId)
  const finishedAt = session.finishedAt ?? session.startedAt
  const isPreset = isPresetWorkoutId(session.workoutId)

  return (
    <Card className={styles.sessionCard}>
      <header className={styles.sessionHead}>
        <span className={styles.mark}>{isPreset ? session.workoutId : <DumbbellIcon size={18} />}</span>

        <div className={styles.sessionIdentity}>
          <h3 className={styles.sessionName}>{session.workoutName}</h3>
          <p className={styles.sessionMeta}>
            <time dateTime={session.startedAt}>{formatTime(session.startedAt)}</time>
            <span aria-hidden="true">–</span>
            <time dateTime={finishedAt}>{formatTime(finishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(session.duration)}</span>
          </p>
        </div>

        <span className={styles.sessionSets}>{session.completedSets} séries</span>
      </header>

      {session.exercisesProgress.length === 0 ? (
        <p className={styles.noDetails}>Registro sem detalhes de exercícios.</p>
      ) : (
        <ul className={styles.exerciseList}>
          {session.exercisesProgress.map((progress, index) => {
            const exercise =
              workout?.exercises.find((item) => item.id === progress.exerciseId) ??
              workout?.exercises[index]
            const totalSets = exercise?.sets

            return (
              <li key={progress.exerciseId} className={styles.exercise}>
                <div className={styles.exerciseHead}>
                  <span className={styles.exerciseName}>
                    {exercise?.name ?? progress.exerciseName ?? progress.exerciseId}
                  </span>
                  <span className={styles.exerciseSets}>
                    {progress.completedSets}
                    {totalSets ? `/${totalSets}` : ''} séries
                    {progress.completed && (
                      <CheckIcon size={14} className={styles.check} />
                    )}
                  </span>
                </div>

                {progress.sets.length > 0 && (
                  <ul className={styles.setList}>
                    {progress.sets.map((set) => {
                      const results = [
                        typeof set.workSeconds === 'number'
                          ? formatSeconds(set.workSeconds)
                          : null,
                        typeof set.actualRepetitions === 'number'
                          ? `${set.actualRepetitions} reps`
                          : null,
                      ].filter((value): value is string => value !== null)

                      return (
                        <li key={set.set} className={styles.setChip}>
                          Série {set.set}
                          {results.length > 0 ? ` · ${results.join(' · ')}` : ''}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {(progress.skippedSets ?? 0) > 0 && (
                  <span className={styles.skipped}>
                    {progress.skippedSets}{' '}
                    {progress.skippedSets === 1 ? 'série pulada' : 'séries puladas'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function DayNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.notice}>
      <PandaMascot state="encouraging" size="sm" label="Panda acompanhando o histórico" />
      <div className={styles.noticeText}>
        <p className={styles.noticeTitle}>{title}</p>
        <p className={styles.noticeDescription}>{description}</p>
      </div>
    </div>
  )
}
