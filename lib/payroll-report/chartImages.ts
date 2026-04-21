/** Browser-only: draw charts to PNG for jsPDF. Reference-inspired layouts: vertical bars, legend-left donut/rings, clustered columns. */

import type { ChartVisualTheme } from "./pdfThemes"

const EXPORT_SCALE = 2.75

export type ChartImage = {
  png: string
  w: number
  h: number
}

function createHiResCanvas(logicalW: number, logicalH: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement("canvas")
  const bw = Math.round(logicalW * EXPORT_SCALE)
  const bh = Math.round(logicalH * EXPORT_SCALE)
  canvas.width = bw
  canvas.height = bh
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) throw new Error("Canvas unsupported")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, logicalW, logicalH)
  return { canvas, ctx }
}

function truncateLabel(s: string, maxChars: number): string {
  const t = s.trim()
  if (t.length <= maxChars) return t
  return t.slice(0, Math.max(1, maxChars - 1)) + "…"
}

/** First + last name initials (e.g. Joseph Baria → JB). Single token uses first two letters. */
export function nameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
  if (parts.length === 0) return "?"
  const pick = (s: string) => {
    const c = s.match(/[A-Za-z0-9]/)
    return c ? c[0] : ""
  }
  if (parts.length === 1) {
    const w = parts[0].replace(/[^A-Za-z0-9]/g, "")
    if (w.length >= 2) return w.slice(0, 2).toUpperCase()
    return w.charAt(0).toUpperCase() || "?"
  }
  const a = pick(parts[0])
  const b = pick(parts[parts.length - 1])
  return `${a}${b}`.toUpperCase() || "?"
}

function fmtBarVal(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-PH", { maximumFractionDigits: 0 })
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}

/** Short label for point markers on line/area charts */
function fmtPointVal(v: number): string {
  const a = Math.abs(v)
  if (a >= 10000) return v.toLocaleString("en-PH", { maximumFractionDigits: 0 })
  if (a >= 1000) return v.toLocaleString("en-PH", { maximumFractionDigits: 1 })
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}

