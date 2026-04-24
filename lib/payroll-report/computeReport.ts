import { addDays, format, startOfDay } from "date-fns"
import type {
  EmployeePayrollRow,
  OrganizationKey,
  PayrollAttendanceReport,
  PayrollFrequency,
  ValidationIssue,
} from "./types"
import { extractPhilippineTime, minutesBetweenInOut, parseTimeToMinutes } from "./timeUtils"
import {
  countBusinessDaysExcludingHolidays,
  isWeekendDate,
  workingDaysInCalendarMonth,
  workingDaysPerSemiMonthlyCutoff,
} from "./workingDays"

const EXPECTED_WORK_MINUTES = 8 * 60
const EARLY_OUT_THRESHOLD_MINUTES = 15

type Emp = {
  id: string
  full_name: string
  employee_code?: string
  pay_type?: string
  attendance_log_userid?: number | null
  daily_rate?: number
  base_salary?: number
}

type PayrollRec = {
  id?: string
  basic_salary: number
  overtime_pay: number
  unpaid_salary: number
  reimbursement: number
  absences: number
  tardiness: number
  total_deductions: number
  net_pay: number
  sss?: number
  philhealth?: number
  pagibig?: number
  withholding_tax?: number
  loans?: number
  uniform?: number
  cash_advance?: number
}

type TimeLogRow = {
  employee_id: string
  date: string
  time_in: string | null
  time_out: string | null
  total_hours: number | null
  overtime_hours: number | null
  status: string | null
}

function parseEndMinutes(timeOut: string | null): number | null {
  return parseTimeToMinutes(timeOut)
}

function estimateOvertimeHours(overtimePay: number, emp: Emp): number {
  const dr = emp.daily_rate || 0
  if (dr <= 0 || overtimePay <= 0) return 0
  const hourly = dr / 8
  return Math.round((overtimePay / hourly) * 100) / 100
}

function otherDeductions(pr: PayrollRec): number {
  const known =
    (pr.sss || 0) +
    (pr.philhealth || 0) +
    (pr.pagibig || 0) +
    (pr.withholding_tax || 0) +
    (pr.loans || 0) +
    (pr.uniform || 0) +
    (pr.tardiness || 0) +
    (pr.absences || 0) +
    (pr.cash_advance || 0)
  return Math.max(0, (pr.total_deductions || 0) - known)
}

