/** Philippine peso amounts using the word "Peso" (not the ₱ glyph). */

export function formatPesoMoney(amount: number): string {
  return `Peso ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPeso(amount: number): string {
  return `Peso ${amount.toLocaleString("en-PH")}`
}
