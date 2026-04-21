import type { OrganizationKey } from "./types"

/** jsPDF setFillColor / setTextColor use 0–255 RGB */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim()
  if (h.length !== 6) return [0, 0, 0]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export type PdfBrandTheme = {
  id: "petrosphere" | "pdn"
  /** Main header / table head */
  primary: string
  /** Highlights, KPI numbers, accents */
  accent: string
  /** Page background feel (cards on white) */
  surface: string
  /** Body text on white */
  text: string
  /** Secondary labels */
  muted: string
  /** Card border */
  border: string
}

export const PETROSPHERE_PDF_THEME: PdfBrandTheme = {
  id: "petrosphere",
  primary: "#00044a",
  accent: "#ffb800",
  surface: "#ffffff",
  text: "#00044a",
  muted: "#64748b",
  border: "#e2e8f0",
}

export const PDN_PDF_THEME: PdfBrandTheme = {
  id: "pdn",
  primary: "#0f1c43",
  accent: "#f15822",
  surface: "#ffffff",
  text: "#0f1c43",
  muted: "#64748b",
  border: "#e2e8f0",
}

export function getPdfBrandTheme(organization: OrganizationKey): PdfBrandTheme {
  return organization === "pdn" ? PDN_PDF_THEME : PETROSPHERE_PDF_THEME
}

/** Canvas / chart colors */
export type ChartVisualTheme = {
  titleColor: string
  labelColor: string
  valueColor: string
  /** Brand accent (e.g. yellow or orange) for alternate single-series bars */
  accentBar: string
  barPrimary: string
  barSecondary: string
  donut: [string, string, string, string]
}

export function getChartVisualTheme(organization: OrganizationKey): ChartVisualTheme {
  if (organization === "pdn") {
    return {
      titleColor: "#0f1c43",
      labelColor: "#475569",
      valueColor: "#64748b",
      accentBar: "#f15822",
      barPrimary: "#f15822",
      barSecondary: "#0f1c43",
      donut: ["#0f1c43", "#f15822", "#94a3b8", "#cbd5e1"],
    }
  }
  return {
    titleColor: "#00044a",
    labelColor: "#475569",
    valueColor: "#64748b",
    accentBar: "#ffb800",
    barPrimary: "#ffb800",
    barSecondary: "#00044a",
    donut: ["#00044a", "#ffb800", "#4a5fc1", "#94a3b8"],
  }
}
