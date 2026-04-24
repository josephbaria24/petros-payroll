/** Convert pay amount to approximate monthly equivalent (for pay-type switches). */
export function toMonthlyEquivalent(
  amount: number,
  payType: string,
  workDaysPerWeek: number
): number {
  const pt = (payType || "monthly").toLowerCase()
  const a = Number(amount) || 0
  if (a <= 0) return 0
  const d = Math.max(1, workDaysPerWeek)
  switch (pt) {
    case "monthly":
      return a
    case "semi-monthly":
      return a * 2
    case "weekly":
      return a * 4
    case "daily":
      return a * 4 * d
    case "hourly":
      return a * 8 * d * 4
    default:
      return a
  }
}

/** Convert monthly equivalent back to the amount for a given pay type. */
export function fromMonthlyEquivalent(
  monthly: number,
  payType: string,
  workDaysPerWeek: number
): number {
  const pt = (payType || "monthly").toLowerCase()
  const m = Number(monthly) || 0
  if (m <= 0) return 0
  const d = Math.max(1, workDaysPerWeek)
  switch (pt) {
    case "monthly":
      return m
    case "semi-monthly":
      return m / 2
    case "weekly":
      return m / 4
    case "daily":
      return m / (4 * d)
    case "hourly":
      return m / (4 * d * 8)
    default:
      return m
  }
}

export function baseSalaryFieldLabel(payType: string): string {
  switch ((payType || "monthly").toLowerCase()) {
    case "semi-monthly":
      return "Base salary (per cutoff / 15 days)"
    case "weekly":
      return "Base salary (per week)"
    case "daily":
      return "Base salary (per day)"
    case "hourly":
      return "Base rate (per hour)"
    default:
      return "Base salary (per month)"
  }
}
