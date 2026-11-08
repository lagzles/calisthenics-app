import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Stat } from '../../components/ui/Stat'
import { useHistoryData } from '../../features/workouts/hooks/useHistoryData'
import {
  addMonths,
  buildHistoryIndicators,
  groupSessionsByDate,
  isDayInMonth,
  latestSessionDayInMonth,
  monthLabel,
  monthOf,
  toLocalDateKey,
  type CalendarMonth,
} from '../../features/workouts/historyCalendar'
import { HistoryCalendar } from './HistoryCalendar'
import { HistoryDaySessions } from './HistoryDaySessions'
import styles from './HistoryPage.module.css'

/**
 * Tela de histórico com calendário mensal.
 *
 * Todos os números e destaques derivam das sessões reais concluídas no
 * IndexedDB (`useHistoryData`). A navegação entre meses e a seleção de dias são
 * estado local da página — nenhuma recarga da aplicação.
 */
export function HistoryPage() {
  const { loading, sessions } = useHistoryData()
  const [now] = useState(() => Date.now())
  const todayKey = useMemo(() => toLocalDateKey(now) ?? '', [now])
  const [month, setMonth] = useState<CalendarMonth>(() => monthOf(now))
  const [selectedDay, setSelectedDay] = useState<string | null>(todayKey)

  const sessionsByDate = useMemo(() => groupSessionsByDate(sessions), [sessions])

  const sessionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const [dateKey, daySessions] of sessionsByDate) {
      counts.set(dateKey, daySessions.length)
    }
    return counts
  }, [sessionsByDate])

  const indicators = useMemo(
    () => buildHistoryIndicators(sessions, month, todayKey),
    [sessions, month, todayKey],
  )

  const monthHasSessions = useMemo(
    () => [...sessionsByDate.keys()].some((dateKey) => isDayInMonth(dateKey, month)),
    [sessionsByDate, month],
  )

  const selectedSessions = selectedDay ? (sessionsByDate.get(selectedDay) ?? []) : []

  const changeMonth = (delta: number) => {
    const nextMonth = addMonths(month, delta)
    setMonth(nextMonth)
    setSelectedDay(latestSessionDayInMonth(sessionsByDate, nextMonth))
  }

  const streakHint =
    indicators.currentStreak === 0
      ? 'sem dias seguidos'
      : indicators.currentStreak === 1
        ? 'dia consecutivo'
        : 'dias consecutivos'

  return (
    <div className={styles.page}>
      <PageHeader
        title="Histórico"
        subtitle="Acompanhe seus treinos concluídos, dia a dia."
      />

      <Card className={styles.statsCard}>
        <Stat
          label="Total de treinos"
          value={String(indicators.totalWorkouts)}
          hint="sessões concluídas"
        />
        <Stat
          label="Sequência atual"
          value={String(indicators.currentStreak)}
          hint={streakHint}
        />
        <Stat
          label="Treinos no mês"
          value={String(indicators.monthWorkouts)}
          hint={monthLabel(month)}
        />
      </Card>

      <HistoryCalendar
        month={month}
        todayKey={todayKey}
        selectedDay={selectedDay}
        sessionCounts={sessionCounts}
        onSelectDay={setSelectedDay}
        onPreviousMonth={() => changeMonth(-1)}
        onNextMonth={() => changeMonth(1)}
      />

      {loading ? (
        <p className={styles.loading}>Carregando histórico…</p>
      ) : (
        <HistoryDaySessions
          selectedDay={selectedDay}
          sessions={selectedSessions}
          month={month}
          monthHasSessions={monthHasSessions}
        />
      )}
    </div>
  )
}
