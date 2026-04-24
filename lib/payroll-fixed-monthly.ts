import { endOfMonth, isSameDay, startOfDay, startOfMonth } from "date-fns"

/**
 * Declared monthly salary splits — not calendar-prorated by day count.
 * `weekly_fraction` is one of four equal monthly portions (¼ salary); not ISO/calendar "weekly" pay.
 */
export type FixedPayrollSlot = "full_month" | "first_half" | "second_half" | "weekly_fraction"

export type FixedWeekPart = 1 | 2 | 3 | 4

/** Calendar period for attendance / DB, aligned to pay slot. */
export function getFixedSplitPeriod(
  year: number,
  monthIndex: number,
  slot: FixedPayrollSlot,
  weekPart: FixedWeekPart = 1
): { start: Date; end: Date } {
  const startM = startOfMonth(new Date(year, monthIndex))
  const endM = endOfMonth(new Date(year, monthIndex))
  if (slot === "full_month") {
    return { start: startOfDay(startM), end: startOfDay(endM) }
  }
  if (slot === "first_half") {
    return { start: startOfDay(startM), end: startOfDay(new Date(year, monthIndex, 15)) }
  }
  if (slot === "second_half") {
    return { start: startOfDay(new Date(year, monthIndex, 16)), end: startOfDay(endM) }
  }
  const starts = [1, 8, 15, 22] as const
  const i = Math.min(3, Math.max(0, weekPart - 1))
  const s = new Date(year, monthIndex, starts[i])
  const endDay = i === 3 ? endM.getDate() : starts[i + 1] - 1
  const e = new Date(year, monthIndex, endDay)
  return { start: startOfDay(s), end: startOfDay(e) }
}

/**
 * If the selected period exactly matches a canonical full/half/¼-month window in one calendar month,
 * returns that slot so salary can use ×1 / ×½ / ×¼ of monthly equivalent (not day-count proration).
 */
export function findFixedSlotMatchingPeriod(
  periodStart: Date,
  periodEnd: Date
): { slot: FixedPayrollSlot; weekPart: FixedWeekPart } | null {
  const ps = startOfDay(periodStart)
  const pe = startOfDay(periodEnd)
  if (ps.getFullYear() !== pe.getFullYear() || ps.getMonth() !== pe.getMonth()) return null
  const y = ps.getFullYear()
  const m = ps.getMonth()
  const candidates: { slot: FixedPayrollSlot; weekPart: FixedWeekPart }[] = [
    { slot: "full_month", weekPart: 1 },
    { slot: "first_half", weekPart: 1 },
    { slot: "second_half", weekPart: 1 },
    { slot: "weekly_fraction", weekPart: 1 },
    { slot: "weekly_fraction", weekPart: 2 },
    { slot: "weekly_fraction", weekPart: 3 },
    { slot: "weekly_fraction", weekPart: 4 },
  ]
  for (const { slot, weekPart } of candidates) {
    const { start, end } = getFixedSplitPeriod(y, m, slot, weekPart)
    if (isSameDay(ps, start) && isSameDay(pe, end)) return { slot, weekPart }
  }
  return null
}

/** Pay factor on declared monthly base (and monthly allowance): 1, ½, or ¼. */
export function getFixedMonthlyPayFactor(slot: FixedPayrollSlot): number {
  if (slot === "full_month") return 1
  if (slot === "first_half" || slot === "second_half") return 0.5
  return 0.25
}

/** @param fullMonthAllowance — full calendar month allowance (employee field is half-month; double before calling). */
export function computeFixedSplitBasicAndAllowance(
  monthlyBase: number,
  fullMonthAllowance: number,
  slot: FixedPayrollSlot
): { basicSalary: number; allowance: number } {
  const f = getFixedMonthlyPayFactor(slot)
  return {
    basicSalary: Math.round(monthlyBase * f * 100) / 100,
    allowance: Math.round((fullMonthAllowance || 0) * f * 100) / 100,
  }
}
