import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { PayrollAttendanceReport } from "./types"
import type { ChartSelection } from "./types"
import { DEFAULT_CHART_SELECTION } from "./types"
import type { ChartImage } from "./chartImages"
import type { PayrollChartBundle } from "./chartBundle"
import { hexToRgb, getPdfBrandTheme } from "./pdfThemes"
import { formatPesoMoney } from "../format-currency"

function fmtMoney(n: number) {
  return formatPesoMoney(n)
}

function fmtNum(n: number, d = 2) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fitImageMm(pxW: number, pxH: number, maxW: number, maxH: number): { w: number; h: number } {
  const aspect = pxW / pxH
  let w = maxW
  let h = w / aspect
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }
  return { w, h }
}

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  theme: ReturnType<typeof getPdfBrandTheme>
) {
  const [br, bg, bb] = hexToRgb(theme.border)
  const [tr, tg, tb] = hexToRgb(theme.text)
  const [ar, ag, ab] = hexToRgb(theme.accent)
  const [sr, sg, sb] = hexToRgb(theme.surface)
  doc.setDrawColor(br, bg, bb)
  doc.setFillColor(sr, sg, sb)
  doc.roundedRect(x, y, w, h, 1, 1, "FD")
  doc.setTextColor(tr, tg, tb)
  doc.setFontSize(6)
  doc.setFont("helvetica", "normal")
  doc.text(label, x + 1.8, y + 3.5)
  doc.setTextColor(ar, ag, ab)
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  const lines = doc.splitTextToSize(value, w - 3.5)
  doc.text(lines, x + 1.8, y + 7.2)
  doc.setFont("helvetica", "normal")
}

export type { PayrollChartBundle } from "./chartBundle"

