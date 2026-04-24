/**
 * Deduction `type` values vary in the DB ("Pag-ibig", "pag ibig", "PAG-IBIG", etc.).
 * Collapse separators so substring checks like `includes("pagibig")` work.
 */
export function normalizeDeductionType(type: string): string {
  return (type || "").toLowerCase().replace(/[\s\-_\.]+/g, "")
}

export function isSssDeductionType(type: string): boolean {
  const n = normalizeDeductionType(type)
  return n.includes("sss")
}

export function isPhilHealthDeductionType(type: string): boolean {
  return normalizeDeductionType(type).includes("philhealth")
}

export function isPagibigDeductionType(type: string): boolean {
  const n = normalizeDeductionType(type)
  return n.includes("pagibig") || n.includes("hdmf")
}

/** Government / mandatory buckets — anything else can roll into “other” / loans depending on caller. */
export function isMandatoryContributionType(type: string): boolean {
  return (
    isSssDeductionType(type) ||
    isPhilHealthDeductionType(type) ||
    isPagibigDeductionType(type)
  )
}
