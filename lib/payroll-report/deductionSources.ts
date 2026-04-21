/**
 * Classify free-text deduction labels (deductions.type or deduction_types.name).
 * Itemized types are already represented on payroll_records columns; the rest are "misc / other".
 */
export function isItemizedPayrollDeductionLabel(label: string | null | undefined): boolean {
  const t = (label || "").trim().toLowerCase()
  if (!t) return false
  return (
    /\b(sss|sss|philhealth|phil)\b/.test(t) ||
    /\b(pag-?ibig|hdmf)\b/.test(t) ||
    /withholding|w\.?\s*tax|wtax/.test(t) ||
    /\bloan(s)?\b/.test(t) ||
    /\buniform\b/.test(t) ||
    /tardiness|tardy|late(\s*d(eduction)?)?/.test(t) ||
    /absence|absent/.test(t) ||
    /cash\s*adv(ance)?/.test(t)
  )
}