export function buildPayrollAttendanceReport(params: {
  organization: OrganizationKey
  periodStart: Date
  periodEnd: Date
  frequency: PayrollFrequency
  holidayDates: Set<string>
  employees: Emp[]
  allLogs: any[]
  timeLogsByEmpDate: Map<string, Map<string, TimeLogRow>>
  payrollByEmployee: Map<string, PayrollRec>
  overtimeHoursByEmployee: Map<string, number>
  /** Misc deduction rows from DB tables (non-itemized types), keyed by employee id. */
  miscDeductionsFromTables?: Map<string, number>
}): PayrollAttendanceReport {
  const {
    organization,
    periodStart,
    periodEnd,
    frequency,
    holidayDates,
    employees,
    allLogs,
    timeLogsByEmpDate,
    payrollByEmployee,
    overtimeHoursByEmployee,
    miscDeductionsFromTables = new Map(),
  } = params

  const pStart = startOfDay(periodStart)
  const pEnd = startOfDay(periodEnd)
  const anchorMonth = pEnd

  const periodBusinessDays = countBusinessDaysExcludingHolidays(pStart, pEnd, holidayDates)
  const monthBusinessDays = workingDaysInCalendarMonth(anchorMonth, holidayDates)
  const { firstCutoff, secondCutoff } = workingDaysPerSemiMonthlyCutoff(pStart, pEnd, holidayDates)

  const validationIssues: ValidationIssue[] = []
  const rows: EmployeePayrollRow[] = []

  const attendancePie = { present: 0, absent: 0, leave: 0, wfh: 0 }

  for (const emp of employees) {
    const empLogs =
      organization === "pdn"
        ? allLogs.filter((l) => l.employee_id === emp.id)
        : allLogs.filter(
            (l) =>
              l.employee_id === emp.id ||
              (emp.attendance_log_userid != null && l.user_id === emp.attendance_log_userid)
          )

    const logsByDate = new Map<string, any[]>()
    empLogs.forEach((l) => {
      const date = l.work_date
      if (!logsByDate.has(date)) logsByDate.set(date, [])
      logsByDate.get(date)!.push(l)
    })

    let totalWorkingHours = 0
    let workingDaysInPeriod = 0
    let absenceDays = 0
    let leaveDays = 0
    let wfhDays = 0
    let presentDays = 0
    let remoteDays = 0
    let totalLateMinutes = 0
    let daysLate = 0
    let undertimeTotalMinutes = 0
    let earlyOutIncidents = 0

    let cur = new Date(pStart)
    while (cur <= pEnd) {
      const dateStr = format(cur, "yyyy-MM-dd")
      const dayLogs = logsByDate.get(dateStr) || []

      const tl = timeLogsByEmpDate.get(emp.id)?.get(dateStr)
      const overrideLog = dayLogs.find((l) => typeof l.mapped_status === "string")
      const statusOverride = overrideLog ? overrideLog.mapped_status : null

      const firstIn = dayLogs
        .filter(
          (l) =>
            (l.status === "time_in" || (l.is_manual && l.status !== "manual_override")) && l.timestamp
        )
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0]
      const firstOut = dayLogs
        .filter(
          (l) =>
            (l.status === "time_out" || (l.is_manual && l.status !== "manual_override")) && l.timestamp
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]

      const timeInStr = firstIn ? extractPhilippineTime(firstIn.timestamp) : null
      const timeOutStr = firstOut ? extractPhilippineTime(firstOut.timestamp) : null

      let dayLateMins = 0
      if (firstIn) {
        const timeStr = extractPhilippineTime(firstIn.timestamp)
        const [h, m] = timeStr.split(":").map(Number)
        const dObj = new Date(dateStr + "T00:00:00")
        if (
          !isWeekendDate(dObj) &&
          !holidayDates.has(dateStr) &&
          (h > 8 || (h === 8 && m >= 31))
        ) {
          dayLateMins = h * 60 + m - (8 * 60 + 30)
        }
      }

      let defaultStatus: string
      if (holidayDates.has(dateStr)) {
        defaultStatus = firstIn ? "Present" : "Holiday"
      } else if (cur.getDay() === 0 || cur.getDay() === 6) {
        defaultStatus = firstIn ? "Present" : "Weekend"
      } else {
        defaultStatus = firstIn ? "Present" : "Absent"
      }

      const finalStatus = statusOverride || defaultStatus

      if (
        ["Weekend", "On Leave", "Absent", "Holiday", "Work From Home", "Remote"].includes(
          finalStatus
        )
      ) {
        dayLateMins = 0
      }

      if (finalStatus === "Present" || finalStatus === "Remote" || finalStatus === "Work From Home") {
        let workedMinutes: number | null = null
        if (tl?.total_hours != null && tl.total_hours > 0) {
          workedMinutes = Math.round(tl.total_hours * 60)
        } else {
          workedMinutes = minutesBetweenInOut(timeInStr, timeOutStr)
        }
        if (workedMinutes != null && workedMinutes > 0) {
          totalWorkingHours += workedMinutes / 60
          workingDaysInPeriod++
        }
      }

      if (finalStatus === "Absent") absenceDays++
      if (finalStatus === "On Leave") leaveDays++
      if (finalStatus === "Work From Home") wfhDays++
      if (finalStatus === "Present") presentDays++
      if (finalStatus === "Remote") remoteDays++

      if (dayLateMins > 0) {
        totalLateMinutes += dayLateMins
        daysLate++
      }

      if (finalStatus === "Present" && !isWeekendDate(cur) && !holidayDates.has(dateStr)) {
        let worked: number | null = null
        if (tl?.total_hours != null && tl.total_hours > 0) {
          worked = Math.round(tl.total_hours * 60)
        } else {
          worked = minutesBetweenInOut(timeInStr, timeOutStr)
        }
        if (worked != null && worked > 0 && worked < EXPECTED_WORK_MINUTES) {
          undertimeTotalMinutes += EXPECTED_WORK_MINUTES - worked
        }
        const endM = parseEndMinutes(timeOutStr)
        if (
          endM != null &&
          endM < 17 * 60 &&
          worked != null &&
          worked < EXPECTED_WORK_MINUTES - EARLY_OUT_THRESHOLD_MINUTES
        ) {
          earlyOutIncidents++
        }
      }

      if (!isWeekendDate(cur) && !holidayDates.has(dateStr)) {
        if (finalStatus === "Absent") attendancePie.absent++
        else if (finalStatus === "On Leave") attendancePie.leave++
        else if (finalStatus === "Work From Home") attendancePie.wfh++
        else if (finalStatus === "Present" || finalStatus === "Remote") attendancePie.present++
      }

      cur = addDays(cur, 1)
    }

    if (workingDaysInPeriod === 0 && periodBusinessDays > 0) {
      validationIssues.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        message: "No recorded working hours in period; verify attendance or time logs.",
        severity: "warning",
      })
    }

    const pr = payrollByEmployee.get(emp.id)
    const basicSalary = pr?.basic_salary ?? 0
    const overtimePay = pr?.overtime_pay ?? 0
    const unpaidSalary = pr?.unpaid_salary ?? 0
    const reimbursement = pr?.reimbursement ?? 0
    const otH =
      overtimeHoursByEmployee.get(emp.id) ??
      estimateOvertimeHours(overtimePay, emp)

    const deductionLate = pr?.tardiness ?? 0
    const deductionAbsences = pr?.absences ?? 0
    const totalDed = pr?.total_deductions ?? 0
    const deductionUndertime = 0
    const residualOther = pr ? otherDeductions(pr) : 0
    const miscFromTables = miscDeductionsFromTables.get(emp.id) ?? 0
    /** Residual on payroll row + misc lines from deductions / employee_deductions (non-itemized). */
    const deductionOther = Math.round((residualOther + miscFromTables) * 100) / 100
    const netPay =
      pr?.net_pay ??
      Math.max(0, basicSalary + overtimePay + unpaidSalary + reimbursement - totalDed)

    const tardinessAvgMinutes = daysLate > 0 ? totalLateMinutes / daysLate : 0

    rows.push({
      employeeId: emp.id,
      employeeCode: emp.employee_code || "—",
      fullName: emp.full_name,
      payType: emp.pay_type || "—",
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      workingDaysInPeriod,
      workingDaysMonthCalendar: monthBusinessDays,
      workingDaysFirstCutoff: firstCutoff,
      workingDaysSecondCutoff: secondCutoff,
      absenceDays,
      leaveDays,
      tardinessTotalMinutes: totalLateMinutes,
      tardinessAvgMinutes: Math.round(tardinessAvgMinutes * 100) / 100,
      undertimeTotalHours: Math.round((undertimeTotalMinutes / 60) * 100) / 100,
      earlyOutIncidents,
      wfhDays,
      presentDays,
      remoteDays,
      lateDays: daysLate,
      basicSalary,
      unpaidSalary,
      reimbursement,
      overtimeHours: otH,
      overtimePay,
      deductionLate,
      deductionUndertime,
      deductionAbsences,
      deductionOther,
      totalDeductions: totalDed,
      netPay,
      payrollRecordId: pr?.id,
    })
  }

  const ec = rows.length
  const totalWorkingHours = rows.reduce((s, r) => s + r.totalWorkingHours, 0)
  const totalWorkingDaysSum = rows.reduce((s, r) => s + r.workingDaysInPeriod, 0)

  const totals = {
    employeeCount: ec,
    totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
    averageWorkingHours: ec > 0 ? Math.round((totalWorkingHours / ec) * 100) / 100 : 0,
    totalWorkingDaysSum,
    averageWorkingDays: ec > 0 ? Math.round((totalWorkingDaysSum / ec) * 100) / 100 : 0,
    totalAbsenceDays: rows.reduce((s, r) => s + r.absenceDays, 0),
    totalLeaveDays: rows.reduce((s, r) => s + r.leaveDays, 0),
    totalTardinessMinutes: rows.reduce((s, r) => s + r.tardinessTotalMinutes, 0),
    averageTardinessMinutes:
      (() => {
        const totalLateDays = rows.reduce((s, r) => s + r.lateDays, 0)
        const totalMin = rows.reduce((s, r) => s + r.tardinessTotalMinutes, 0)
        return totalLateDays > 0 ? Math.round((totalMin / totalLateDays) * 100) / 100 : 0
      })(),
    totalUndertimeHours: Math.round(rows.reduce((s, r) => s + r.undertimeTotalHours, 0) * 100) / 100,
    totalEarlyOutIncidents: rows.reduce((s, r) => s + r.earlyOutIncidents, 0),
    totalWfhDays: rows.reduce((s, r) => s + r.wfhDays, 0),
    totalOvertimeHours: Math.round(rows.reduce((s, r) => s + r.overtimeHours, 0) * 100) / 100,
    totalOvertimePay: rows.reduce((s, r) => s + r.overtimePay, 0),
    totalUnpaidSalary: rows.reduce((s, r) => s + r.unpaidSalary, 0),
    totalReimbursement: rows.reduce((s, r) => s + r.reimbursement, 0),
    totalDeductions: rows.reduce((s, r) => s + r.totalDeductions, 0),
    totalNetPay: rows.reduce((s, r) => s + r.netPay, 0),
    attendancePie,
  }

  return {
    generatedAt: new Date().toISOString(),
    organization,
    periodStart: format(pStart, "yyyy-MM-dd"),
    periodEnd: format(pEnd, "yyyy-MM-dd"),
    frequency,
    holidaysUsed: Array.from(holidayDates).sort(),
    employees: rows,
    totals,
    validationIssues,
  }
}
