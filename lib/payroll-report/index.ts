export type {
  PayrollAttendanceReport,
  PayrollFrequency,
  OrganizationKey,
  LoadReportDataParams,
  EmployeePayrollRow,
  ReportTotals,
  ChartSelection,
  ChartStyleSelection,
  EmployeeSeriesChartKind,
  AttendanceChartKind,
  OvertimeChartKind,
  DeductionChartKind,
} from "./types"
export { DEFAULT_CHART_SELECTION, DEFAULT_CHART_STYLES } from "./types"
export { buildPayrollAttendanceReport } from "./computeReport"
export {
  loadPayrollReportPayload,
  fetchReportEmployeeList,
  filterPayloadToEmployeeIds,
} from "./loadReportData"
export type { ReportEmployeeOption } from "./loadReportData"
export { parseExtraHolidayInput } from "./workingDays"
export { generatePayrollAttendancePdf } from "./pdfReport"
export { getPdfBrandTheme, getChartVisualTheme } from "./pdfThemes"
export { buildChartBundle } from "./chartBundle"
export type { PayrollChartBundle } from "./chartBundle"

import type { PayrollFrequency } from "./types"
import { buildPayrollAttendanceReport } from "./computeReport"
import type { LoadedReportPayload } from "./loadReportData"
import { startOfDay } from "date-fns"

export function compilePayrollAttendanceReport(
  loaded: LoadedReportPayload,
  periodStart: Date,
  periodEnd: Date,
  frequency: PayrollFrequency
) {
  return buildPayrollAttendanceReport({
    organization: loaded.organization,
    periodStart: startOfDay(periodStart),
    periodEnd: startOfDay(periodEnd),
    frequency,
    holidayDates: loaded.holidayDates,
    employees: loaded.employees,
    allLogs: loaded.allLogs,
    timeLogsByEmpDate: loaded.timeLogsByEmpDate,
    payrollByEmployee: loaded.payrollByEmployee,
    overtimeHoursByEmployee: loaded.overtimeHoursByEmployee,
    miscDeductionsFromTables: loaded.miscDeductionsFromTables,
  })
}
