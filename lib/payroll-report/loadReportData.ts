import { format } from "date-fns"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { LoadReportDataParams, OrganizationKey } from "./types"
import { mergeLogsForReport } from "./mergeLogs"
import { parseExtraHolidayInput } from "./workingDays"
import { isItemizedPayrollDeductionLabel } from "./deductionSources"

type PayrollRec = {
  id?: string
  basic_salary: number
  overtime_pay: number
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

export type LoadedReportPayload = {
  organization: OrganizationKey
  employees: {
    id: string
    full_name: string
    employee_code?: string
    pay_type?: string
    attendance_log_userid?: number | null
    daily_rate?: number
    base_salary?: number
  }[]
  allLogs: any[]
  timeLogsByEmpDate: Map<string, Map<string, {
    employee_id: string
    date: string
    time_in: string | null
    time_out: string | null
    total_hours: number | null
    overtime_hours: number | null
    status: string | null
  }>>
  payrollByEmployee: Map<string, PayrollRec>
  overtimeHoursByEmployee: Map<string, number>
  /** Non-itemized deductions from `deductions` / `employee_deductions` (or `pdn_deductions`) in the period. */
  miscDeductionsFromTables: Map<string, number>
  holidayDates: Set<string>
}

export type ReportEmployeeOption = {
  id: string
  full_name: string
  employee_code?: string
}

/** Active employees for report scope UI (same filter as full payload load). */
export async function fetchReportEmployeeList(
  supabase: SupabaseClient,
  organization: OrganizationKey
): Promise<ReportEmployeeOption[]> {
  const empTable = organization === "pdn" ? "pdn_employees" : "employees"
  const { data, error } = await supabase
    .from(empTable)
    .select("id, full_name, employee_code")
    .neq("employment_status", "Inactive")
    .order("full_name", { ascending: true })

  if (error) {
    console.error("fetchReportEmployeeList", error)
    return []
  }
  return (data || []) as ReportEmployeeOption[]
}

/** Restrict a loaded payload to the given employee ids (report + PDF scope). */
export function filterPayloadToEmployeeIds(
  payload: LoadedReportPayload,
  includeIds: string[]
): LoadedReportPayload {
  const idSet = new Set(includeIds)
  const employees = payload.employees.filter((e) => idSet.has(e.id))

  const payrollByEmployee = new Map<string, PayrollRec>()
  payload.payrollByEmployee.forEach((v, k) => {
    if (idSet.has(k)) payrollByEmployee.set(k, v)
  })

  const overtimeHoursByEmployee = new Map<string, number>()
  payload.overtimeHoursByEmployee.forEach((v, k) => {
    if (idSet.has(k)) overtimeHoursByEmployee.set(k, v)
  })

  const timeLogsByEmpDate = new Map<string, Map<string, any>>()
  payload.timeLogsByEmpDate.forEach((inner, empId) => {
    if (idSet.has(empId)) timeLogsByEmpDate.set(empId, inner)
  })

  const miscDeductionsFromTables = new Map<string, number>()
  payload.miscDeductionsFromTables.forEach((v, k) => {
    if (idSet.has(k)) miscDeductionsFromTables.set(k, v)
  })

  return {
    ...payload,
    employees,
    payrollByEmployee,
    overtimeHoursByEmployee,
    timeLogsByEmpDate,
    miscDeductionsFromTables,
  }
}

async function loadMiscDeductionsFromTables(
  supabase: SupabaseClient,
  organization: OrganizationKey,
  periodStart: Date,
  periodEnd: Date
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const startStr = format(periodStart, "yyyy-MM-dd")
  const endStr = format(periodEnd, "yyyy-MM-dd")

  const add = (employeeId: string | null | undefined, amount: number) => {
    if (!employeeId) return
    const n = Number(amount) || 0
    if (n === 0) return
    map.set(employeeId, (map.get(employeeId) || 0) + n)
  }

  if (organization === "pdn") {
    const { data, error } = await supabase
      .from("pdn_deductions")
      .select("employee_id, type, amount, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)

    if (error) console.warn("payroll-report: pdn_deductions", error.message)
    data?.forEach((row: { employee_id?: string; type?: string; amount?: number }) => {
      if (isItemizedPayrollDeductionLabel(row.type)) return
      add(row.employee_id, row.amount ?? 0)
    })
    return map
  }

  const [{ data: dedRows, error: dedErr }, { data: empDedRows, error: edErr }, { data: dtRows }] =
    await Promise.all([
      supabase
        .from("deductions")
        .select("employee_id, type, amount, created_at")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("employee_deductions")
        .select("employee_id, amount, applied_on, deduction_type_id")
        .gte("applied_on", startStr)
        .lte("applied_on", endStr),
      supabase.from("deduction_types").select("id, name"),
    ])

  if (dedErr) console.warn("payroll-report: deductions", dedErr.message)
  if (edErr) console.warn("payroll-report: employee_deductions", edErr.message)

  const typeNameById = new Map<string, string>()
  dtRows?.forEach((t: { id: string; name: string }) => typeNameById.set(t.id, t.name))

  dedRows?.forEach((row: { employee_id?: string; type?: string; amount?: number }) => {
    if (isItemizedPayrollDeductionLabel(row.type)) return
    add(row.employee_id, row.amount ?? 0)
  })

  empDedRows?.forEach(
    (row: { employee_id?: string; amount?: number; deduction_type_id?: string | null }) => {
      const nm = row.deduction_type_id ? typeNameById.get(row.deduction_type_id) : undefined
      if (isItemizedPayrollDeductionLabel(nm)) return
      add(row.employee_id, row.amount ?? 0)
    }
  )

  return map
}

export async function loadPayrollReportPayload(
  params: LoadReportDataParams
): Promise<LoadedReportPayload> {
  const { supabase, organization, periodStart, periodEnd, extraHolidayRaw } = params
  const startStr = format(periodStart, "yyyy-MM-dd")
  const endStr = format(periodEnd, "yyyy-MM-dd")

  const [{ data: official }, { data: timeLogsHoliday }, { data: pdnHoliday }] = await Promise.all([
    supabase.from("philippine_holidays").select("date, name"),
    supabase.from("time_logs").select("date").eq("status", "Holiday"),
    supabase.from("pdn_attendance_logs").select("work_date").eq("status", "Holiday"),
  ])

  const holidayDates = new Set<string>()
  official?.forEach((h) => holidayDates.add(h.date))
  timeLogsHoliday?.forEach((l) => holidayDates.add(l.date))
  pdnHoliday?.forEach((l) => holidayDates.add(l.work_date))
  parseExtraHolidayInput(extraHolidayRaw).forEach((d) => holidayDates.add(d))

  const empTable = organization === "pdn" ? "pdn_employees" : "employees"
  const logTable = organization === "pdn" ? "pdn_attendance_logs" : "attendance_logs"
  const payrollTable = organization === "pdn" ? "pdn_payroll_records" : "payroll_records"
  const reqTable = organization === "pdn" ? "pdn_requests" : "employee_requests"

  const { data: empData } = await supabase
    .from(empTable)
    .select("id, full_name, employee_code, pay_type, attendance_log_userid, daily_rate, base_salary")
    .neq("employment_status", "Inactive")

  const { data: logsData } = await supabase
    .from(logTable)
    .select("*")
    .gte("work_date", startStr)
    .lte("work_date", endStr)
    .order("timestamp", { ascending: true })

  let manualLogs: any[] | null = null
  const timeLogsByEmpDate = new Map<string, Map<string, any>>()
  if (organization !== "pdn") {
    const { data: tl } = await supabase
      .from("time_logs")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr)
    manualLogs = tl || []
    tl?.forEach((row: any) => {
      if (!timeLogsByEmpDate.has(row.employee_id)) {
        timeLogsByEmpDate.set(row.employee_id, new Map())
      }
      timeLogsByEmpDate.get(row.employee_id)!.set(row.date, row)
    })
  }

  const allLogs = mergeLogsForReport(organization, logsData || [], manualLogs)

  const { data: payrollRows } = await supabase
    .from(payrollTable)
    .select(
      "id, employee_id, period_start, period_end, basic_salary, overtime_pay, absences, tardiness, total_deductions, net_pay, sss, philhealth, pagibig, withholding_tax, loans, uniform, cash_advance"
    )
    .eq("period_start", startStr)
    .eq("period_end", endStr)

  const payrollByEmployee = new Map<string, PayrollRec>()
  payrollRows?.forEach((r: any) => {
    payrollByEmployee.set(r.employee_id, {
      id: r.id,
      basic_salary: r.basic_salary || 0,
      overtime_pay: r.overtime_pay || 0,
      absences: r.absences || 0,
      tardiness: r.tardiness || 0,
      total_deductions: r.total_deductions || 0,
      net_pay: r.net_pay || 0,
      sss: r.sss,
      philhealth: r.philhealth,
      pagibig: r.pagibig,
      withholding_tax: r.withholding_tax,
      loans: r.loans,
      uniform: r.uniform,
      cash_advance: r.cash_advance,
    })
  })

  const overtimeHoursByEmployee = new Map<string, number>()
  const { data: requests, error: reqErr } = await supabase
    .from(reqTable)
    .select("employee_id, request_type, date, time_start, time_end, status")
    .gte("date", startStr)
    .lte("date", endStr)

  if (reqErr) {
    console.warn("payroll-report: requests fetch", reqErr.message)
  }

  requests?.forEach((req: any) => {
    const ok =
      req.status === "Approved" &&
      String(req.request_type || "").toLowerCase().includes("overtime")
    if (!ok || !req.time_start || !req.time_end) return
    try {
      const start = new Date(`${req.date}T${req.time_start}`)
      const end = new Date(`${req.date}T${req.time_end}`)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (hours > 0) {
        overtimeHoursByEmployee.set(
          req.employee_id,
          (overtimeHoursByEmployee.get(req.employee_id) || 0) + hours
        )
      }
    } catch {
      /* ignore */
    }
  })

  const miscDeductionsFromTables = await loadMiscDeductionsFromTables(
    supabase,
    organization,
    periodStart,
    periodEnd
  )

  return {
    organization,
    employees: (empData || []) as LoadedReportPayload["employees"],
    allLogs,
    timeLogsByEmpDate,
    payrollByEmployee,
    overtimeHoursByEmployee,
    miscDeductionsFromTables,
    holidayDates,
  }
}
