/** Philippine peso amounts with the ₱ sign. */

export function formatPesoMoney(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`
}
