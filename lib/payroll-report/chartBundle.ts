import type { PayrollAttendanceReport } from "./types"
import type { OrganizationKey } from "./types"
import type { ChartSelection } from "./types"
import type { ChartStyleSelection } from "./types"
import { DEFAULT_CHART_SELECTION } from "./types"
import { DEFAULT_CHART_STYLES } from "./types"
import type { ChartImage } from "./chartImages"
import {
  horizontalBarChartPng,
  groupedHorizontalBarChartPng,
  stackedHorizontalBarChartPng,
  radialRingsChartPng,
  donutChartPng,
  singleSeriesCartesianChartPng,
  dualSeriesCartesianChartPng,
} from "./chartImages"
import { getChartVisualTheme } from "./pdfThemes"

export type PayrollChartBundle = {
  hoursBar?: ChartImage
  netPayBar?: ChartImage
  attendanceDonut?: ChartImage
  overtimeGrouped?: ChartImage
  deductionsBar?: ChartImage
  tardinessBars?: ChartImage
}

export function buildChartBundle(
  report: PayrollAttendanceReport,
  organization: OrganizationKey,
  selection: ChartSelection = DEFAULT_CHART_SELECTION,
  styles: ChartStyleSelection = DEFAULT_CHART_STYLES
): PayrollChartBundle {
  const names = report.employees.map((e) => e.fullName)
  const hours = report.employees.map((e) => e.totalWorkingHours)
  const netPays = report.employees.map((e) => e.netPay)
  const otH = report.employees.map((e) => e.overtimeHours)
  const otP = report.employees.map((e) => e.overtimePay)
  const tard = report.employees.map((e) => e.tardinessTotalMinutes)
  const pie = report.totals.attendancePie
  const theme = getChartVisualTheme(organization)
  const [c0, c1, c2, c3] = theme.donut

  const out: PayrollChartBundle = {}

  if (selection.hoursBar) {
    const t = styles.hours
    if (t === "bar") {
      out.hoursBar = horizontalBarChartPng("Total working hours (employee)", names, hours, {
        theme,
        barColor: theme.barPrimary,
        labelMaxChars: 32,
      })
    } else {
      out.hoursBar = singleSeriesCartesianChartPng(
        "Total working hours (employee)",
        names,
        hours,
        t,
        { theme, strokeColor: theme.barPrimary }
      )
    }
  }

  if (selection.netPayBar) {
    const t = styles.netPay
    if (t === "bar") {
      out.netPayBar = horizontalBarChartPng("Net pay (employee)", names, netPays, {
        theme,
        barColor: theme.accentBar,
        labelMaxChars: 32,
      })
    } else {
      out.netPayBar = singleSeriesCartesianChartPng("Net pay (employee)", names, netPays, t, {
        theme,
        strokeColor: theme.accentBar,
      })
    }
  }

  if (selection.attendanceDonut) {
    const segs = [
      { label: "Present", value: pie.present, color: c0 },
      { label: "Absent", value: pie.absent, color: c1 },
      { label: "Leave", value: pie.leave, color: c2 },
      { label: "WFH", value: pie.wfh, color: c3 },
    ]
    out.attendanceDonut =
      styles.attendance === "donut"
        ? donutChartPng("Attendance mix (days)", segs, { theme })
        : radialRingsChartPng("Attendance mix (days)", segs, { theme })
  }

  if (selection.overtimeGrouped) {
    const ot = styles.overtime
    if (ot === "groupedBar") {
      out.overtimeGrouped = groupedHorizontalBarChartPng(
        "Overtime hours vs OT pay (÷1000)",
        names,
        otH,
        otP,
        ["OT hours", "OT pay"],
        { theme, scaleB: 1000, labelMaxChars: 28 }
      )
    } else {
      out.overtimeGrouped = dualSeriesCartesianChartPng(
        "Overtime hours vs OT pay (÷1000)",
        names,
        otH,
        otP,
        ["OT hours", "OT pay"],
        ot,
        { theme, scaleS2: 1000 }
      )
    }
  }

  if (selection.deductionsBar) {
    const stackN = Math.min(12, names.length)
    const idx = [...names.keys()].slice(0, stackN)
    if (styles.deductions === "stackedBar") {
      out.deductionsBar = stackedHorizontalBarChartPng(
        "Deduction mix by employee (₱)",
        idx.map((i) => names[i] ?? ""),
        [
          {
            key: "Late",
            values: idx.map((i) => report.employees[i]?.deductionLate ?? 0),
            color: theme.barPrimary,
          },
          {
            key: "Absence",
            values: idx.map((i) => report.employees[i]?.deductionAbsences ?? 0),
            color: theme.accentBar,
          },
          {
            key: "Other",
            values: idx.map((i) => report.employees[i]?.deductionOther ?? 0),
            color: theme.barSecondary,
          },
        ],
        { theme, maxRows: stackN, labelMaxChars: 30 }
      )
    } else {
      const totals = report.employees.map((e) => e.totalDeductions)
      out.deductionsBar = horizontalBarChartPng(
        "Total deductions (employee)",
        names,
        totals,
        { theme, barColor: theme.barSecondary, labelMaxChars: 32 }
      )
    }
  }

  if (selection.tardinessBars) {
    const t = styles.tardiness
    if (t === "bar") {
      out.tardinessBars = horizontalBarChartPng(
        "Tardiness (minutes) by employee",
        names,
        tard,
        { theme, barColor: theme.barPrimary, labelMaxChars: 32 }
      )
    } else {
      out.tardinessBars = singleSeriesCartesianChartPng(
        "Tardiness (minutes) by employee",
        names,
        tard,
        t,
        { theme, strokeColor: theme.barPrimary }
      )
    }
  }

  return out
}
