import {
  eachDayOfInterval,
  endOfMonth,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from "date-fns"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function dayLabel(d: Date): string {
  return WEEKDAY_LABELS[d.getDay()]
}

function defaultWorkingDays(): string[] {
  return ["Mon", "Tue", "Wed", "Thu", "Fri"]
}

function normalizeWorkingDays(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.length > 0) return raw as string[]
  return defaultWorkingDays()
}

/** Scheduled working days (per employee week pattern) between dates, inclusive. */
export function countScheduledWorkingDaysInRange(
  periodStart: Date,
  periodEnd: Date,
  workingDays: unknown
): number {
  const set = new Set(normalizeWorkingDays(workingDays))
  const start = startOfDay(periodStart)
  const end = startOfDay(periodEnd)
  return eachDayOfInterval({ start, end }).filter((d) => set.has(dayLabel(d))).length
}

export function countScheduledWorkingDaysInCalendarMonth(
  year: number,
  monthIndex: number,
  workingDays: unknown
): number {
  const start = startOfMonth(new Date(year, monthIndex))
  const end = endOfMonth(new Date(year, monthIndex))
  return countScheduledWorkingDaysInRange(start, end, workingDays)
}

/** Daily rate for monthly / semi-monthly when `daily_rate` is unset. */
export function deriveDailyRateForEmployee(emp: {
  base_salary?: number | null
  daily_rate?: number | null
  pay_type?: string | null
  working_days?: unknown
}): number {
  const stored = Number(emp.daily_rate)
  if (stored > 0) return stored
  const base = Number(emp.base_salary) || 0
  const wd = normalizeWorkingDays(emp.working_days)
  const daysPerWeek = wd.length
  const monthlySalary = emp.pay_type === "semi-monthly" ? base * 2 : base
  return (monthlySalary * 12) / (52 * Math.max(1, daysPerWeek))
}

export type ProratedPayrollSlice = {
  basicSalary: number
  allowance: number
  scheduledDaysInPeriod: number
}

/**
 * Basic salary and allowance for an arbitrary [periodStart, periodEnd] slice,
 * using pay_type, working_days, base_salary / daily_rate (same conventions as the employee form).
 */
export function computeProratedBasicAndAllowance(
  emp: {
    base_salary?: number | null
    daily_rate?: number | null
    pay_type?: string | null
    working_days?: unknown
    allowance?: number | null
  },
  periodStart: Date,
  periodEnd: Date
): ProratedPayrollSlice {
  const scheduledDaysInPeriod = countScheduledWorkingDaysInRange(
    periodStart,
    periodEnd,
    emp.working_days
  )
  const payType = (emp.pay_type || "monthly").toLowerCase()
  let basicSalary = 0

  if (payType === "daily") {
    const daily = Number(emp.base_salary) || 0
    basicSalary = daily * scheduledDaysInPeriod
  } else if (payType === "hourly") {
    const hourly = Number(emp.base_salary) || 0
    basicSalary = hourly * 8 * scheduledDaysInPeriod
  } else {
    const dailyRate = deriveDailyRateForEmployee(emp)
    basicSalary = dailyRate * scheduledDaysInPeriod
  }

  const allowanceMonthly = Number(emp.allowance) || 0
  let allowance = 0
  if (allowanceMonthly > 0 && scheduledDaysInPeriod > 0) {
    if (isSameMonth(periodStart, periodEnd)) {
      const y = periodEnd.getFullYear()
      const m = periodEnd.getMonth()
      const monthDays = countScheduledWorkingDaysInCalendarMonth(y, m, emp.working_days)
      allowance = allowanceMonthly * (scheduledDaysInPeriod / Math.max(1, monthDays))
    } else {
      allowance = allowanceMonthly * (scheduledDaysInPeriod / 22)
    }
  }

  return {
    basicSalary: Math.round(basicSalary * 100) / 100,
    allowance: Math.round(allowance * 100) / 100,
    scheduledDaysInPeriod,
  }
}
