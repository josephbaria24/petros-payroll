import type { SupabaseClient } from "@supabase/supabase-js"

export type PayrollFrequency = "monthly" | "semi-monthly"

export type OrganizationKey = "petrosphere" | "pdn"

export type ValidationIssue = {
  employeeId: string
  employeeName: string
  message: string
  severity: "warning" | "error"
}

export type EmployeePayrollRow = {
  employeeId: string
  employeeCode: string
  fullName: string
  payType: string
  totalWorkingHours: number
  workingDaysInPeriod: number
  workingDaysMonthCalendar: number
  workingDaysFirstCutoff: number
  workingDaysSecondCutoff: number
  absenceDays: number
  leaveDays: number
  tardinessTotalMinutes: number
  tardinessAvgMinutes: number
  undertimeTotalHours: number
  earlyOutIncidents: number
  wfhDays: number
  presentDays: number
  remoteDays: number
  lateDays: number
  basicSalary: number
  overtimeHours: number
  overtimePay: number
  deductionLate: number
  deductionUndertime: number
  deductionAbsences: number
  deductionOther: number
  totalDeductions: number
  netPay: number
  /** Raw payroll record id when matched */
  payrollRecordId?: string
}

export type ReportTotals = {
  employeeCount: number
  totalWorkingHours: number
  averageWorkingHours: number
  totalWorkingDaysSum: number
  averageWorkingDays: number
  totalAbsenceDays: number
  totalLeaveDays: number
  totalTardinessMinutes: number
  averageTardinessMinutes: number
  totalUndertimeHours: number
  totalEarlyOutIncidents: number
  totalWfhDays: number
  totalOvertimeHours: number
  totalOvertimePay: number
  totalDeductions: number
  totalNetPay: number
  attendancePie: {
    present: number
    absent: number
    leave: number
    wfh: number
  }
}

export type PayrollAttendanceReport = {
  generatedAt: string
  organization: OrganizationKey
  periodStart: string
  periodEnd: string
  frequency: PayrollFrequency
  holidaysUsed: string[]
  employees: EmployeePayrollRow[]
  totals: ReportTotals
  validationIssues: ValidationIssue[]
}

export type LoadReportDataParams = {
  supabase: SupabaseClient
  organization: OrganizationKey
  periodStart: Date
  periodEnd: Date
  /** Optional newline/comma-separated yyyy-MM-dd dates (configurable holidays). */
  extraHolidayRaw: string
}

/** Which chart images to render and embed in the PDF. */
export type ChartSelection = {
  hoursBar: boolean
  netPayBar: boolean
  attendanceDonut: boolean
  overtimeGrouped: boolean
  deductionsBar: boolean
  tardinessBars: boolean
}

export const DEFAULT_CHART_SELECTION: ChartSelection = {
  hoursBar: true,
  netPayBar: true,
  attendanceDonut: true,
  overtimeGrouped: true,
  deductionsBar: true,
  tardinessBars: true,
}

/** Per-employee numeric series: horizontal bars vs line / area over employees. */
export type EmployeeSeriesChartKind = "bar" | "line" | "area"

/** Attendance breakdown: rings (default) or classic donut. */
export type AttendanceChartKind = "rings" | "donut"

/** Overtime: grouped horizontal bars, or line / area of two series (hours vs pay ÷1000 scaled). */
export type OvertimeChartKind = "groupedBar" | "line" | "area"

/** Deductions: stacked segments per employee, or single bar of total deductions per employee. */
export type DeductionChartKind = "stackedBar" | "bar"

export type ChartStyleSelection = {
  hours: EmployeeSeriesChartKind
  netPay: EmployeeSeriesChartKind
  attendance: AttendanceChartKind
  overtime: OvertimeChartKind
  deductions: DeductionChartKind
  tardiness: EmployeeSeriesChartKind
}

export const DEFAULT_CHART_STYLES: ChartStyleSelection = {
  hours: "bar",
  netPay: "bar",
  attendance: "rings",
  overtime: "groupedBar",
  deductions: "stackedBar",
  tardiness: "bar",
}