/** Vertical columns: muted bars, strongest bar highlighted; value band + label (reference “Pages visited” style). */
export function verticalBarChartPng(
  title: string,
  labels: string[],
  values: number[],
  opts?: {
    barColor?: string
    maxBars?: number
    labelMaxChars?: number
    theme?: ChartVisualTheme
  }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#64748b"
  const accent = opts?.barColor ?? theme?.barPrimary ?? "#2563eb"
  const barTrack = theme?.barSecondary ?? "#1d4ed8"
  const axisC = "#cbd5e1"

  const maxBars = opts?.maxBars ?? 14
  const labelMaxChars = opts?.labelMaxChars ?? 10
  const slice = labels.slice(0, maxBars).map((l, i) => ({ l, v: values[i] ?? 0 }))
  const n = slice.length
  const maxV = Math.max(1e-9, ...slice.map((s) => Math.abs(s.v)))
  const maxIdx = slice.reduce((bi, s, i) => (s.v >= slice[bi].v ? i : bi), 0)

  const W = 420
  const padT = 32
  const padB = 52
  const padL = 30
  const padR = 14
  const chartH = 132
  const H = padT + chartH + padB
  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, padL, 18)

  const chartW = W - padL - padR
  const baseY = padT + chartH
  const slotW = chartW / n
  const barW = Math.min(28, slotW * 0.62)

  /* Y-axis ticks (light, minimal) */
  ctx.strokeStyle = axisC
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padL, padT)
  ctx.lineTo(padL, baseY)
  ctx.lineTo(W - padR, baseY)
  ctx.stroke()
  const tickVals = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxV)
  ctx.font = "9px sans-serif"
  ctx.fillStyle = labelC
  ctx.textAlign = "right"
  tickVals.forEach((tv) => {
    const ty = baseY - (tv / maxV) * chartH
    ctx.strokeStyle = "#f1f5f9"
    ctx.beginPath()
    ctx.moveTo(padL, ty)
    ctx.lineTo(W - padR, ty)
    ctx.stroke()
    ctx.fillStyle = labelC
    ctx.fillText(fmtBarVal(tv), padL - 4, ty + 3)
  })

  slice.forEach((s, i) => {
    const cx = padL + i * slotW + slotW / 2
    const x = cx - barW / 2
    const h = (Math.abs(s.v) / maxV) * chartH
    const y = baseY - h
    const isHi = i === maxIdx && s.v > 0
    ctx.fillStyle = isHi ? accent : barTrack
    ctx.fillRect(x, y, barW, h)

    /* Value strip */
    const stripH = 18
    ctx.fillStyle = isHi ? accent : barTrack
    ctx.fillRect(x, baseY, barW, stripH)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 10px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(fmtBarVal(s.v), cx, baseY + stripH / 2)

    ctx.fillStyle = labelC
    ctx.font = "9px sans-serif"
    ctx.fillText(truncateLabel(s.l, labelMaxChars), cx, baseY + stripH + 10)
  })

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Donut with legend on the left, chart on the right (reference layout). */
export function donutChartPng(
  title: string,
  segments: { label: string; value: number; color: string }[],
  opts?: { theme?: ChartVisualTheme }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const legendC = theme?.labelColor ?? "#475569"

  const W = 460
  const H = 220
  const { canvas, ctx } = createHiResCanvas(W, H)
  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, 14, 18)

  const legendX = 14
  let legendY = 40
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1

  segments.forEach((seg) => {
    const pct = (Math.max(0, seg.value) / total) * 100
    ctx.fillStyle = seg.color
    ctx.beginPath()
    ctx.arc(legendX + 5, legendY + 5, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = legendC
    ctx.font = "11px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(`${seg.label}  ${pct.toFixed(0)}%`, legendX + 16, legendY + 8)
    legendY += 22
  })

  const cx = W - 110
  const cy = H / 2 + 8
  const rOut = 72
  const rIn = 42
  let ang = -Math.PI / 2
  segments.forEach((seg) => {
    const frac = Math.max(0, seg.value) / total
    const a2 = ang + frac * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx, cy, rOut, ang, a2)
    ctx.arc(cx, cy, rIn, a2, ang, true)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    ang = a2
  })

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Concentric activity rings: each ring = one category’s share of total (reference “Devices used”). Legend left. */
export function radialRingsChartPng(
  title: string,
  segments: { label: string; value: number; color: string }[],
  opts?: { theme?: ChartVisualTheme }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const legendC = theme?.labelColor ?? "#475569"

  const W = 460
  const H = 220
  const { canvas, ctx } = createHiResCanvas(W, H)
  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, 14, 18)

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1
  const legendX = 14
  let legendY = 38

  segments.forEach((seg) => {
    const pct = (Math.max(0, seg.value) / total) * 100
    ctx.fillStyle = seg.color
    ctx.beginPath()
    ctx.arc(legendX + 5, legendY + 5, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = legendC
    ctx.font = "11px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(`${seg.label}  ${pct.toFixed(0)}%`, legendX + 16, legendY + 8)
    legendY += 22
  })

  const cx = W - 105
  const cy = H / 2 + 12
  const ringW = 9
  const gap = 5
  const baseR = 78
  ctx.lineCap = "round"
  segments.forEach((seg, i) => {
    const r = baseR - i * (ringW + gap)
    const frac = Math.max(0, seg.value) / total
    if (frac < 0.001) return
    const sweep = frac * Math.PI * 2
    const start = -Math.PI / 2
    ctx.strokeStyle = seg.color
    ctx.lineWidth = ringW
    ctx.beginPath()
    ctx.arc(cx, cy, r, start, start + sweep)
    ctx.stroke()
  })

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Two metrics per category: clustered vertical bars, legend top, light Y grid (reference “Daily activity” feel). */
export function clusteredVerticalBarChartPng(
  title: string,
  labels: string[],
  seriesA: number[],
  seriesB: number[],
  legend: [string, string],
  opts?: { maxRows?: number; labelMaxChars?: number; theme?: ChartVisualTheme; scaleB?: number }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#64748b"
  const legC = theme?.titleColor ?? "#0f172a"
  const barA = theme?.barPrimary ?? "#2563eb"
  const barB = theme?.barSecondary ?? "#f97316"
  const axisC = "#cbd5e1"
  const gridC = "#f1f5f9"

  const scaleB = opts?.scaleB ?? 1000
  const maxRows = opts?.maxRows ?? 12
  const labelMaxChars = opts?.labelMaxChars ?? 8
  const n = Math.min(labels.length, maxRows, seriesA.length, seriesB.length)
  const aS = seriesA.slice(0, n).map((x) => Math.abs(x))
  const bS = seriesB.slice(0, n).map((x) => Math.abs(x) / scaleB)
  const maxV = Math.max(1e-9, ...aS, ...bS)

  const W = 440
  const padT = 48
  const padB = 44
  const padL = 36
  const padR = 12
  const chartH = 128
  const H = padT + chartH + padB
  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, padL, 18)

  ctx.font = "10px sans-serif"
  ctx.fillStyle = barA
  ctx.fillRect(padL, 26, 10, 7)
  ctx.fillStyle = legC
  ctx.fillText(legend[0], padL + 14, 32)
  ctx.fillStyle = barB
  ctx.fillRect(padL + 120, 26, 10, 7)
  ctx.fillStyle = legC
  ctx.fillText(`${legend[1]} (÷${scaleB})`, padL + 134, 32)

  const chartW = W - padL - padR
  const baseY = padT + chartH
  const groupW = chartW / n
  const inner = groupW * 0.72
  const barW = inner / 2 - 1

  ctx.strokeStyle = axisC
  ctx.beginPath()
  ctx.moveTo(padL, padT)
  ctx.lineTo(padL, baseY)
  ctx.lineTo(W - padR, baseY)
  ctx.stroke()

  ;[0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    const ty = baseY - t * chartH
    ctx.strokeStyle = gridC
    ctx.beginPath()
    ctx.moveTo(padL, ty)
    ctx.lineTo(W - padR, ty)
    ctx.stroke()
    ctx.fillStyle = labelC
    ctx.font = "9px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(fmtBarVal(t * maxV), padL - 4, ty + 3)
  })

  for (let i = 0; i < n; i++) {
    const gx = padL + i * groupW + groupW / 2
    const a = aS[i] ?? 0
    const b = bS[i] ?? 0
    const ha = (a / maxV) * chartH
    const hb = (b / maxV) * chartH
    ctx.fillStyle = barA
    ctx.fillRect(gx - inner / 2, baseY - ha, barW, ha)
    ctx.fillStyle = barB
    ctx.fillRect(gx - inner / 2 + barW + 2, baseY - hb, barW, hb)

    ctx.fillStyle = labelC
    ctx.font = "9px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(truncateLabel(labels[i], labelMaxChars), gx, baseY + 12)
  }

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Stacked vertical bars: multiple series per row (e.g. day-type mix per employee). Legend top. */
export function stackedVerticalBarChartPng(
  title: string,
  labels: string[],
  series: { key: string; values: number[]; color: string }[],
  opts?: { maxRows?: number; labelMaxChars?: number; theme?: ChartVisualTheme }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#64748b"
  const legC = theme?.titleColor ?? "#0f172a"
  const axisC = "#cbd5e1"
  const gridC = "#f1f5f9"

  const maxRows = opts?.maxRows ?? 10
  const labelMaxChars = opts?.labelMaxChars ?? 8
  const n = Math.min(labels.length, maxRows)
  const nSeries = series.length
  const totals = Array.from({ length: n }, (_, i) =>
    series.reduce((s, ser) => s + Math.max(0, ser.values[i] ?? 0), 0)
  )
  const maxTotal = Math.max(1e-9, ...totals)

  const W = 440
  const padT = 42
  const padB = 40
  const padL = 36
  const padR = 12
  const chartH = 132
  const H = padT + chartH + padB
  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, padL, 18)

  let lx = padL
  series.forEach((ser) => {
    ctx.fillStyle = ser.color
    ctx.fillRect(lx, 26, 10, 7)
    ctx.fillStyle = legC
    ctx.font = "9px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(ser.key, lx + 14, 32)
    lx += ctx.measureText(ser.key).width + 28
  })

  const chartW = W - padL - padR
  const baseY = padT + chartH
  const groupW = chartW / n

  ctx.strokeStyle = axisC
  ctx.beginPath()
  ctx.moveTo(padL, padT)
  ctx.lineTo(padL, baseY)
  ctx.lineTo(W - padR, baseY)
  ctx.stroke()

  ;[0, 0.5, 1].forEach((t) => {
    const ty = baseY - t * chartH
    ctx.strokeStyle = gridC
    ctx.beginPath()
    ctx.moveTo(padL, ty)
    ctx.lineTo(W - padR, ty)
    ctx.stroke()
    ctx.fillStyle = labelC
    ctx.font = "9px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(fmtBarVal(t * maxTotal), padL - 4, ty + 3)
  })

  for (let i = 0; i < n; i++) {
    const cx = padL + i * groupW + groupW / 2
    const barW = Math.min(32, groupW * 0.55)
    let y = baseY
    for (let s = nSeries - 1; s >= 0; s--) {
      const ser = series[s]
      const v = Math.max(0, ser.values[i] ?? 0)
      const h = (v / maxTotal) * chartH
      y -= h
      ctx.fillStyle = ser.color
      ctx.fillRect(cx - barW / 2, y, barW, h)
    }
    ctx.fillStyle = labelC
    ctx.font = "9px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(truncateLabel(labels[i], labelMaxChars), cx, baseY + 12)
  }

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/**
 * Horizontal bars: one row per category — names on the left (readable), values at bar end.
 * Best for many employee names (avoids cramped X-axis labels on vertical charts).
 */
