/** HH:MM from ISO timestamp (Philippine wall clock, same as payroll/generate). */
export function extractPhilippineTime(timestamp: string): string {
  if (!timestamp || !timestamp.includes("T")) return ""
  return timestamp.split("T")[1].substring(0, 5)
}

export function parseTimeToMinutes(hhmm: string | null): number | null {
  if (!hhmm || hhmm === "-" || hhmm === "") return null
  const parts = hhmm.split(":")
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1].substring(0, 2), 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/** Minutes between two same-day HH:MM strings; null if invalid. */
export function minutesBetweenInOut(timeIn: string | null, timeOut: string | null): number | null {
  const a = parseTimeToMinutes(timeIn)
  const b = parseTimeToMinutes(timeOut)
  if (a === null || b === null || b <= a) return null
  return b - a
}