export function generatePayrollAttendancePdf(
  report: PayrollAttendanceReport,
  charts: PayrollChartBundle,
  selection: ChartSelection = DEFAULT_CHART_SELECTION
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const brand = getPdfBrandTheme(report.organization)
  const [pr, pg, pb] = hexToRgb(brand.primary)
  const [ar, ag, ab] = hexToRgb(brand.accent)
  const [tr, tg, tb] = hexToRgb(brand.text)
  const [mr, mg, mb] = hexToRgb(brand.muted)

  const brandName = report.organization === "pdn" ? "Palawan Daily News" : "Petrosphere"

  /* —— Header band (compact) —— */
  const headerH = 20
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, pageW, headerH, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("Payroll", margin, 9)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text("Attendance summary", margin, 14.5)
  doc.setFontSize(9)
  doc.text(`${report.periodStart}  →  ${report.periodEnd}`, pageW - margin, 10.5, { align: "right" })
  doc.setFontSize(7.5)
  doc.text(brandName, pageW - margin, 16, { align: "right" })

  doc.setFillColor(ar, ag, ab)
  doc.rect(0, headerH, pageW, 1.8, "F")

  let y = headerH + 6

  /* —— Section: General summary (compact) —— */
  doc.setTextColor(pr, pg, pb)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("General summary", margin, y)
  y += 3.5
  doc.setTextColor(mr, mg, mb)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  const sumLine = doc.splitTextToSize(
    `Period KPIs · ${report.frequency}.`,
    pageW - 2 * margin
  )
  doc.text(sumLine, margin, y)
  y += sumLine.length * 3 + 2.5

  const t = report.totals
  const kpis: [string, string][] = [
    ["Employees", String(t.employeeCount)],
    ["Total hours", fmtNum(t.totalWorkingHours)],
    ["Avg hours / emp", fmtNum(t.averageWorkingHours)],
    ["Avg working days", fmtNum(t.averageWorkingDays)],
    ["Total net pay", fmtMoney(t.totalNetPay)],
    ["Total deductions", fmtMoney(t.totalDeductions)],
    ["OT pay (₱)", fmtMoney(t.totalOvertimePay)],
    ["Avg tardiness (min)", fmtNum(t.averageTardinessMinutes)],
  ]

  const gap = 2.5
  const cardW = (pageW - 2 * margin - 3 * gap) / 4
  const cardH = 11.8
  let cx = margin
  let rowY = y
  kpis.forEach(([label, val], i) => {
    drawKpiCard(doc, cx, rowY, cardW, cardH, label, val, brand)
    cx += cardW + gap
    if ((i + 1) % 4 === 0) {
      cx = margin
      rowY += cardH + gap
    }
  })
  y = rowY + 3

  const ex0 = report.employees[0]
  if (ex0) {
    doc.setTextColor(mr, mg, mb)
    doc.setFontSize(7)
    const sched = `Working days (excl. weekends & holidays): month ≈ ${ex0.workingDaysMonthCalendar} | days 1–15 ≈ ${ex0.workingDaysFirstCutoff} | days 16–end ≈ ${ex0.workingDaysSecondCutoff}`
    const split = doc.splitTextToSize(sched, pageW - 2 * margin)
    doc.text(split, margin, y)
    y += split.length * 3 + 4
  }

  /* —— Charts —— */
  const chartOrder: { sel: keyof ChartSelection; img?: ChartImage }[] = [
    { sel: "hoursBar", img: charts.hoursBar },
    { sel: "netPayBar", img: charts.netPayBar },
    { sel: "attendanceDonut", img: charts.attendanceDonut },
    { sel: "overtimeGrouped", img: charts.overtimeGrouped },
    { sel: "deductionsBar", img: charts.deductionsBar },
    { sel: "tardinessBars", img: charts.tardinessBars },
  ]
  const activeCharts = chartOrder.filter((c) => selection[c.sel] && c.img)

  if (activeCharts.length > 0) {
    doc.setTextColor(pr, pg, pb)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Charts & analytics", margin, y)
    y += 3.5
    doc.setTextColor(mr, mg, mb)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.text("Selected visual summaries for this export.", margin, y)
    y += 5

    const cols = 3
    const cgap = 4
    const slotW = (pageW - 2 * margin - (cols - 1) * cgap) / cols
    /** Keep charts readable but leave room for the employee table on page 1 */
    const maxRowH = 54

    const drawChartRow = (items: ChartImage[]) => {
      const heights: number[] = []
      items.forEach((ch, i) => {
        const { w, h } = fitImageMm(ch.w, ch.h, slotW, maxRowH)
        const x = margin + i * (slotW + cgap)
        try {
          doc.addImage(ch.png, "PNG", x, y, w, h)
        } catch {
          doc.setTextColor(mr, mg, mb)
          doc.text("[chart]", x, y + 4)
          heights.push(8)
          return
        }
        heights.push(h)
      })
      y += Math.max(...heights, 5) + 3
    }

    let batch: ChartImage[] = []
    activeCharts.forEach((c) => {
      if (!c.img) return
      batch.push(c.img)
      if (batch.length === cols) {
        drawChartRow(batch)
        batch = []
      }
    })
    if (batch.length) drawChartRow(batch)
    y += 2
  }

  /* —— Employee detail table —— */
  doc.setTextColor(pr, pg, pb)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Employee details", margin, y)
  y += 5

  const head = [
    [
      "Name",
      "Hrs",
      "WD",
      "Abs",
      "Leave",
      "Late(min)",
      "UT(h)",
      "Early",
      "WFH",
      "Basic",
      "OT h",
      "OT (₱)",
      "Tard (₱)",
      "Abs (₱)",
      "Other (₱)",
      "Total ded.",
      "Net",
    ],
  ]
  const body = report.employees.map((e) => [
    e.fullName.slice(0, 22),
    fmtNum(e.totalWorkingHours, 1),
    String(e.workingDaysInPeriod),
    String(e.absenceDays),
    String(e.leaveDays),
    String(e.tardinessTotalMinutes),
    fmtNum(e.undertimeTotalHours, 2),
    String(e.earlyOutIncidents),
    String(e.wfhDays),
    fmtMoney(e.basicSalary),
    fmtNum(e.overtimeHours, 2),
    fmtMoney(e.overtimePay),
    fmtMoney(e.deductionLate),
    fmtMoney(e.deductionAbsences),
    fmtMoney(e.deductionOther),
    fmtMoney(e.totalDeductions),
    fmtMoney(e.netPay),
  ])

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.4,
      textColor: [tr, tg, tb],
      lineColor: hexToRgb(brand.border),
    },
    headStyles: {
      fillColor: [pr, pg, pb],
      textColor: 255,
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    tableWidth: "auto",
    showHead: "everyPage",
    didDrawPage: () => {
      doc.setTextColor(mr, mg, mb)
      doc.setFontSize(8)
      doc.text(
        `${brandName} — ${report.periodStart} to ${report.periodEnd}`,
        margin,
        pageH - 6
      )
    },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40
  let y2 = finalY + 8
  if (y2 > pageH - 35) {
    doc.addPage()
    y2 = margin
  }

  doc.setTextColor(pr, pg, pb)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Notes & validation", margin, y2)
  y2 += 6
  doc.setTextColor(tr, tg, tb)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  if (report.validationIssues.length === 0) {
    doc.text("No data validation warnings for this run.", margin, y2)
  } else {
    report.validationIssues.slice(0, 18).forEach((vi, i) => {
      doc.text(`• ${vi.employeeName}: ${vi.message}`, margin, y2 + i * 4.5)
    })
  }

  doc.save(`Payroll_Attendance_${report.periodStart}_${report.periodEnd}.pdf`)
}
