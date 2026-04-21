import { addDays, format, startOfDay } from "date-fns"

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export function isWeekendDate(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/** Count Mon–Fri dates in [inclusiveStart, inclusiveEnd] that are not in holidaySet (yyyy-MM-dd). */
export function countBusinessDaysExcludingHolidays(
  inclusiveStart: Date,
  inclusiveEnd: Date,
  holidaySet: Set<string>
): number {
  let n = 0
  let cur = startOfDay(inclusiveStart)
  const end = startOfDay(inclusiveEnd)
  while (cur <= end) {
    const ymd = toYmd(cur)
    if (!isWeekendDate(cur) && !holidaySet.has(ymd)) n++
    cur = addDays(cur, 1)
  }
  return n
}

/** Intersect [periodStart, periodEnd] with calendar month day ranges 1–15 and 16–last. */
export function workingDaysPerSemiMonthlyCutoff(
  periodStart: Date,
  periodEnd: Date,
  holidaySet: Set<string>
): { firstCutoff: number; secondCutoff: number } {
  let first = 0
  let second = 0
  let cur = startOfDay(periodStart)
  const end = startOfDay(periodEnd)
  while (cur <= end) {
    const ymd = toYmd(cur)
    const dom = cur.getDate()
    if (!isWeekendDate(cur) && !holidaySet.has(ymd)) {
      if (dom <= 15) first++
      else second++
    }
    cur = addDays(cur, 1)
  }
  return { firstCutoff: first, secondCutoff: second }
}

/** Business days in the full calendar month of `anchor` (used for “per month” column). */
export function workingDaysInCalendarMonth(
  anchor: Date,
  holidaySet: Set<string>
): number {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  return countBusinessDaysExcludingHolidays(start, end, holidaySet)
}

/** Dates in yyyy-MM-dd from textarea: one per line or comma-separated. */
export function parseExtraHolidayInput(raw: string): string[] {
  if (!raw.trim()) return []
  const parts = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
  const valid: string[] = []
  for (const p of parts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) valid.push(p)
  }
  return valid
}