export function horizontalBarChartPng(
  title: string,
  labels: string[],
  values: number[],
  opts?: {
    barColor?: string
    maxBars?: number
    labelMaxChars?: number
    theme?: ChartVisualTheme
  }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#334155"
  const valueC = theme?.valueColor ?? "#475569"
  const accent = opts?.barColor ?? theme?.barPrimary ?? "#2563eb"
  /** Default bar fill: brand navy (not gray) */
  const barTrack = theme?.barSecondary ?? "#1d4ed8"

  const maxBars = opts?.maxBars ?? 20
  const labelMaxChars = opts?.labelMaxChars ?? 30
  const slice = labels.slice(0, maxBars).map((l, i) => ({ l, v: values[i] ?? 0 }))
  const labelCol = 172
  const barArea = 268
  /** Fixed column for values so numbers never overlap long bars */
  const valueCol = 62
  const rowH = 18
  const rowGap = 4
  const padT = 30
  const padB = 12
  const padL = 10
  const padR = 16
  const W = padL + labelCol + barArea + valueCol + padR
  const H = padT + slice.length * (rowH + rowGap) + padB
  const { canvas, ctx } = createHiResCanvas(W, H)

  const maxV = Math.max(1e-9, ...slice.map((s) => Math.abs(s.v)))
  const maxIdx = slice.reduce((bi, s, i) => (s.v >= slice[bi].v ? i : bi), 0)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, padL, 18)

  slice.forEach((s, i) => {
    const y = padT + i * (rowH + rowGap)
    ctx.fillStyle = labelC
    ctx.font = "11px sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.fillText(truncateLabel(s.l, labelMaxChars), padL + labelCol - 4, y + rowH / 2)

    const isHi = i === maxIdx && s.v > 0
    const barW = (barArea * Math.abs(s.v)) / maxV
    ctx.fillStyle = isHi ? accent : barTrack
    ctx.textAlign = "left"
    ctx.fillRect(padL + labelCol, y + 2, barW, rowH - 4)

    ctx.fillStyle = valueC
    ctx.font = "10px sans-serif"
    ctx.textBaseline = "middle"
    const valText = fmtBarVal(s.v)
    const valueX = padL + labelCol + barArea + valueCol - 4
    ctx.textAlign = "right"
    ctx.fillText(valText, valueX, y + rowH / 2)
  })

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Two series per row (e.g. OT hours vs scaled OT pay), horizontal — labels column avoids overlap. */
export function groupedHorizontalBarChartPng(
  title: string,
  labels: string[],
  seriesA: number[],
  seriesB: number[],
  legend: [string, string],
  opts?: { maxRows?: number; labelMaxChars?: number; theme?: ChartVisualTheme; scaleB?: number }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#334155"
  const legC = theme?.titleColor ?? "#0f172a"
  const barA = theme?.barPrimary ?? "#2563eb"
  const barB = theme?.barSecondary ?? "#f97316"
  const scaleB = opts?.scaleB ?? 1000

  const maxRows = opts?.maxRows ?? 12
  const labelMaxChars = opts?.labelMaxChars ?? 26
  const n = Math.min(labels.length, maxRows, seriesA.length, seriesB.length)
  const labelCol = 160
  const barArea = 280
  const rowH = 24
  const rowGap = 5
  const padT = 42
  const padB = 12
  const padL = 10
  const padR = 12
  const W = padL + labelCol + barArea + padR
  const H = padT + n * (rowH + rowGap) + padB
  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, padL, 18)
  ctx.font = "10px sans-serif"
  ctx.fillStyle = barA
  ctx.fillRect(padL, 26, 10, 7)
  ctx.fillStyle = legC
  ctx.fillText(legend[0], padL + 14, 32)
  ctx.fillStyle = barB
  ctx.fillRect(padL + 130, 26, 10, 7)
  ctx.fillStyle = legC
  ctx.fillText(`${legend[1]} (÷${scaleB})`, padL + 144, 32)

  const maxA = Math.max(1e-9, ...seriesA.slice(0, n).map((x) => Math.abs(x)))
  const maxB = Math.max(1e-9, ...seriesB.slice(0, n).map((x) => Math.abs(x)))

  for (let i = 0; i < n; i++) {
    const y = padT + i * (rowH + rowGap)
    const a = seriesA[i] ?? 0
    const b = (seriesB[i] ?? 0) / scaleB
    ctx.fillStyle = labelC
    ctx.font = "11px sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.fillText(truncateLabel(labels[i], labelMaxChars), padL + labelCol - 4, y + rowH / 2 - 6)

    const halfH = (rowH - 6) / 2
    const wA = (barArea * Math.abs(a)) / maxA
    const wB = (barArea * Math.abs(b)) / maxB
    ctx.fillStyle = barA
    ctx.fillRect(padL + labelCol, y + 1, wA, halfH)
    ctx.fillStyle = barB
    ctx.fillRect(padL + labelCol, y + 4 + halfH, wB, halfH)
  }

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Stacked horizontal: one row per employee, segments left→right (deduction mix). */
export function stackedHorizontalBarChartPng(
  title: string,
  labels: string[],
  series: { key: string; values: number[]; color: string }[],
  opts?: { maxRows?: number; labelMaxChars?: number; theme?: ChartVisualTheme }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#64748b"
  const legC = theme?.titleColor ?? "#0f172a"
  const valueC = theme?.valueColor ?? "#475569"

  const maxRows = opts?.maxRows ?? 12
  const labelMaxChars = opts?.labelMaxChars ?? 28
  const n = Math.min(labels.length, maxRows)
  const nSeries = series.length

  const rowTotals = Array.from({ length: n }, (_, i) =>
    series.reduce((s, ser) => s + Math.max(0, ser.values[i] ?? 0), 0)
  )
  const maxRowTotal = Math.max(1e-9, ...rowTotals)

  const labelCol = 168
  const barArea = 272
  const valueCol = 64
  const rowH = 22
  const rowGap = 5
  const legendH = 18
  const padT = 16
  const padB = 10
  const padL = 10
  const padR = 14
  const W = padL + labelCol + barArea + valueCol + padR
  const headH = padT + 14 + legendH
  const H = headH + n * (rowH + rowGap) + padB
  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, padL, padT + 12)

  let lx = padL
  const ly = padT + 22
  series.forEach((ser) => {
    ctx.fillStyle = ser.color
    ctx.fillRect(lx, ly, 8, 6)
    ctx.fillStyle = legC
    ctx.font = "9px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(ser.key, lx + 11, ly + 6)
    lx += ctx.measureText(ser.key).width + 22
  })

  for (let i = 0; i < n; i++) {
    const y = headH + i * (rowH + rowGap)
    const total = rowTotals[i] ?? 0
    ctx.fillStyle = labelC
    ctx.font = "11px sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.fillText(truncateLabel(labels[i], labelMaxChars), padL + labelCol - 4, y + rowH / 2)

    const fullW = (total / maxRowTotal) * barArea
    let x = padL + labelCol
    for (let s = 0; s < nSeries; s++) {
      const ser = series[s]
      const v = Math.max(0, ser.values[i] ?? 0)
      const segW = total > 0 ? (v / total) * fullW : 0
      ctx.fillStyle = ser.color
      ctx.fillRect(x, y + 3, segW, rowH - 6)
      x += segW
    }

    ctx.fillStyle = valueC
    ctx.font = "9px sans-serif"
    ctx.textBaseline = "middle"
    const totalStr =
      total >= 1000 ? total.toLocaleString("en-PH", { maximumFractionDigits: 0 }) : total.toFixed(0)
    const valueX = padL + labelCol + barArea + valueCol - 4
    ctx.textAlign = "right"
    ctx.fillText(totalStr, valueX, y + rowH / 2)
  }

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim()
  if (h.length !== 6) return `rgba(37, 99, 235, ${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Line or area chart: one value per employee (x = order in report). */
export function singleSeriesCartesianChartPng(
  title: string,
  labels: string[],
  values: number[],
  kind: "line" | "area",
  opts?: {
    theme?: ChartVisualTheme
    strokeColor?: string
    maxPoints?: number
  }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#64748b"
  const stroke = opts?.strokeColor ?? theme?.barPrimary ?? "#2563eb"
  const maxPoints = opts?.maxPoints ?? 18

  const n0 = Math.min(labels.length, values.length, maxPoints)
  const sliceL = labels.slice(0, n0)
  const sliceV = values.slice(0, n0).map((v) => Math.abs(v))
  const maxV = Math.max(1e-9, ...sliceV)

  const W = 440
  const H = 208
  const padT = 26
  const padB = 34
  const padL = 42
  const padR = 14
  const chartTop = padT + 10
  const chartBottom = H - padB
  const chartLeft = padL
  const chartRight = W - padR
  const cw = chartRight - chartLeft
  const ch = chartBottom - chartTop

  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, 12, 16)

  const n = sliceL.length
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    xs.push(n <= 1 ? chartLeft + cw / 2 : chartLeft + (cw * i) / Math.max(1, n - 1))
  }
  const ys = sliceV.map((v) => chartBottom - (v / maxV) * ch)

  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(chartLeft, chartBottom)
  ctx.lineTo(chartRight, chartBottom)
  ctx.moveTo(chartLeft, chartTop)
  ctx.lineTo(chartLeft, chartBottom)
  ctx.stroke()

  ctx.fillStyle = labelC
  ctx.font = n > 18 ? "7px sans-serif" : "8px sans-serif"
  ctx.textAlign = "center"
  for (let i = 0; i < n; i++) {
    ctx.fillText(nameInitials(sliceL[i]), xs[i], H - 10)
  }

  if (kind === "area" && n > 0) {
    ctx.beginPath()
    ctx.moveTo(xs[0], chartBottom)
    for (let i = 0; i < n; i++) ctx.lineTo(xs[i], ys[i])
    ctx.lineTo(xs[n - 1], chartBottom)
    ctx.closePath()
    ctx.fillStyle = hexToRgba(stroke, 0.22)
    ctx.fill()
  }

  if (n > 0) {
    ctx.beginPath()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2.25
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i])
    ctx.stroke()

    ctx.fillStyle = stroke
    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.arc(xs[i], ys[i], 2.8, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.font = "7px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "bottom"
    ctx.fillStyle = titleC
    for (let i = 0; i < n; i++) {
      const t = fmtPointVal(sliceV[i])
      let ty = ys[i] - 5
      if (ty < chartTop + 8) ty = ys[i] + 11
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2.5
      ctx.strokeText(t, xs[i], ty)
      ctx.fillStyle = titleC
      ctx.fillText(t, xs[i], ty)
    }
  }

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}

/** Two series vs employee order (e.g. OT hours & OT pay on a common scale after scaling pay). */
export function dualSeriesCartesianChartPng(
  title: string,
  labels: string[],
  s1: number[],
  s2: number[],
  legend: [string, string],
  kind: "line" | "area",
  opts?: {
    theme?: ChartVisualTheme
    scaleS2?: number
    maxPoints?: number
  }
): ChartImage {
  const theme = opts?.theme
  const titleC = theme?.titleColor ?? "#0f172a"
  const labelC = theme?.labelColor ?? "#64748b"
  const c1 = theme?.barPrimary ?? "#2563eb"
  const c2 = theme?.barSecondary ?? "#f97316"
  const scaleB = opts?.scaleS2 ?? 1000
  const maxPoints = opts?.maxPoints ?? 16

  const n0 = Math.min(labels.length, s1.length, s2.length, maxPoints)
  const sliceL = labels.slice(0, n0)
  const raw1 = s1.slice(0, n0).map((x) => Math.abs(x))
  const raw2 = s2.slice(0, n0).map((x) => Math.abs(x))
  const v1 = raw1
  const v2 = raw2.map((x) => x / scaleB)
  const maxV = Math.max(1e-9, ...v1, ...v2)

  const W = 440
  const H = 218
  const padT = 44
  const padB = 34
  const padL = 42
  const padR = 14
  const chartTop = padT + 4
  const chartBottom = H - padB
  const chartLeft = padL
  const chartRight = W - padR
  const cw = chartRight - chartLeft
  const ch = chartBottom - chartTop

  const { canvas, ctx } = createHiResCanvas(W, H)

  ctx.fillStyle = titleC
  ctx.font = "bold 13px sans-serif"
  ctx.fillText(title, 12, 16)

  ctx.font = "9px sans-serif"
  const leg1W = ctx.measureText(legend[0]).width
  ctx.fillStyle = c1
  ctx.fillRect(12, 22, 10, 6)
  ctx.fillStyle = titleC
  ctx.textAlign = "left"
  ctx.fillText(legend[0], 26, 27)
  const leg2x = 26 + leg1W + 28
  ctx.fillStyle = c2
  ctx.fillRect(leg2x - 14, 22, 10, 6)
  ctx.fillStyle = titleC
  ctx.fillText(`${legend[1]} (÷${scaleB})`, leg2x, 27)

  const n = sliceL.length
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    xs.push(n <= 1 ? chartLeft + cw / 2 : chartLeft + (cw * i) / Math.max(1, n - 1))
  }
  const y1 = v1.map((v) => chartBottom - (v / maxV) * ch)
  const y2 = v2.map((v) => chartBottom - (v / maxV) * ch)

  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(chartLeft, chartBottom)
  ctx.lineTo(chartRight, chartBottom)
  ctx.moveTo(chartLeft, chartTop)
  ctx.lineTo(chartLeft, chartBottom)
  ctx.stroke()

  ctx.fillStyle = labelC
  ctx.font = n > 18 ? "7px sans-serif" : "8px sans-serif"
  ctx.textAlign = "center"
  for (let i = 0; i < n; i++) {
    ctx.fillText(nameInitials(sliceL[i]), xs[i], H - 10)
  }

  const drawArea = (yVals: number[], color: string) => {
    if (n === 0) return
    ctx.beginPath()
    ctx.moveTo(xs[0], chartBottom)
    for (let i = 0; i < n; i++) ctx.lineTo(xs[i], yVals[i])
    ctx.lineTo(xs[n - 1], chartBottom)
    ctx.closePath()
    ctx.fillStyle = hexToRgba(color, 0.2)
    ctx.fill()
  }

  const drawLine = (yVals: number[], color: string) => {
    if (n === 0) return
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.1
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.moveTo(xs[0], yVals[0])
    for (let i = 1; i < n; i++) ctx.lineTo(xs[i], yVals[i])
    ctx.stroke()
    ctx.fillStyle = color
    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.arc(xs[i], yVals[i], 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (kind === "area") {
    drawArea(y2, c2)
    drawArea(y1, c1)
  }
  drawLine(y2, c2)
  drawLine(y1, c1)

  ctx.font = "6.5px sans-serif"
  ctx.textBaseline = "bottom"
  for (let i = 0; i < n; i++) {
    const t1 = fmtPointVal(raw1[i])
    const t2 = fmtPointVal(raw2[i])
    const close = Math.abs(y1[i] - y2[i]) < 11
    const off = close ? 5 : 0
    ctx.textAlign = "right"
    let ty1 = y1[i] - 4 - off
    if (ty1 < chartTop + 2) ty1 = y1[i] + 9
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.strokeText(t1, xs[i] - 1, ty1)
    ctx.fillStyle = c1
    ctx.fillText(t1, xs[i] - 1, ty1)

    ctx.textAlign = "left"
    let ty2 = y2[i] - 4 + off
    if (ty2 < chartTop + 2) ty2 = y2[i] + 9
    ctx.strokeText(t2, xs[i] + 1, ty2)
    ctx.fillStyle = c2
    ctx.fillText(t2, xs[i] + 1, ty2)
  }

  return { png: canvas.toDataURL("image/png"), w: W, h: H }
}
