import { describe, expect, it } from 'vitest'
import type { WorkoutSession } from './domain/types'
import {
  addMonths,
  buildHistoryIndicators,
  buildMonthGrid,
  computeCurrentStreak,
  countSessionsInMonth,
  dayLabel,
  groupSessionsByDate,
  isDayInMonth,
  latestSessionDayInMonth,
  monthLabel,
  monthOf,
  parseDateKey,
  sessionDateKey,
  toLocalDateKey,
} from './historyCalendar'

/** Instante local — independe do fuso da máquina de teste. */
function localDate(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function iso(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return localDate(year, month, day, hour, minute).toISOString()
}

function makeSession(
  overrides: Partial<WorkoutSession> & Pick<WorkoutSession, 'id'>,
): WorkoutSession {
  return {
    workoutId: 'A',
    workoutName: 'Corpo inteiro',
    status: 'completed',
    startedAt: iso(2026, 1, 7, 11),
    pausedAt: null,
    finishedAt: iso(2026, 1, 7, 11, 20),
    currentExerciseIndex: 0,
    currentSet: 1,
    currentPhase: 'completed',
    remainingTime: 0,
    phaseStartedAt: null,
    phaseEndsAt: null,
    totalPausedMs: 0,
    completedSets: 3,
    exercisesProgress: [],
    duration: 1200,
    ...overrides,
  }
}

describe('toLocalDateKey / parseDateKey', () => {
  it('preserva o dia local mesmo perto da meia-noite', () => {
    const lateNight = localDate(2026, 1, 7, 23, 50)
    const afterMidnight = localDate(2026, 1, 8, 0, 10)

    expect(toLocalDateKey(lateNight)).toBe('2026-01-07')
    expect(toLocalDateKey(lateNight.toISOString())).toBe('2026-01-07')
    expect(toLocalDateKey(afterMidnight)).toBe('2026-01-08')
    expect(toLocalDateKey(afterMidnight.toISOString())).toBe('2026-01-08')
  })

  it('devolve null para instantes inválidos', () => {
    expect(toLocalDateKey('não é uma data')).toBeNull()
  })

  it('interpreta a chave como meia-noite local', () => {
    const date = parseDateKey('2026-01-07')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(0)
    expect(date?.getDate()).toBe(7)
    expect(date?.getHours()).toBe(0)
  })

  it('rejeita datas inexistentes e formatos inválidos', () => {
    expect(parseDateKey('2024-02-29')).not.toBeNull()
    expect(parseDateKey('2026-02-29')).toBeNull()
    expect(parseDateKey('2026-13-01')).toBeNull()
    expect(parseDateKey('2026-1-7')).toBeNull()
    expect(parseDateKey('qualquer')).toBeNull()
  })
})

describe('monthOf / addMonths / isDayInMonth', () => {
  it('identifica o mês local do instante', () => {
    expect(monthOf(localDate(2025, 12, 15, 23, 59))).toEqual({ year: 2025, month: 11 })
  })

  it('navega entre meses incluindo a virada de ano', () => {
    expect(addMonths({ year: 2025, month: 11 }, 1)).toEqual({ year: 2026, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(addMonths({ year: 2026, month: 0 }, 12)).toEqual({ year: 2027, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -13)).toEqual({ year: 2024, month: 11 })
  })

  it('verifica se a data pertence ao mês', () => {
    expect(isDayInMonth('2026-01-31', { year: 2026, month: 0 })).toBe(true)
    expect(isDayInMonth('2026-02-01', { year: 2026, month: 0 })).toBe(false)
  })
})

describe('buildMonthGrid', () => {
  it('respeita fevereiro de ano bissexto e a semana começando na segunda', () => {
    const cells = buildMonthGrid({ year: 2024, month: 1 }, '2024-02-10')
    const dayCells = cells.filter((cell) => cell !== null)

    expect(cells.length % 7).toBe(0)
    expect(dayCells).toHaveLength(29)
    // 1º de fevereiro de 2024 é quinta-feira → 3 posições vazias (seg, ter, qua).
    expect(cells[0]).toBeNull()
    expect(cells[3]?.dateKey).toBe('2024-02-01')
    expect(dayCells[28]?.day).toBe(29)
  })

  it('respeita fevereiro de ano comum', () => {
    const cells = buildMonthGrid({ year: 2026, month: 1 }, '2026-02-10')
    const dayCells = cells.filter((cell) => cell !== null)

    expect(dayCells).toHaveLength(28)
    // 1º de fevereiro de 2026 é domingo → 6 posições vazias.
    expect(cells[6]?.dateKey).toBe('2026-02-01')
    expect(dayCells[27]?.day).toBe(28)
  })

  it('marca somente o dia atual e mantém a grade alinhada', () => {
    const cells = buildMonthGrid({ year: 2026, month: 0 }, '2026-01-07')
    const todayCells = cells.filter((cell) => cell?.isToday)

    expect(cells.length % 7).toBe(0)
    expect(todayCells).toHaveLength(1)
    expect(todayCells[0]?.dateKey).toBe('2026-01-07')
  })

  it('atravessa a virada de ano ao montar dezembro e janeiro', () => {
    const december = buildMonthGrid({ year: 2026, month: 11 }, '2026-12-01')
    const january = buildMonthGrid({ year: 2027, month: 0 }, '2026-12-01')

    expect(december.filter(Boolean)).toHaveLength(31)
    expect(january.filter(Boolean)).toHaveLength(31)
    expect(december.find((cell) => cell?.day === 31)?.dateKey).toBe('2026-12-31')
    expect(january.find((cell) => cell?.day === 1)?.dateKey).toBe('2027-01-01')
  })
})

describe('sessionDateKey', () => {
  it('usa o dia local de conclusão', () => {
    const session = makeSession({
      id: 's',
      startedAt: iso(2026, 1, 7, 23, 30),
      finishedAt: iso(2026, 1, 8, 0, 5),
    })
    expect(sessionDateKey(session)).toBe('2026-01-08')
  })

  it('mantém o treino no mesmo dia quando termina antes da meia-noite', () => {
    const session = makeSession({
      id: 's',
      startedAt: iso(2026, 1, 7, 23, 20),
      finishedAt: iso(2026, 1, 7, 23, 55),
    })
    expect(sessionDateKey(session)).toBe('2026-01-07')
  })

  it('ignora sessões não concluídas', () => {
    for (const status of ['active', 'paused', 'abandoned'] as const) {
      expect(sessionDateKey(makeSession({ id: status, status }))).toBeNull()
    }
  })

  it('é compatível com registros antigos sem finishedAt', () => {
    const session = makeSession({
      id: 'legacy',
      finishedAt: null,
      startedAt: iso(2026, 1, 7, 9, 0),
    })
    expect(sessionDateKey(session)).toBe('2026-01-07')
  })
})

describe('groupSessionsByDate', () => {
  it('agrupa múltiplas sessões no mesmo dia em ordem cronológica', () => {
    const grouped = groupSessionsByDate([
      makeSession({ id: 'evening', startedAt: iso(2026, 1, 7, 18), finishedAt: iso(2026, 1, 7, 18, 20) }),
      makeSession({ id: 'morning', startedAt: iso(2026, 1, 7, 7), finishedAt: iso(2026, 1, 7, 7, 20) }),
      makeSession({ id: 'other-day', startedAt: iso(2026, 1, 8, 7), finishedAt: iso(2026, 1, 8, 7, 20) }),
    ])

    expect(grouped.get('2026-01-07')?.map((session) => session.id)).toEqual([
      'morning',
      'evening',
    ])
    expect(grouped.get('2026-01-08')).toHaveLength(1)
  })

  it('não agrupa sessões canceladas ou apenas iniciadas', () => {
    const grouped = groupSessionsByDate([
      makeSession({ id: 'active', status: 'active', finishedAt: null }),
      makeSession({ id: 'paused', status: 'paused', finishedAt: null }),
      makeSession({ id: 'abandoned', status: 'abandoned' }),
      makeSession({ id: 'done' }),
    ])

    expect([...grouped.keys()]).toEqual(['2026-01-07'])
    expect(grouped.get('2026-01-07')?.map((session) => session.id)).toEqual(['done'])
  })
})

describe('countSessionsInMonth / latestSessionDayInMonth', () => {
  it('conta apenas sessões concluídas do mês e do ano corretos', () => {
    const sessions = [
      makeSession({ id: 'jan-1', finishedAt: iso(2026, 1, 1) }),
      makeSession({ id: 'jan-31', finishedAt: iso(2026, 1, 31, 23, 59) }),
      makeSession({ id: 'feb-1', finishedAt: iso(2026, 2, 1, 0, 5) }),
      makeSession({ id: 'dec', finishedAt: iso(2025, 12, 31) }),
      makeSession({ id: 'active', status: 'active', finishedAt: null }),
    ]

    expect(countSessionsInMonth(sessions, { year: 2026, month: 0 })).toBe(2)
    expect(countSessionsInMonth(sessions, { year: 2026, month: 1 })).toBe(1)
    expect(countSessionsInMonth(sessions, { year: 2025, month: 11 })).toBe(1)
    expect(countSessionsInMonth(sessions, { year: 2027, month: 0 })).toBe(0)
  })

  it('encontra o dia mais recente com treino no mês', () => {
    const grouped = groupSessionsByDate([
      makeSession({ id: 'a', finishedAt: iso(2026, 1, 3) }),
      makeSession({ id: 'b', finishedAt: iso(2026, 1, 20) }),
      makeSession({ id: 'c', finishedAt: iso(2026, 2, 2) }),
    ])

    expect(latestSessionDayInMonth(grouped, { year: 2026, month: 0 })).toBe('2026-01-20')
    expect(latestSessionDayInMonth(grouped, { year: 2026, month: 1 })).toBe('2026-02-02')
    expect(latestSessionDayInMonth(grouped, { year: 2026, month: 2 })).toBeNull()
  })
})

describe('computeCurrentStreak', () => {
  function sessionOn(year: number, month: number, day: number, id = `${year}-${month}-${day}`) {
    return makeSession({
      id,
      startedAt: iso(year, month, day, 10),
      finishedAt: iso(year, month, day, 10, 30),
    })
  }

  it('zera sem treinos', () => {
    expect(computeCurrentStreak([], '2026-01-07')).toBe(0)
  })

  it('conta o dia de hoje', () => {
    expect(computeCurrentStreak([sessionOn(2026, 1, 7)], '2026-01-07')).toBe(1)
  })

  it('conta dias consecutivos até hoje', () => {
    const sessions = [
      sessionOn(2026, 1, 7),
      sessionOn(2026, 1, 6),
      sessionOn(2026, 1, 5),
    ]
    expect(computeCurrentStreak(sessions, '2026-01-07')).toBe(3)
  })

  it('mantém a sequência quando o usuário ainda não treinou hoje', () => {
    const sessions = [sessionOn(2026, 1, 6), sessionOn(2026, 1, 5)]
    expect(computeCurrentStreak(sessions, '2026-01-07')).toBe(2)
  })

  it('zera quando o último treino foi antes de ontem', () => {
    expect(computeCurrentStreak([sessionOn(2026, 1, 5)], '2026-01-07')).toBe(0)
  })

  it('interrompe a sequência em um dia sem treino', () => {
    const sessions = [
      sessionOn(2026, 1, 7),
      sessionOn(2026, 1, 6),
      sessionOn(2026, 1, 4),
    ]
    expect(computeCurrentStreak(sessions, '2026-01-07')).toBe(2)
  })

  it('não conta duas sessões no mesmo dia duas vezes', () => {
    const sessions = [
      sessionOn(2026, 1, 7, 'a'),
      sessionOn(2026, 1, 7, 'b'),
      sessionOn(2026, 1, 6),
    ]
    expect(computeCurrentStreak(sessions, '2026-01-07')).toBe(2)
  })

  it('ignora dias futuros', () => {
    const sessions = [sessionOn(2026, 1, 8), sessionOn(2026, 1, 7)]
    expect(computeCurrentStreak(sessions, '2026-01-07')).toBe(1)
  })

  it('atravessa a virada de ano', () => {
    const sessions = [sessionOn(2025, 12, 31), sessionOn(2026, 1, 1)]
    expect(computeCurrentStreak(sessions, '2026-01-01')).toBe(2)
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    const sessions = [
      sessionOn(2024, 3, 1),
      sessionOn(2024, 2, 29),
      sessionOn(2024, 2, 28),
    ]
    expect(computeCurrentStreak(sessions, '2024-03-01')).toBe(3)
  })
})

describe('buildHistoryIndicators', () => {
  it('combina total, sequência e mês sem contar sessões incompletas', () => {
    const sessions = [
      makeSession({ id: 'jan-7', finishedAt: iso(2026, 1, 7, 9) }),
      makeSession({ id: 'jan-6', finishedAt: iso(2026, 1, 6, 9) }),
      makeSession({ id: 'feb-1', finishedAt: iso(2026, 2, 1, 9) }),
      makeSession({ id: 'abandoned', status: 'abandoned' }),
      makeSession({ id: 'active', status: 'active', finishedAt: null }),
    ]

    expect(buildHistoryIndicators(sessions, { year: 2026, month: 0 }, '2026-01-07')).toEqual({
      totalWorkouts: 3,
      currentStreak: 2,
      monthWorkouts: 2,
    })
  })
})

describe('monthLabel / dayLabel', () => {
  it('formata mês e dia com o ano', () => {
    const month = monthLabel({ year: 2026, month: 0 })
    const day = dayLabel('2026-01-07')

    expect(month).toMatch(/2026/)
    expect(month[0]).toBe(month[0].toUpperCase())
    expect(day).toMatch(/2026/)
    expect(day[0]).toBe(day[0].toUpperCase())
  })
})
