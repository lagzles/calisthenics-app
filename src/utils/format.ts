/**
 * Formatação de valores para exibição (pt-BR).
 */

export function formatMinutes(minutes: number): string {
  return `${minutes} min`
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes} min` : `${minutes}min ${seconds}s`
}

export function formatRelativeDays(daysAgo: number): string {
  if (daysAgo <= 0) return 'hoje'
  if (daysAgo === 1) return 'ontem'
  return `há ${daysAgo} dias`
}

/** Duração aproximada para indicadores (ex.: 1440s → "24 min"). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  if (safe < 60) return `${safe}s`
  return `${Math.round(safe / 60)} min`
}

/** Data e hora locais a partir de uma string ISO (ex.: "05/11/2026 · 18:32"). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.toLocaleDateString('pt-BR')
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}
