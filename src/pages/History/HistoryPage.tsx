import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Stat } from '../../components/ui/Stat'
import { CheckIcon, ChevronRightIcon, HistoryIcon } from '../../components/ui/icons'
import { useHistoryData } from '../../features/workouts/hooks/useHistoryData'
import { getWorkoutById } from '../../services/workoutService'
import { cx } from '../../utils/cx'
import { formatDateTime, formatMinutes } from '../../utils/format'
import styles from './HistoryPage.module.css'

/**
 * Tela de histórico.
 *
 * Exibe apenas sessões **concluídas** (vindas do IndexedDB). Cada sessão pode ser
 * expandida para consultar as séries realizadas exercício a exercício.
 */
export function HistoryPage() {
  const { loading, summary, items, sessions } = useHistoryData()
  const [openId, setOpenId] = useState<string | null>(null)

  const sessionsById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  )

  return (
    <div className={styles.page}>
      <PageHeader title="Histórico" subtitle="Acompanhe seus treinos concluídos." />

      <Card className={styles.statsCard}>
        <Stat label="Treinos concluídos" value={String(summary.totalWorkouts)} />
        <Stat label="Nesta semana" value={String(summary.weeklyWorkouts)} />
        <Stat label="Tempo total" value={formatMinutes(summary.totalMinutes)} />
      </Card>

      {loading && <p className={styles.loading}>Carregando histórico…</p>}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={<HistoryIcon size={26} />}
          title="Seu histórico aparecerá aqui"
          description="Quando você concluir um treino, ele será registrado nesta tela."
        />
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => {
            const session = sessionsById.get(item.id)
            const workout = getWorkoutById(item.workoutId)
            const isOpen = openId === item.id

            return (
              <li key={item.id}>
                <Card className={styles.sessionCard}>
                  <button
                    type="button"
                    className={styles.sessionHead}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.sessionMark}>{item.workoutId}</span>

                    <span className={styles.sessionInfo}>
                      <span className={styles.sessionName}>{item.workoutName}</span>
                      <span className={styles.sessionDate}>{formatDateTime(item.finishedAt)}</span>
                    </span>

                    <span className={styles.sessionMeta}>
                      <span className={styles.sessionDuration}>
                        {formatMinutes(item.durationMinutes)}
                      </span>
                      <span className={styles.sessionCounts}>
                        {item.exercisesCompleted}/{item.exercisesTotal} exercícios ·{' '}
                        {item.setsCompleted} séries
                      </span>
                    </span>

                    <ChevronRightIcon
                      size={18}
                      className={cx(styles.chevron, isOpen && styles.chevronOpen)}
                    />
                  </button>

                  {isOpen && session && (
                    <ul className={styles.sessionDetail}>
                      {session.exercisesProgress.map((progress, index) => {
                        const exercise = workout?.exercises[index]
                        return (
                          <li key={progress.exerciseId} className={styles.detailRow}>
                            <span className={styles.detailName}>
                              {exercise?.name ?? progress.exerciseId}
                            </span>
                            <span className={styles.detailSets}>
                              {progress.completedSets}/{exercise?.sets ?? '?'} séries
                            </span>
                            {progress.completed && (
                              <CheckIcon size={16} className={styles.detailCheck} />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
