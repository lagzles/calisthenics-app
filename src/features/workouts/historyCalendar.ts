import type { WorkoutSession } from './domain/types'

/**
 * Calendário e indicadores do histórico de treinos.
 *
 * Funções puras sobre as sessões persistidas. A regra central é que apenas
 * sessões `completed` entram no calendário e nos indicadores — sessões ativas,
 * pausadas ou abandonadas nunca são contabilizadas.
 *
 * Todas as datas são resolvidas no **fuso local** do dispositivo. Os timestamps
 * da sessão são ISO (UTC), mas o dia de calendário é sempre o dia local em que o
 * treino foi concluído — evitar `toISOString()` aqui é essencial para que um
 * treino às 23h50 não "salte" para o dia seguinte.
 */

export interface CalendarMonth {
  year: number
  /** Mês 0-based, como em `Date#getMonth`. */
  month: number
}

export interface CalendarCell {
  /** Data local no formato `YYYY-MM-DD`. */
  dateKey: string
  day: number
  isToday: boolean
}

export type CalendarGridCell = CalendarCell | null

export interface HistoryIndicators {
  totalWorkouts: number
  currentStreak: number
  monthWorkouts: number
}

/** Semana começando na segunda-feira — padrão do aplicativo. */
export const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Converte um instante (Date/ISO/epoch ms) na data local `YYYY-MM-DD`.
 *
 * Não use strings de data pura (`2026-01-07`) aqui: o construtor `Date` as
 * interpreta como UTC. Para chaves de data já normalizadas, use `parseDateKey`.
 */
export function toLocalDateKey(value: Date | string | number): string | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Interpreta `YYYY-MM-DD` como meia-noite local. Retorna `null` se inválida. */
export function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)

  // Rejeita datas inexistentes (ex.: 2026-02-31 viraria março).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function monthOf(value: Date | string | number): CalendarMonth {
  const date = value instanceof Date ? value : new Date(value)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/** Avança/retrocede meses, atravessando a virada de ano. */
export function addMonths(month: CalendarMonth, delta: number): CalendarMonth {
  const date = new Date(month.year, month.month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function isDayInMonth(dateKey: string, month: CalendarMonth): boolean {
  return dateKey.startsWith(`${month.year}-${pad2(month.month + 1)}`)
}

export function monthLabel(month: CalendarMonth): string {
  const label = new Date(month.year, month.month, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function dayLabel(dateKey: string): string {
  const date = parseDateKey(dateKey)
  if (!date) return dateKey
  const label = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Monta a grade do mês respeitando a semana que começa na segunda-feira.
 *
 * As posições vazias antes do dia 1 e depois do último dia são `null`, o que
 * mantém as colunas alinhadas no layout.
 */
export function buildMonthGrid(
  month: CalendarMonth,
  todayKey: string = toLocalDateKey(new Date()) ?? '',
): CalendarGridCell[] {
  const firstDay = new Date(month.year, month.month, 1)
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
  const leading = (firstDay.getDay() + 6) % 7

  const cells: CalendarGridCell[] = Array.from({ length: leading }, () => null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${month.year}-${pad2(month.month + 1)}-${pad2(day)}`
    cells.push({ dateKey, day, isToday: dateKey === todayKey })
  }

  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

/**
 * Dia de calendário de uma sessão concluída (hora local de conclusão).
 *
 * `finishedAt` é o critério oficial de conclusão. O fallback para `startedAt`
 * mantém compatibilidade com registros antigos que não tenham `finishedAt`.
 */
export function sessionDateKey(session: WorkoutSession): string | null {
  if (session.status !== 'completed') return null
  return toLocalDateKey(session.finishedAt ?? session.startedAt)
}

function byStartedAtAsc(a: WorkoutSession, b: WorkoutSession): number {
  return (Date.parse(a.startedAt) || 0) - (Date.parse(b.startedAt) || 0)
}

/** Agrupa as sessões concluídas por dia local (ordem cronológica no dia). */
export function groupSessionsByDate(
  sessions: WorkoutSession[],
): Map<string, WorkoutSession[]> {
  const grouped = new Map<string, WorkoutSession[]>()

  for (const session of sessions) {
    const dateKey = sessionDateKey(session)
    if (!dateKey) continue
    const list = grouped.get(dateKey)
    if (list) {
      list.push(session)
    } else {
      grouped.set(dateKey, [session])
    }
  }

  for (const list of grouped.values()) list.sort(byStartedAtAsc)

  return grouped
}

export function countSessionsInMonth(
  sessions: WorkoutSession[],
  month: CalendarMonth,
): number {
  return sessions.reduce((total, session) => {
    const dateKey = sessionDateKey(session)
    return dateKey && isDayInMonth(dateKey, month) ? total + 1 : total
  }, 0)
}

/** Dia mais recente com treino concluído dentro do mês, ou `null`. */
export function latestSessionDayInMonth(
  sessionsByDate: Map<string, WorkoutSession[]>,
  month: CalendarMonth,
): string | null {
  let latest: string | null = null
  for (const dateKey of sessionsByDate.keys()) {
    if (!isDayInMonth(dateKey, month)) continue
    if (latest === null || dateKey > latest) latest = dateKey
  }
  return latest
}

/**
 * Sequência atual de dias consecutivos com pelo menos um treino concluído.
 *
 * Regras:
 * - dias locais, não instantes;
 * - mais de uma sessão no mesmo dia conta como um único dia;
 * - dias futuros são ignorados;
 * - um dia sem treino interrompe a contagem;
 * - se o usuário ainda não treinou hoje, a sequência continua valendo até
 *   ontem (treinar ontem mantém a sequência viva até o fim do dia de hoje).
 */
export function computeCurrentStreak(
  sessions: WorkoutSession[],
  todayKey: string,
): number {
  const start = parseDateKey(todayKey)
  if (!start) return 0

  const activeDays = new Set<string>()
  for (const session of sessions) {
    const dateKey = sessionDateKey(session)
    if (dateKey && dateKey <= todayKey) activeDays.add(dateKey)
  }

  if (activeDays.size === 0) return 0

  let cursor = start
  if (!activeDays.has(todayKey)) {
    cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1)
    const yesterdayKey = toLocalDateKey(cursor)
    if (!yesterdayKey || !activeDays.has(yesterdayKey)) return 0
  }

  let streak = 0
  while (true) {
    const dateKey = toLocalDateKey(cursor)
    if (!dateKey || !activeDays.has(dateKey)) break
    streak += 1
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
  }

  return streak
}

export function buildHistoryIndicators(
  sessions: WorkoutSession[],
  month: CalendarMonth,
  todayKey: string,
): HistoryIndicators {
  return {
    totalWorkouts: sessions.filter((session) => session.status === 'completed').length,
    currentStreak: computeCurrentStreak(sessions, todayKey),
    monthWorkouts: countSessionsInMonth(sessions, month),
  }
}
