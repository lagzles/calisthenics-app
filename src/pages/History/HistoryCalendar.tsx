import { Card } from '../../components/ui/Card'
import { ArrowLeftIcon, ArrowRightIcon } from '../../components/ui/icons'
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  dayLabel,
  monthLabel,
  type CalendarMonth,
} from '../../features/workouts/historyCalendar'
import { cx } from '../../utils/cx'
import styles from './HistoryCalendar.module.css'

interface HistoryCalendarProps {
  month: CalendarMonth
  todayKey: string
  selectedDay: string | null
  /** Quantidade de sessões concluídas por dia (`YYYY-MM-DD`). */
  sessionCounts: Map<string, number>
  onSelectDay: (dateKey: string) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
}

/**
 * Calendário mensal do histórico.
 *
 * Somente dias com pelo menos uma sessão concluída recebem o destaque verde.
 * A navegação entre meses é feita em memória — sem recarregar a aplicação — e a
 * grade respeita a semana começando na segunda-feira, anos bissextos e datas
 * locais.
 */
export function HistoryCalendar({
  month,
  todayKey,
  selectedDay,
  sessionCounts,
  onSelectDay,
  onPreviousMonth,
  onNextMonth,
}: HistoryCalendarProps) {
  const cells = buildMonthGrid(month, todayKey)

  return (
    <Card className={styles.calendar}>
      <header className={styles.head}>
        <button
          type="button"
          className={styles.navButton}
          onClick={onPreviousMonth}
          aria-label="Mês anterior"
        >
          <ArrowLeftIcon size={18} />
        </button>

        <h2 className={styles.monthLabel} aria-live="polite">
          {monthLabel(month)}
        </h2>

        <button
          type="button"
          className={styles.navButton}
          onClick={onNextMonth}
          aria-label="Próximo mês"
        >
          <ArrowRightIcon size={18} />
        </button>
      </header>

      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>

      <div className={styles.grid} role="group" aria-label="Dias do mês">
        {cells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className={styles.emptyCell} aria-hidden="true" />
          }

          const count = sessionCounts.get(cell.dateKey) ?? 0
          const isSelected = selectedDay === cell.dateKey
          const trainingLabel =
            count === 0
              ? 'sem treino'
              : count === 1
                ? '1 treino concluído'
                : `${count} treinos concluídos`

          return (
            <button
              key={cell.dateKey}
              type="button"
              className={cx(
                styles.day,
                count > 0 && styles.completed,
                cell.isToday && styles.today,
                isSelected && styles.selected,
              )}
              onClick={() => onSelectDay(cell.dateKey)}
              aria-pressed={isSelected}
              aria-current={cell.isToday ? 'date' : undefined}
              aria-label={`${dayLabel(cell.dateKey)} — ${trainingLabel}`}
            >
              <span className={styles.dayNumber}>{cell.day}</span>
              {count > 0 && <span className={styles.dayDot} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={cx(styles.legendDot, styles.legendCompleted)} aria-hidden="true" />
          Treino concluído
        </span>
        <span className={styles.legendItem}>
          <span className={cx(styles.legendDot, styles.legendEmpty)} aria-hidden="true" />
          Sem treino
        </span>
        <span className={styles.legendItem}>
          <span className={cx(styles.legendDot, styles.legendToday)} aria-hidden="true" />
          Hoje
        </span>
      </div>
    </Card>
  )
}
