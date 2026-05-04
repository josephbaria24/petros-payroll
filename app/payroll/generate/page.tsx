"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { format, startOfDay, startOfMonth } from "date-fns"
import {
  computeProratedBasicAndAllowance,
  deriveDailyRateForEmployee,
  fullMonthAllowanceFromEmployeeField,
} from "@/lib/payroll-proration"
import {
  type FixedPayrollSlot,
  type FixedWeekPart,
  computeFixedSplitBasicAndAllowance,
  findFixedSlotMatchingPeriod,
  getFixedSplitPeriod,
} from "@/lib/payroll-fixed-monthly"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileText,
  AlertCircle,
  X,
  XCircle,
  Check,
  Calculator,
  ArrowRight,
  Info,
  RefreshCw,
  Divide,
} from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useProtectedPage } from "../../hooks/useProtectedPage"
import {
  isMandatoryContributionType,
  isPagibigDeductionType,
  isPhilHealthDeductionType,
  isSssDeductionType,
} from "@/lib/deduction-type-classify"

/** Peso rounding between tracker total and adjustments (late + absence). */
const ATTENDANCE_APPLIED_TOLERANCE = 0.5

function hasUnderAppliedAttendanceTrackerDeductions(
  details: AttendanceDetail[],
  adjustments: EmployeeAdjustment[]
): boolean {
  for (const d of details) {
    if (d.calculatedDeduction <= ATTENDANCE_APPLIED_TOLERANCE) continue
    const adj = adjustments.find(a => a.employee_id === d.employee_id)
    const applied =
      (adj?.lateDeduction ?? 0) + (adj?.absenceDays ?? 0) * (adj?.absenceAmountPerDay ?? 0)
    if (applied < d.calculatedDeduction - ATTENDANCE_APPLIED_TOLERANCE) return true
  }
  return false
}

type OvertimeEntry = {
  date: Date
  hours: number
  ratePerHour: number
}

type EmployeeAdjustment = {
  employee_id: string
  absenceDays: number
  absenceAmountPerDay: number
  holidayDate?: Date
  holidayPay?: number
  overtimeEntries: OvertimeEntry[]
  cashAdvance?: number
  otherDeductions?: number
  withholdingTax?: number
  lateDeduction?: number
  /** Prior-period or catch-up basic pay (adds to gross). */
  unpaidSalary?: number
  /** Expense repayment (adds to gross). */
  reimbursement?: number
}

type EditingCell = {
  rowIdx: number;
  field: "time_in" | "time_out" | "status";
} | null

type AttendanceDetail = {
  employee_id: string
  employee_name: string
  totalLateMinutes: number
  calculatedDeduction: number // total
  lateDeduction: number
  absenceDeduction: number
  daysLate: number
  daysAbsent: number
  dailyRate: number
  profile_picture_url?: string | null
  logs: any[]
}

type LogEntry = {
  date: string;
  time_in: string | null;
  time_out: string | null;
  lateMins: number;
  deduction: number;
  status: string;
  in_id: string | null;
  out_id: string | null;
  is_manual: boolean;
}

type EmployeeRequest = {
  id: string
  employee_id: string
  employee_name: string
  request_type: string
  date: string
  time_start: string
  time_end: string
  reason: string
  status: string
}

type MandatoryDeductionRow = {
  employee_id: string
  full_name: string
  sss: number
  philhealth: number
  pagibig: number
  applySss: boolean
  applyPhilhealth: boolean
  applyPagibig: boolean
}

function aggregateMandatoryFromDbDeductions(
  rows: { type: string; amount: number | string }[]
): { sss: number; philhealth: number; pagibig: number } {
  let sss = 0
  let philhealth = 0
  let pagibig = 0
  for (const d of rows) {
    const raw = d.type || ""
    const amt = Number(d.amount) || 0
    if (isSssDeductionType(raw)) sss += amt
    else if (isPhilHealthDeductionType(raw)) philhealth += amt
    else if (isPagibigDeductionType(raw)) pagibig += amt
  }
  return { sss, philhealth, pagibig }
}

function scaleMandatoryAmount(value: number, factor: number): number {
  return Math.round((Number(value) || 0) * factor * 100) / 100
}

/**
 * Deduction table amounts are semi-monthly (half-month) defaults.
 * Scale when the pay run is a standard full / half / ¼-month window (fixed mode or matching date range).
 */
function getMandatoryDeductionPayRunFactor(resolvedSlot: FixedPayrollSlot | null): number {
  if (!resolvedSlot) return 1
  if (resolvedSlot === "full_month") return 2
  if (resolvedSlot === "first_half" || resolvedSlot === "second_half") return 1
  return 0.5
}

function extractPhilippineTime(timestamp: string): string {
  if (!timestamp || !timestamp.includes('T')) return "";
  return timestamp.split('T')[1].substring(0, 5);
}

function formatTo12Hour(timeStr: string | null): string {
  if (!timeStr || timeStr === "-" || timeStr === "") return "-";
  try {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]);
    const m = parts[1].substring(0, 2);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    return `${displayHours}:${m} ${ampm}`;
  } catch (e) {
    return "-";
  }
}

export default function GeneratePayrollPage() {
  useProtectedPage(["admin", "hr"], "payroll")
  const router = useRouter()
  const { activeOrganization } = useOrganization()

  // States
  const [periodStart, setPeriodStart] = useState<Date | undefined>()
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>()
  const [employeeRequests, setEmployeeRequests] = useState<EmployeeRequest[]>([])
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [employeeAdjustments, setEmployeeAdjustments] = useState<EmployeeAdjustment[]>([])
  /** Roster for Manual Adjustments employee pickers (active employees). */
  const [adjustmentEmployeeOptions, setAdjustmentEmployeeOptions] = useState<{ id: string; full_name: string }[]>([])
  const [newAdjustmentEmployeeId, setNewAdjustmentEmployeeId] = useState<string>("")
  const [attendanceDetails, setAttendanceDetails] = useState<AttendanceDetail[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceDetailOpen, setAttendanceDetailOpen] = useState(false)
  const [selectedAttendanceDetail, setSelectedAttendanceDetail] = useState<AttendanceDetail | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState("")
  const [selectedLateIds, setSelectedLateIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [attendanceDeductionConfirmOpen, setAttendanceDeductionConfirmOpen] = useState(false)
  const [mandatoryDeductionRows, setMandatoryDeductionRows] = useState<MandatoryDeductionRow[]>([])
  const [mandatoryDeductionsLoading, setMandatoryDeductionsLoading] = useState(false)
  /** Default: prorate by working days in a free-form date range. Alt: declared monthly ÷1, ÷2, ÷4. */
  const [periodConfigMode, setPeriodConfigMode] = useState<"date_range" | "fixed_monthly">("date_range")
  const [fixedMonthAnchor, setFixedMonthAnchor] = useState<Date>(() => startOfMonth(new Date()))
  const [fixedSlot, setFixedSlot] = useState<FixedPayrollSlot>("full_month")
  const [fixedWeekPart, setFixedWeekPart] = useState<FixedWeekPart>(1)

  const fetchEmployees = async () => {useState(false)}

  const pendingRequests = employeeRequests.filter(r => r.status === "Pending")
  const approvedRequests = employeeRequests.filter(r => r.status === "Approved")

  /** Canonical pay run for salary + mandatory scaling (fixed UI or date range that exactly matches a standard window). */
  const resolvedPayRunSlot = useMemo((): FixedPayrollSlot | null => {
    if (!periodStart || !periodEnd) return null
    if (periodConfigMode === "fixed_monthly") return fixedSlot
    return findFixedSlotMatchingPeriod(periodStart, periodEnd)?.slot ?? null
  }, [periodConfigMode, fixedSlot, periodStart, periodEnd])

  const mandatoryPayRunScaleHint = useMemo(() => {
    const f = getMandatoryDeductionPayRunFactor(resolvedPayRunSlot)
    if (!resolvedPayRunSlot) {
      return "This period is not a standard full/half/¼-month window — table amounts are ×1 (no pay-run scaling)."
    }
    if (f === 2) return "Full-month run: mandatory amounts ×2 vs half-month table."
    if (f === 1) return "Half-month run: ×1 vs half-month table."
    return "Four-part month (¼ run): ×½ vs half-month table."
  }, [resolvedPayRunSlot])

  // Active employees for adjustment pickers
  useEffect(() => {
    if (!activeOrganization) {
      setAdjustmentEmployeeOptions([])
      return
    }
    let cancelled = false
    const table = activeOrganization === "pdn" ? "pdn_employees" : "employees"
    void (async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id, full_name")
        .neq("employment_status", "Inactive")
        .order("full_name", { ascending: true })
      if (cancelled) return
      if (error) {
        console.error(error)
        return
      }
      setAdjustmentEmployeeOptions(
        (data || []).map((e: { id: string; full_name: string | null }) => ({
          id: e.id,
          full_name: e.full_name || "Unknown",
        }))
      )
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrganization])

  // Fetch requests when period changes
  useEffect(() => {
    if (periodStart && periodEnd) {
      fetchEmployeeRequests()
      fetchAttendanceAndCalculateLates()
    } else {
      setEmployeeRequests([])
      setAttendanceDetails([])
      setEmployeeAdjustments([])
    }
  }, [periodStart, periodEnd, activeOrganization])

  useEffect(() => {
    if (periodConfigMode !== "fixed_monthly") return
    const y = fixedMonthAnchor.getFullYear()
    const m = fixedMonthAnchor.getMonth()
    const { start, end } = getFixedSplitPeriod(y, m, fixedSlot, fixedWeekPart)
    setPeriodStart(start)
    setPeriodEnd(end)
  }, [periodConfigMode, fixedMonthAnchor, fixedSlot, fixedWeekPart])

  useEffect(() => {
    if (!periodStart || !periodEnd || !activeOrganization) {
      setMandatoryDeductionRows([])
      setMandatoryDeductionsLoading(false)
      return
    }
    const pStart = periodStart
    const pEnd = periodEnd
    let cancelled = false
    setMandatoryDeductionRows([])
    setMandatoryDeductionsLoading(true)
    async function loadMandatoryDeductions() {
      try {
        const empTable = activeOrganization === "pdn" ? "pdn_employees" : "employees"
        const dedTable = activeOrganization === "pdn" ? "pdn_deductions" : "deductions"
        const { data: emps } = await supabase
          .from(empTable)
          .select("id, full_name, base_salary")
          .neq("employment_status", "Inactive")
        const { data: deds } = await supabase.from(dedTable).select("*")
        if (cancelled) return
        const resolvedSlot =
          periodConfigMode === "fixed_monthly"
            ? fixedSlot
            : findFixedSlotMatchingPeriod(pStart, pEnd)?.slot ?? null
        const payRunFactor = getMandatoryDeductionPayRunFactor(resolvedSlot)
        const next: MandatoryDeductionRow[] = (emps || [])
          .filter((e) => e.base_salary)
          .map((emp) => {
            const empDeds = (deds || []).filter((d) => d.employee_id === emp.id)
            const { sss, philhealth, pagibig } = aggregateMandatoryFromDbDeductions(empDeds)
            return {
              employee_id: emp.id,
              full_name: emp.full_name || "Unknown",
              sss: scaleMandatoryAmount(sss, payRunFactor),
              philhealth: scaleMandatoryAmount(philhealth, payRunFactor),
              pagibig: scaleMandatoryAmount(pagibig, payRunFactor),
              applySss: true,
              applyPhilhealth: true,
              applyPagibig: true,
            }
          })
        setMandatoryDeductionRows(next)
      } catch (e) {
        console.error(e)
        if (!cancelled) toast.error("Could not load deduction defaults")
      } finally {
        if (!cancelled) setMandatoryDeductionsLoading(false)
      }
    }
    void loadMandatoryDeductions()
    return () => {
      cancelled = true
    }
  }, [periodStart, periodEnd, activeOrganization, periodConfigMode, fixedSlot])

  const patchMandatoryDeductionRow = (employeeId: string, patch: Partial<MandatoryDeductionRow>) => {
    setMandatoryDeductionRows((prev) =>
      prev.map((r) => (r.employee_id === employeeId ? { ...r, ...patch } : r))
    )
  }

  const reloadMandatoryDeductionsFromDb = async () => {
    if (!periodStart || !periodEnd || !activeOrganization) {
      toast.error("Select a period first")
      return
    }
    setMandatoryDeductionsLoading(true)
    try {
      const empTable = activeOrganization === "pdn" ? "pdn_employees" : "employees"
      const dedTable = activeOrganization === "pdn" ? "pdn_deductions" : "deductions"
      const { data: emps } = await supabase
        .from(empTable)
        .select("id, full_name, base_salary")
        .neq("employment_status", "Inactive")
      const { data: deds } = await supabase.from(dedTable).select("*")
      const resolvedSlot =
        periodConfigMode === "fixed_monthly"
          ? fixedSlot
          : findFixedSlotMatchingPeriod(periodStart, periodEnd)?.slot ?? null
      const payRunFactor = getMandatoryDeductionPayRunFactor(resolvedSlot)
      const next: MandatoryDeductionRow[] = (emps || [])
        .filter((e) => e.base_salary)
        .map((emp) => {
          const empDeds = (deds || []).filter((d) => d.employee_id === emp.id)
          const { sss, philhealth, pagibig } = aggregateMandatoryFromDbDeductions(empDeds)
          return {
            employee_id: emp.id,
            full_name: emp.full_name || "Unknown",
            sss: scaleMandatoryAmount(sss, payRunFactor),
            philhealth: scaleMandatoryAmount(philhealth, payRunFactor),
            pagibig: scaleMandatoryAmount(pagibig, payRunFactor),
            applySss: true,
            applyPhilhealth: true,
            applyPagibig: true,
          }
        })
      setMandatoryDeductionRows(next)
      toast.success("Deductions reset from database")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reload deductions")
    } finally {
      setMandatoryDeductionsLoading(false)
    }
  }

  async function fetchEmployeeRequests() {
    if (!periodStart || !periodEnd) return
    const { data, error } = await supabase
      .from(activeOrganization === "pdn" ? "pdn_requests" : "employee_requests")
      .select("*")
      .gte("date", format(periodStart, "yyyy-MM-dd"))
      .lte("date", format(periodEnd, "yyyy-MM-dd"))

    if (!error && data) {
      setEmployeeRequests(data as EmployeeRequest[])
    }
  }

  async function fetchAttendanceAndCalculateLates() {
    if (!periodStart || !periodEnd) return
    setAttendanceLoading(true)
    
    try {
      const startStr = format(periodStart, "yyyy-MM-dd")
      const endStr = format(periodEnd, "yyyy-MM-dd")
      
      const empTable = activeOrganization === "pdn" ? "pdn_employees" : "employees"
      const logTable = activeOrganization === "pdn" ? "pdn_attendance_logs" : "attendance_logs"
      const manualLogTable = "time_logs"

      const { data: empData } = await supabase.from(empTable).select("id, full_name, base_salary, daily_rate, working_days, pay_type, attendance_log_userid, profile_picture_url").neq("employment_status", "Inactive")
      const { data: logsData } = await supabase.from(logTable).select("*").gte("work_date", startStr).lte("work_date", endStr).order("timestamp", { ascending: true })
      
      let allLogs = logsData || []
      if (activeOrganization !== "pdn") {
        const { data: manualLogs } = await supabase.from(manualLogTable).select("*").gte("date", startStr).lte("date", endStr)
        const formattedManual: any[] = []
        
        manualLogs?.forEach(m => {
          let pushed = false;
          if (m.time_in) {
            formattedManual.push({
              id: m.id,
              employee_id: m.employee_id,
              work_date: m.date,
              timestamp: `${m.date}T${m.time_in}:00+00:00`,
              status: "time_in",
              is_manual: true,
              mapped_status: m.status
            })
            pushed = true;
          }
          if (m.time_out) {
            formattedManual.push({
              id: m.id,
              employee_id: m.employee_id,
              work_date: m.date,
              timestamp: `${m.date}T${m.time_out}:00+00:00`,
              status: "time_out",
              is_manual: true,
              mapped_status: m.status
            })
            pushed = true;
          }
          if (!pushed && m.status) {
            // A pure status override without timestamps
            formattedManual.push({
              id: m.id,
              employee_id: m.employee_id,
              work_date: m.date,
              timestamp: null,
              status: "manual_override",
              is_manual: true,
              mapped_status: m.status
            })
          }
        })
        allLogs = [...allLogs, ...formattedManual]
      } else {
        // For PDN biometric records, each record HAS both timestamp and timeout.
        // We need to split them into virtual "in" and "out" events for the logic below.
        const pdnVirtualLogs: any[] = []
        logsData?.forEach(cl => {
          let pushed = false;
          if (cl.timestamp) {
            pdnVirtualLogs.push({ ...cl, status: "time_in", mapped_status: cl.status })
            pushed = true;
          }
          if (cl.timeout) {
            pdnVirtualLogs.push({ ...cl, timestamp: cl.timeout, status: "time_out", mapped_status: cl.status })
            pushed = true;
          }
          if (!pushed && cl.status) {
            pdnVirtualLogs.push({ ...cl, mapped_status: cl.status })
          }
        })
        allLogs = pdnVirtualLogs
      }

      const attendanceMap = new Map<string, AttendanceDetail>()
      
      empData?.forEach(emp => {
        let empLogs = activeOrganization === "pdn" 
          ? allLogs.filter(l => l.employee_id === emp.id)
          : allLogs.filter(l => l.employee_id === emp.id || (emp.attendance_log_userid && l.user_id === emp.attendance_log_userid))

        const logsByDate = new Map<string, any[]>()
        empLogs.forEach(l => {
          const date = l.work_date
          if (!logsByDate.has(date)) logsByDate.set(date, [])
          logsByDate.get(date)!.push(l)
        })

        // Daily rate for late/absence: derived from base pay (monthly/semi ignore stale daily_rate field)
        const dailyRate = deriveDailyRateForEmployee(emp)

        let totalLateMinutes = 0
        let daysLate = 0
        let daysAbsent = 0
        const fullPeriodLogs: any[] = []
        let current = new Date(periodStart);
        
        while (current <= periodEnd) {
          const dateStr = format(current, "yyyy-MM-dd")
          const dayLogs = logsByDate.get(dateStr) || []
          
          const overrideLog = dayLogs.find(l => typeof l.mapped_status === 'string');
          const statusOverride = overrideLog ? overrideLog.mapped_status : null;

          const firstIn = dayLogs.filter(l => (l.status === "time_in" || (l.is_manual && l.status !== "manual_override")) && l.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0]
          const firstOut = dayLogs.filter(l => (l.status === "time_out" || (l.is_manual && l.status !== "manual_override")) && l.timestamp).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
          
          let dayLateMins = 0
          if (firstIn) {
            const timeStr = extractPhilippineTime(firstIn.timestamp)
            const [h, m] = timeStr.split(":").map(Number)
            const dStr = format(current, "yyyy-MM-dd")
            const dObj = new Date(dStr)
            if (dObj.getDay() !== 0 && dObj.getDay() !== 6 && (h > 8 || (h === 8 && m >= 31))) {
              dayLateMins = (h * 60 + m) - (8 * 60 + 30)
            }
          }

          const defaultStatus = firstIn ? "Present" : (current.getDay() === 0 || current.getDay() === 6 ? "Weekend" : "Absent");
          const finalStatus = statusOverride || defaultStatus;

          // Nullify late minutes if the day is effectively excused or not counted as a regular work day
          if (["Weekend", "On Leave", "Absent", "Holiday", "Work From Home", "Remote"].includes(finalStatus)) {
            dayLateMins = 0;
          }

          let dayDeduction = 0;
          if (finalStatus === "Absent") {
            dayDeduction = dailyRate;
            daysAbsent++;
          } else if (dayLateMins > 0) {
            dayDeduction = (dayLateMins / 60) * (dailyRate / 8);
            totalLateMinutes += dayLateMins;
            daysLate++;
          }

          fullPeriodLogs.push({
            date: dateStr,
            time_in: firstIn ? extractPhilippineTime(firstIn.timestamp) : null,
            time_out: firstOut ? extractPhilippineTime(firstOut.timestamp) : null,
            lateMins: dayLateMins,
            deduction: dayDeduction,
            status: finalStatus,
            in_id: overrideLog?.id || firstIn?.id || null,
            out_id: firstOut?.id || null,
            is_manual: overrideLog?.is_manual || firstIn?.is_manual || firstOut?.is_manual || false
          })
          current.setDate(current.getDate() + 1);
        }
        
        const lateDeduction = (dailyRate / 8) * (totalLateMinutes / 60)
        const absenceDeduction = dailyRate * daysAbsent
        const totalDeduction = lateDeduction + absenceDeduction

        attendanceMap.set(emp.id, {
          employee_id: emp.id,
          employee_name: emp.full_name,
          totalLateMinutes,
          calculatedDeduction: Math.round(totalDeduction * 100) / 100,
          lateDeduction: Math.round(lateDeduction * 100) / 100,
          absenceDeduction: Math.round(absenceDeduction * 100) / 100,
          daysLate,
          daysAbsent,
          dailyRate: Math.round(dailyRate * 100) / 100,
          profile_picture_url: emp.profile_picture_url,
          logs: fullPeriodLogs
        })
      })

      setAttendanceDetails(Array.from(attendanceMap.values()))
    } catch (error) {
      console.error("Error fetching attendance:", error)
      toast.error("Failed to load attendance logs")
    } finally {
      setAttendanceLoading(false)
    }
  }

  const handleUpdateLog = async (log: LogEntry, field: string, newValue: string) => {
    if (!selectedAttendanceDetail) return
    const toastId = toast.loading("Updating log...")
    
    try {
      const isPDN = activeOrganization === "pdn"
      const dateStr = log.date
      
      if (isPDN) {
        if (log.in_id || log.out_id) {
          const { error } = await supabase.from("pdn_attendance_logs").update({
            [field === "time_in" ? "timestamp" : (field === "time_out" ? "timeout" : "status")]: 
              field === "status" ? newValue : `${dateStr}T${newValue}:00+00:00`
          }).eq("id", log.in_id || log.out_id)
          if (error) throw error
        } else {
          // Empty day for PDN -> insert
          const { error } = await supabase.from("pdn_attendance_logs").insert({
            employee_id: selectedAttendanceDetail.employee_id,
            work_date: dateStr,
            full_name: selectedAttendanceDetail.employee_name || "Unknown",
            status: field === "status" ? newValue : "Present",
            timestamp: field === "time_in" ? `${dateStr}T${newValue}:00+00:00` : null,
            timeout: field === "time_out" ? `${dateStr}T${newValue}:00+00:00` : null
          })
          if (error) throw error
        }
      } else {
        // Non-PDN (Regular) -> Use time_logs to override / capture manual changes
        const { data: existing } = await supabase
          .from("time_logs")
          .select("id")
          .eq("employee_id", selectedAttendanceDetail.employee_id)
          .eq("date", dateStr)
          .maybeSingle()

        const isFullDayStatus = field === "status" && ["On Leave", "Work From Home", "Remote"].includes(newValue)

        if (existing) {
          const { error } = await supabase
            .from("time_logs")
            .update({ 
               [field]: newValue,
               ...(isFullDayStatus ? { total_hours: 8 } : {})
            })
            .eq("id", existing.id)
          if (error) throw error
        } else {
          // If no time_log exists, create it using the base data from the current log preview
          const timeIn = field === "time_in" ? newValue : (log.time_in || null)
          const timeOut = field === "time_out" ? newValue : (log.time_out || null)
          const status = field === "status" ? newValue : (["Absent", "Weekend"].includes(log.status) ? "Present" : log.status)

          const { error } = await supabase
            .from("time_logs")
            .insert({
              employee_id: selectedAttendanceDetail.employee_id,
              date: dateStr,
              time_in: timeIn,
              time_out: timeOut,
              status: status,
              total_hours: ["On Leave", "Work From Home", "Remote"].includes(status) ? 8 : 0
            })
          if (error) throw error
        }
      }

      toast.success("Log updated", { id: toastId })
      setEditingCell(null)
      // Refresh calculations
      await fetchAttendanceAndCalculateLates()
      
      // Update selected detail to show latest
      // We need to find the employee in the new results
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  useEffect(() => {
    // When attendanceDetails change, if modal is open, refresh selectedAttendanceDetail
    if (attendanceDetailOpen && selectedAttendanceDetail) {
      const updated = attendanceDetails.find(d => d.employee_id === selectedAttendanceDetail.employee_id)
      if (updated) setSelectedAttendanceDetail(updated)
    }
  }, [attendanceDetails])

  const applyAttendanceDeductions = () => {
    if (selectedLateIds.size === 0) {
      toast.error("No employees selected")
      return
    }
    const toApply = attendanceDetails.filter(d => selectedLateIds.has(d.employee_id) && d.calculatedDeduction > 0)
    toApply.forEach(detail => {
      const idx = employeeAdjustments.findIndex(a => a.employee_id === detail.employee_id)
      if (idx !== -1) {
        const updated = [...employeeAdjustments]
        updated[idx].lateDeduction = detail.lateDeduction
        updated[idx].absenceDays = detail.daysAbsent
        updated[idx].absenceAmountPerDay = detail.dailyRate
        setEmployeeAdjustments(updated)
      } else {
        setEmployeeAdjustments(prev => [...prev, {
          employee_id: detail.employee_id,
          absenceDays: detail.daysAbsent,
          absenceAmountPerDay: detail.dailyRate,
          overtimeEntries: [],
          lateDeduction: detail.lateDeduction,
          unpaidSalary: 0,
          reimbursement: 0,
        }])
      }
    })
    toast.success(`Applied attendance deductions for ${toApply.length} employee(s)`)
    setSelectedLateIds(new Set())
  }

  const lateEmployees = useMemo(() => attendanceDetails.filter(d => d.calculatedDeduction > 0), [attendanceDetails])

  const toggleLateSelection = (id: string) => {
    setSelectedLateIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllLates = () => {
    if (selectedLateIds.size === lateEmployees.length) {
      setSelectedLateIds(new Set())
    } else {
      setSelectedLateIds(new Set(lateEmployees.map(d => d.employee_id)))
    }
  }

  // Requests logic
  const handleApproveRequest = async (requestId: string) => {
    const { error } = await supabase
      .from(activeOrganization === "pdn" ? "pdn_requests" : "employee_requests")
      .update({ status: "Approved" })
      .eq("id", requestId)
    if (!error) {
      toast.success("Request approved")
      fetchEmployeeRequests()
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await supabase
      .from(activeOrganization === "pdn" ? "pdn_requests" : "employee_requests")
      .update({ status: "Rejected" })
      .eq("id", requestId)
    if (!error) {
      toast.error("Request rejected")
      fetchEmployeeRequests()
    }
  }

  const handleRequestSelect = (id: string) => {
    setSelectedRequests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const addApprovedRequestsToAdjustments = () => {
    const requestsToUse = employeeRequests.filter(r => selectedRequests.includes(r.id))
    const newAdjustments = [...employeeAdjustments]

    requestsToUse.forEach(req => {
      let adjIdx = newAdjustments.findIndex(a => a.employee_id === req.employee_id)
      if (adjIdx === -1) {
        newAdjustments.push({
          employee_id: req.employee_id,
          absenceDays: 0,
          absenceAmountPerDay: 0,
          overtimeEntries: [],
          unpaidSalary: 0,
          reimbursement: 0,
        })
        adjIdx = newAdjustments.length - 1
      }

      const adj = newAdjustments[adjIdx]
      if (req.request_type === "Overtime") {
        const start = new Date(`${req.date}T${req.time_start}`)
        const end = new Date(`${req.date}T${req.time_end}`)
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        
        const existingOt = adj.overtimeEntries.find(ot => format(ot.date, "yyyy-MM-dd") === req.date)
        if (!existingOt) {
          adj.overtimeEntries.push({ date: new Date(req.date), hours, ratePerHour: 0 })
        }
      }
    })

    setEmployeeAdjustments(newAdjustments)
    setSelectedRequests([])
    toast.success("Adjustments updated from requests")
  }

  // Adjustments logic
  const addEmployeeAdjustment = () => {
    if (!newAdjustmentEmployeeId) {
      toast.error("Select an employee to add")
      return
    }
    if (employeeAdjustments.some((a) => a.employee_id === newAdjustmentEmployeeId)) {
      toast.error("That employee is already in the adjustments list")
      return
    }
    setEmployeeAdjustments((prev) => [
      ...prev,
      {
        employee_id: newAdjustmentEmployeeId,
        absenceDays: 0,
        absenceAmountPerDay: 0,
        overtimeEntries: [],
        unpaidSalary: 0,
        reimbursement: 0,
      },
    ])
    setNewAdjustmentEmployeeId("")
  }

  const updateEmployeeAdjustment = (index: number, field: keyof EmployeeAdjustment, value: any) => {
    if (field === "employee_id" && typeof value === "string") {
      if (employeeAdjustments.some((a, i) => i !== index && a.employee_id === value)) {
        toast.error("That employee already has an adjustment row")
        return
      }
    }
    const updated = [...employeeAdjustments]
    updated[index] = { ...updated[index], [field]: value }
    setEmployeeAdjustments(updated)
  }

  const adjustmentDisplayName = (employeeId: string) =>
    attendanceDetails.find((d) => d.employee_id === employeeId)?.employee_name ||
    adjustmentEmployeeOptions.find((e) => e.id === employeeId)?.full_name ||
    "Unknown Employee"

  const runBulkGeneratePayroll = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select a period")
      return
    }

    const toastId = toast.loading("Generating payroll...")
    const { data: { user } } = await supabase.auth.getUser()
    const creatorId = user?.id

    try {
      const payrollTable = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
      
      const { error: deleteErr } = await supabase.from(payrollTable).delete()
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
      if (deleteErr) {
        toast.error(deleteErr.message || "Could not clear existing payroll for this period", { id: toastId })
        return
      }

      // Fetch employees and deductions
      const empTable = activeOrganization === "pdn" ? "pdn_employees" : "employees"
      const dedTable = activeOrganization === "pdn" ? "pdn_deductions" : "deductions"
      
      const { data: allEmployees, error: empFetchErr } = await supabase.from(empTable).select("*")
      if (empFetchErr) {
        toast.error(empFetchErr.message || "Could not load employees", { id: toastId })
        return
      }
      const { data: allDeductions } = await supabase.from(dedTable).select("*")

      const periodSliceStart = startOfDay(periodStart)
      const periodSliceEnd = startOfDay(periodEnd)
      const resolvedSlotForRun =
        periodConfigMode === "fixed_monthly"
          ? fixedSlot
          : findFixedSlotMatchingPeriod(periodSliceStart, periodSliceEnd)?.slot ?? null
      const mandatoryPayRunFactor = getMandatoryDeductionPayRunFactor(resolvedSlotForRun)

      const recordsToInsert = []
      for (const emp of allEmployees || []) {
        if (!emp.base_salary) continue

        const pt = String(emp.pay_type || "").toLowerCase()
        /** Standard full/half/¼-month window: ×1 / ×½ / ×¼ of monthly equivalent — not prorated by day count. */
        const useDeclaredMonthlySplits =
          resolvedSlotForRun !== null && (pt === "monthly" || pt === "semi-monthly")
        const monthlyEquivalent =
          pt === "semi-monthly" ? (Number(emp.base_salary) || 0) * 2 : Number(emp.base_salary) || 0

        const { basicSalary, allowance } = useDeclaredMonthlySplits
          ? computeFixedSplitBasicAndAllowance(
              monthlyEquivalent,
              fullMonthAllowanceFromEmployeeField(emp.allowance),
              resolvedSlotForRun
            )
          : computeProratedBasicAndAllowance(emp, periodSliceStart, periodSliceEnd)

        const empDeductions = (allDeductions || []).filter(d => d.employee_id === emp.id)
        let loans = 0
        empDeductions.forEach(d => {
          if (isMandatoryContributionType(String(d.type))) return
          loans += Number(d.amount) || 0
        })

        const mdRow = mandatoryDeductionRows.find((r) => r.employee_id === emp.id)
        let sss = 0
        let philhealth = 0
        let pagibig = 0
        if (mdRow) {
          sss = mdRow.applySss ? Math.round((Number(mdRow.sss) || 0) * 100) / 100 : 0
          philhealth = mdRow.applyPhilhealth ? Math.round((Number(mdRow.philhealth) || 0) * 100) / 100 : 0
          pagibig = mdRow.applyPagibig ? Math.round((Number(mdRow.pagibig) || 0) * 100) / 100 : 0
        } else {
          const m = aggregateMandatoryFromDbDeductions(empDeductions)
          sss = scaleMandatoryAmount(m.sss, mandatoryPayRunFactor)
          philhealth = scaleMandatoryAmount(m.philhealth, mandatoryPayRunFactor)
          pagibig = scaleMandatoryAmount(m.pagibig, mandatoryPayRunFactor)
        }

        const adj = employeeAdjustments.find(a => a.employee_id === emp.id)
        const late = adj?.lateDeduction || 0
        const absence = (adj?.absenceDays || 0) * (adj?.absenceAmountPerDay || 0)
        const overtime = (adj?.overtimeEntries || []).reduce((s, ot) => s + (ot.hours * ot.ratePerHour), 0)
        const holiday = adj?.holidayPay || 0
        const other = adj?.otherDeductions || 0
        const cashAdvance = adj?.cashAdvance || 0
        const withholding = adj?.withholdingTax || 0
        const unpaidSalary = Math.round((Number(adj?.unpaidSalary) || 0) * 100) / 100
        const reimbursement = Math.round((Number(adj?.reimbursement) || 0) * 100) / 100

        const totalDeductions = sss + philhealth + pagibig + loans + absence + late + other + cashAdvance + withholding
        const gross = basicSalary + overtime + holiday + allowance
        
        recordsToInsert.push({
          employee_id: emp.id,
          period_start: format(periodStart, "yyyy-MM-dd"),
          period_end: format(periodEnd, "yyyy-MM-dd"),
          basic_salary: basicSalary,
          overtime_pay: overtime,
          holiday_pay: holiday,
          allowances: allowance,
          absences: absence,
          tardiness: late,
          sss, philhealth, pagibig,
          loans: loans + other,
          withholding_tax: withholding,
          cash_advance: cashAdvance,
          unpaid_salary: unpaidSalary,
          reimbursement: reimbursement,
          gross_pay: gross + unpaidSalary + reimbursement,
          total_deductions: totalDeductions,
          net_pay: (gross + unpaidSalary + reimbursement) - totalDeductions,
          status: "Pending Payment",
          creator_id: creatorId
        })
      }

      if (recordsToInsert.length === 0) {
        toast.error(
          "No payroll rows to save. Each active employee needs a non-zero base salary (check PDN employee profiles).",
          { id: toastId }
        )
        return
      }

      const { error: insertErr } = await supabase.from(payrollTable).insert(recordsToInsert)
      if (insertErr) {
        toast.error(insertErr.message || "Failed to save payroll records", { id: toastId })
        return
      }
      toast.success("Payroll generated successfully", { id: toastId })
      router.push("/payroll")
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  const handleBulkGeneratePayroll = () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select a period")
      return
    }
    if (hasUnderAppliedAttendanceTrackerDeductions(attendanceDetails, employeeAdjustments)) {
      setAttendanceDeductionConfirmOpen(true)
      return
    }
    void runBulkGeneratePayroll()
  }

  const confirmGenerateDespiteAttendance = () => {
    setAttendanceDeductionConfirmOpen(false)
    void runBulkGeneratePayroll()
  }

  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-background text-foreground overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 lg:px-6 lg:py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50 gap-4 sm:gap-2">
        <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-10 lg:w-10" onClick={() => router.push("/payroll")}>
            <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>
          <div>
            <h1 className="text-lg lg:text-2xl font-black tracking-tight leading-tight">Generate Payroll</h1>
            <p className="text-[9px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest hidden xs:block">
              Payroll Management <ArrowRight className="inline h-2 w-2 lg:h-3 lg:w-3" /> New Period
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <Badge variant="outline" className="px-2 py-0.5 lg:px-3 lg:py-1 bg-primary/5 text-primary border-primary/20 font-bold text-[10px] lg:text-xs">
            {activeOrganization?.toUpperCase() || "PETROSPHERE"}
          </Badge>
          <Button className="bg-primary hover:bg-primary/90 font-bold shadow-lg h-8 lg:h-10 text-xs lg:text-sm px-3 lg:px-4 shrink-0" onClick={handleBulkGeneratePayroll}>
            <Calculator className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
            <span className="hidden xs:inline">Generate All</span>
            <span className="xs:hidden">Generate</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
        {/* Sidebar Config */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-muted/20 p-4 lg:p-6 overflow-y-auto space-y-6 lg:space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Period Configuration</h3>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Period mode</Label>
              <Select
                value={periodConfigMode}
                onValueChange={(v) => setPeriodConfigMode(v as "date_range" | "fixed_monthly")}
              >
                <SelectTrigger className="h-11 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_range">Date range (prorate by working days)</SelectItem>
                  <SelectItem value="fixed_monthly">Fixed monthly (½ or ¼ of declared monthly)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Fixed mode sets the attendance window from month + pay slot. Monthly employees get declared monthly
                salary ×1, ×½, or ×¼ (not based on working-day count). Other pay types in the same window are still
                prorated by scheduled days.
              </p>
            </div>

            {periodConfigMode === "date_range" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Period Start</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-bold h-11", !periodStart && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {periodStart ? format(periodStart, "PPP") : "Select Start Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={periodStart} onSelect={setPeriodStart} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Period End</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-bold h-11", !periodEnd && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {periodEnd ? format(periodEnd, "PPP") : "Select End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={periodEnd} onSelect={setPeriodEnd} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Calendar month</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-bold h-11">
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {format(fixedMonthAnchor, "MMMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fixedMonthAnchor}
                        onSelect={(d) => d && setFixedMonthAnchor(startOfMonth(d))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pay run</Label>
                  <Select value={fixedSlot} onValueChange={(v) => setFixedSlot(v as FixedPayrollSlot)}>
                    <SelectTrigger className="h-11 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_month">Full month (×1)</SelectItem>
                      <SelectItem value="first_half">Half month — 1st to 15th (×½)</SelectItem>
                      <SelectItem value="second_half">Half month — 16th to month end (×½)</SelectItem>
                      <SelectItem value="weekly_fraction">Four-part month — ¼ of monthly (parts 1–4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fixedSlot === "weekly_fraction" && (
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Which part</Label>
                    <Select
                      value={String(fixedWeekPart)}
                      onValueChange={(v) => setFixedWeekPart(Number(v) as FixedWeekPart)}
                    >
                      <SelectTrigger className="h-11 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Part 1 of 4</SelectItem>
                        <SelectItem value="2">Part 2 of 4</SelectItem>
                        <SelectItem value="3">Part 3 of 4</SelectItem>
                        <SelectItem value="4">Part 4 of 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {periodStart && periodEnd && (
                  <p className="text-[10px] font-bold text-primary/80 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                    {fixedSlot === "weekly_fraction" ? (
                      <>
                        Pay period: Part {fixedWeekPart} of 4 — {format(fixedMonthAnchor, "MMMM yyyy")}
                      </>
                    ) : (
                      <>
                        Attendance window: {format(periodStart, "MMM d")} – {format(periodEnd, "MMM d, yyyy")}
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-border">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Summary Preview</h3>
            <div className="space-y-3">
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-[10px] font-bold text-primary/60 uppercase">Total Items</p>
                <p className="text-xl font-black">{attendanceDetails.length} Employees</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase text-red-600">Late Deductions</p>
                <p className="text-xl font-black text-red-600">₱{attendanceDetails.reduce((s, a) => s + a.calculatedDeduction, 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-blue-900 leading-relaxed">
              <strong>Date range:</strong> base pay follows scheduled working days in the period.{" "}
              <strong>Fixed monthly:</strong> monthly employees get ×1, ×½, or ×¼ of declared monthly (four-part month =
              one of four equal slices, not calendar-week pay); allowance matches. 8:31 AM marks late deductions.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:overflow-y-auto p-4 lg:p-8 relative">
          <Tabs defaultValue="attendance" className="w-full">
            <div className="overflow-x-auto pb-2 mb-6 scrollbar-hide">
              <TabsList className="flex w-max lg:grid lg:w-fit lg:grid-cols-4 bg-muted/30 p-1">
              <TabsTrigger value="requests" className="font-bold px-4 lg:px-6">
                Requests 
                {pendingRequests.length > 0 && <Badge className="ml-2 bg-red-500">{pendingRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="attendance" className="font-bold px-4 lg:px-6">Attendance</TabsTrigger>
              <TabsTrigger value="deductions" className="font-bold px-4 lg:px-6">Deductions</TabsTrigger>
              <TabsTrigger value="adjustments" className="font-bold px-4 lg:px-6">Adjustments</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="requests" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/5">
                  <div>
                    <CardTitle>Employee Requests</CardTitle>
                    <CardDescription>Review OT and adjustment requests for this period</CardDescription>
                  </div>
                  {selectedRequests.length > 0 && (
                    <Button variant="outline" size="sm" onClick={addApprovedRequestsToAdjustments}>
                      Add {selectedRequests.length} to Adjustments
                    </Button>
                  )}
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12 text-center"></TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="text-center">
                          <input 
                            type="checkbox" 
                            disabled={req.status !== "Approved"}
                            checked={selectedRequests.includes(req.id)}
                            onChange={() => handleRequestSelect(req.id)}
                            className="rounded border-border"
                          />
                        </TableCell>
                        <TableCell className="font-bold">{req.employee_name}</TableCell>
                        <TableCell><Badge variant="outline">{req.request_type}</Badge></TableCell>
                        <TableCell>{req.date}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{req.reason}</TableCell>
                        <TableCell>
                          <Badge variant={req.status === "Approved" ? "default" : req.status === "Pending" ? "outline" : "destructive"}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "Pending" && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="text-green-600 h-8 w-8 p-0" onClick={() => handleApproveRequest(req.id)}><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => handleRejectRequest(req.id)}><XCircle className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {employeeRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Select a period to load requests</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
               </Card>
             </TabsContent>

             <TabsContent value="attendance" className="space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                 <div>
                   <h2 className="text-lg lg:text-xl font-black">Attendance Tracker</h2>
                   <p className="text-[11px] lg:text-sm text-muted-foreground font-medium">Automatic deduction calculation (Lates & Absences)</p>
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 text-xs font-bold" onClick={fetchAttendanceAndCalculateLates} disabled={attendanceLoading}>
                      <TrendingUp className="h-3.5 w-3.5 mr-2" />
                      Recalculate
                    </Button>
                    <Button size="sm" className="flex-1 sm:flex-none h-9 text-xs font-bold" onClick={applyAttendanceDeductions} disabled={selectedLateIds.size === 0}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                      Apply Selected ({selectedLateIds.size})
                    </Button>
                 </div>
               </div>

               {attendanceLoading ? (
                 <div className="h-48 lg:h-64 flex flex-col items-center justify-center bg-muted/10 rounded-2xl lg:rounded-3xl border border-dashed border-border gap-3 lg:gap-4">
                   <div className="h-8 w-8 lg:h-10 lg:w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                   <p className="text-xs lg:text-sm font-bold text-muted-foreground">Analyzing check-ins...</p>
                 </div>
               ) : (
                 <>
                 {lateEmployees.length > 0 && (
                   <div className="flex items-center gap-2 mb-3">
                     <Checkbox
                       id="select-all-lates"
                       checked={selectedLateIds.size === lateEmployees.length && lateEmployees.length > 0}
                       onCheckedChange={toggleSelectAllLates}
                       className="h-4 w-4"
                     />
                     <label htmlFor="select-all-lates" className="text-[10px] lg:text-xs font-bold text-muted-foreground cursor-pointer select-none">
                       {selectedLateIds.size === lateEmployees.length ? "Deselect All" : "Select All"} ({lateEmployees.length})
                     </label>
                   </div>
                 )}
                 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 lg:gap-4">
                   {lateEmployees.map(detail => {
                     const isSelected = selectedLateIds.has(detail.employee_id)
                     return (
                     <Card key={detail.employee_id} className={cn("cursor-pointer transition-all shadow-sm group", isSelected ? "border-primary/60 bg-primary/[0.02] ring-1 ring-primary/20" : "hover:border-primary/40")}>
                       <CardHeader className="flex flex-row items-center justify-between py-3 lg:py-4 px-4">
                         <div className="flex items-center gap-3">
                           <Checkbox
                             checked={isSelected}
                             onCheckedChange={() => toggleLateSelection(detail.employee_id)}
                             className="shrink-0 h-4 w-4"
                           />
                           <div className="h-8 w-8 lg:h-10 lg:w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary overflow-hidden border-2 border-transparent group-hover:border-primary/20 transition-all text-xs lg:text-base" onClick={() => { setSelectedAttendanceDetail(detail); setAttendanceDetailOpen(true); }}>
                             {detail.profile_picture_url ? (
                               <img src={detail.profile_picture_url} className="w-full h-full object-cover" alt={detail.employee_name} />
                             ) : (
                               <span>{detail.employee_name.charAt(0)}</span>
                             )}
                           </div>
                           <div onClick={() => { setSelectedAttendanceDetail(detail); setAttendanceDetailOpen(true); }}>
                             <CardTitle className="text-xs lg:text-sm">{detail.employee_name}</CardTitle>
                             <CardDescription className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider">
                                {detail.daysLate > 0 && <span>{detail.daysLate} Late </span>}
                                {detail.daysAbsent > 0 && <span>• {detail.daysAbsent} Absent</span>}
                                {detail.daysLate === 0 && detail.daysAbsent === 0 && <span>On Time</span>}
                             </CardDescription>
                           </div>
                         </div>
                         <div className="text-right" onClick={() => { setSelectedAttendanceDetail(detail); setAttendanceDetailOpen(true); }}>
                           <p className="text-base lg:text-lg font-black text-red-600">₱{detail.calculatedDeduction.toLocaleString()}</p>
                           <p className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase">{detail.totalLateMinutes} mins total</p>
                         </div>
                       </CardHeader>
                     </Card>
                   )})}
                   {lateEmployees.length === 0 && (
                     <div className="col-span-full h-32 lg:h-48 flex flex-col items-center justify-center bg-muted/10 rounded-2xl lg:rounded-3xl border border-dashed border-border p-4 text-center">
                        <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground mb-2 opacity-30" />
                        <p className="text-xs lg:text-sm font-bold text-muted-foreground">Everything looks on time! No arrivals found.</p>
                     </div>
                   )}
                 </div>
                 </>
               )}
            </TabsContent>

            <TabsContent value="deductions" className="space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-lg lg:text-xl font-black">Mandatory contributions</h2>
                  <p className="text-[11px] lg:text-sm text-muted-foreground font-medium">
                    Defaults come from the deductions table (stored as half-month). Uncheck to skip an item, or edit
                    amounts. Pay run adjusts automatically: full month ×2, half month ×1, four-part month (¼) ×½.
                  </p>
                  <p className="text-[10px] font-bold text-primary/90 mt-1">{mandatoryPayRunScaleHint}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs font-bold shrink-0"
                  onClick={() => void reloadMandatoryDeductionsFromDb()}
                  disabled={mandatoryDeductionsLoading || !periodStart || !periodEnd}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-2", mandatoryDeductionsLoading && "animate-spin")} />
                  Reset from DB
                </Button>
              </div>

              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {mandatoryDeductionsLoading && mandatoryDeductionRows.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-sm font-bold text-muted-foreground">
                      Loading deduction defaults…
                    </div>
                  ) : mandatoryDeductionRows.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-sm font-bold text-muted-foreground px-4 text-center">
                      Select a period and ensure employees have a base salary to preview SSS, PhilHealth, and Pag-IBIG.
                    </div>
                  ) : (
                    <div className="max-h-[min(60vh,520px)] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="min-w-[140px] font-bold">Employee</TableHead>
                            <TableHead className="text-center min-w-[155px] font-bold">SSS</TableHead>
                            <TableHead className="text-center min-w-[155px] font-bold">PhilHealth</TableHead>
                            <TableHead className="text-center min-w-[155px] font-bold">Pag-IBIG</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mandatoryDeductionRows.map((row) => (
                            <TableRow key={row.employee_id}>
                              <TableCell className="font-bold text-sm align-middle">{row.full_name}</TableCell>
                              <TableCell className="align-middle">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Checkbox
                                    checked={row.applySss}
                                    onCheckedChange={(v) =>
                                      patchMandatoryDeductionRow(row.employee_id, { applySss: v === true })
                                    }
                                    className="shrink-0"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    disabled={!row.applySss}
                                    className={cn("h-8 w-[4.75rem] text-xs font-bold text-center", !row.applySss && "opacity-50")}
                                    value={Number.isFinite(row.sss) ? row.sss : 0}
                                    onChange={(e) =>
                                      patchMandatoryDeductionRow(row.employee_id, {
                                        sss: Math.round((parseFloat(e.target.value) || 0) * 100) / 100,
                                      })
                                    }
                                  />
                                  <div className="flex flex-col gap-0 shrink-0 border border-border/60 rounded-md p-0.5 bg-muted/20">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applySss}
                                      title="Use half (×½)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          sss: scaleMandatoryAmount(row.sss, 0.5),
                                        })
                                      }
                                    >
                                      <Divide className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applySss}
                                      title="Use one quarter (×¼)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          sss: scaleMandatoryAmount(row.sss, 0.25),
                                        })
                                      }
                                    >
                                      <span className="text-[11px] font-black leading-none">¼</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applySss}
                                      title="Use one eighth (×⅛)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          sss: scaleMandatoryAmount(row.sss, 0.125),
                                        })
                                      }
                                    >
                                      <span className="text-[10px] font-black leading-none">⅛</span>
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Checkbox
                                    checked={row.applyPhilhealth}
                                    onCheckedChange={(v) =>
                                      patchMandatoryDeductionRow(row.employee_id, { applyPhilhealth: v === true })
                                    }
                                    className="shrink-0"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    disabled={!row.applyPhilhealth}
                                    className={cn("h-8 w-[4.75rem] text-xs font-bold text-center", !row.applyPhilhealth && "opacity-50")}
                                    value={Number.isFinite(row.philhealth) ? row.philhealth : 0}
                                    onChange={(e) =>
                                      patchMandatoryDeductionRow(row.employee_id, {
                                        philhealth: Math.round((parseFloat(e.target.value) || 0) * 100) / 100,
                                      })
                                    }
                                  />
                                  <div className="flex flex-col gap-0 shrink-0 border border-border/60 rounded-md p-0.5 bg-muted/20">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applyPhilhealth}
                                      title="Use half (×½)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          philhealth: scaleMandatoryAmount(row.philhealth, 0.5),
                                        })
                                      }
                                    >
                                      <Divide className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applyPhilhealth}
                                      title="Use one quarter (×¼)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          philhealth: scaleMandatoryAmount(row.philhealth, 0.25),
                                        })
                                      }
                                    >
                                      <span className="text-[11px] font-black leading-none">¼</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applyPhilhealth}
                                      title="Use one eighth (×⅛)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          philhealth: scaleMandatoryAmount(row.philhealth, 0.125),
                                        })
                                      }
                                    >
                                      <span className="text-[10px] font-black leading-none">⅛</span>
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Checkbox
                                    checked={row.applyPagibig}
                                    onCheckedChange={(v) =>
                                      patchMandatoryDeductionRow(row.employee_id, { applyPagibig: v === true })
                                    }
                                    className="shrink-0"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    disabled={!row.applyPagibig}
                                    className={cn("h-8 w-[4.75rem] text-xs font-bold text-center", !row.applyPagibig && "opacity-50")}
                                    value={Number.isFinite(row.pagibig) ? row.pagibig : 0}
                                    onChange={(e) =>
                                      patchMandatoryDeductionRow(row.employee_id, {
                                        pagibig: Math.round((parseFloat(e.target.value) || 0) * 100) / 100,
                                      })
                                    }
                                  />
                                  <div className="flex flex-col gap-0 shrink-0 border border-border/60 rounded-md p-0.5 bg-muted/20">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applyPagibig}
                                      title="Use half (×½)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          pagibig: scaleMandatoryAmount(row.pagibig, 0.5),
                                        })
                                      }
                                    >
                                      <Divide className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applyPagibig}
                                      title="Use one quarter (×¼)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          pagibig: scaleMandatoryAmount(row.pagibig, 0.25),
                                        })
                                      }
                                    >
                                      <span className="text-[11px] font-black leading-none">¼</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                      disabled={!row.applyPagibig}
                                      title="Use one eighth (×⅛)"
                                      onClick={() =>
                                        patchMandatoryDeductionRow(row.employee_id, {
                                          pagibig: scaleMandatoryAmount(row.pagibig, 0.125),
                                        })
                                      }
                                    >
                                      <span className="text-[10px] font-black leading-none">⅛</span>
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adjustments" className="space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
               <div className="flex flex-col gap-4 mb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg lg:text-xl font-black">Manual Adjustments</h2>
                      <Badge variant="outline" className="font-bold">{employeeAdjustments.length}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end p-3 rounded-xl border border-border/60 bg-muted/10">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add adjustment for</Label>
                      <Select value={newAdjustmentEmployeeId || undefined} onValueChange={setNewAdjustmentEmployeeId}>
                        <SelectTrigger className="h-10 font-bold w-full">
                          <SelectValue placeholder="Choose employee…" />
                        </SelectTrigger>
                        <SelectContent>
                          {adjustmentEmployeeOptions
                            .filter((e) => !employeeAdjustments.some((a) => a.employee_id === e.id))
                            .map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.full_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={addEmployeeAdjustment}
                      variant="outline"
                      size="sm"
                      className="h-10 text-xs font-bold shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add to list
                    </Button>
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-4">
                 {employeeAdjustments.map((adj, index) => {
                   const empName = adjustmentDisplayName(adj.employee_id)
                   return (
                     <Card key={`${adj.employee_id}-${index}`} className="overflow-hidden border-border/60 shadow-sm">
                        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border">
                          <div className="p-4 lg:p-6 bg-muted/10 lg:w-1/3 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black text-muted-foreground uppercase">Employee</Label>
                              <Select
                                value={adj.employee_id}
                                onValueChange={(id) => updateEmployeeAdjustment(index, "employee_id", id)}
                              >
                                <SelectTrigger className="h-10 font-bold text-left">
                                  <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                  {adjustmentEmployeeOptions
                                    .filter(
                                      (e) =>
                                        e.id === adj.employee_id ||
                                        !employeeAdjustments.some((a, i) => i !== index && a.employee_id === e.id)
                                    )
                                    .map((e) => (
                                      <SelectItem key={e.id} value={e.id}>
                                        {e.full_name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-black text-sm lg:text-base">{empName}</h3>
                              <Badge key="idtag" className="bg-primary/10 text-primary border-0 text-[8px] lg:text-[9px] uppercase">ID: {adj.employee_id.substring(0,6)}</Badge>
                            </div>
                            
                            <div className="space-y-2">
                              {adj.lateDeduction && adj.lateDeduction > 0 ? (
                                <div className="p-2.5 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between group">
                                  <div>
                                    <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Attendance Late</p>
                                    <p className="text-xs font-black text-red-600">- ₱{adj.lateDeduction.toLocaleString()}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-500" onClick={() => updateEmployeeAdjustment(index, "lateDeduction", 0)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : null}

                              {adj.absenceDays && adj.absenceDays > 0 ? (
                                <div className="p-2.5 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between group">
                                  <div>
                                    <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Attendance Absence</p>
                                    <p className="text-xs font-black text-red-600">- ₱{(adj.absenceDays * adj.absenceAmountPerDay).toLocaleString()}</p>
                                    <p className="text-[7px] text-red-400 font-bold uppercase">{adj.absenceDays} Days x ₱{adj.absenceAmountPerDay.toLocaleString()}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-500" onClick={() => updateEmployeeAdjustment(index, "absenceDays", 0)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="p-4 lg:p-6 flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6">
                            <div className="space-y-1.5">
                              <Label className="text-[9px] lg:text-[10px] font-black text-muted-foreground uppercase">Absence Days</Label>
                              <Input type="number" className="font-bold h-8 lg:h-9 text-xs" value={adj.absenceDays} onChange={(e) => updateEmployeeAdjustment(index, "absenceDays", parseFloat(e.target.value))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] lg:text-[10px] font-black text-muted-foreground uppercase">Cash Advance</Label>
                              <Input type="number" className="font-bold h-8 lg:h-9 text-xs" value={adj.cashAdvance || ""} onChange={(e) => updateEmployeeAdjustment(index, "cashAdvance", parseFloat(e.target.value))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] lg:text-[10px] font-black text-muted-foreground uppercase">OT Hours</Label>
                              <div className="flex items-center gap-2">
                                <Badge className="h-8 lg:h-9 px-3 bg-muted text-foreground border-border text-xs">{adj.overtimeEntries.reduce((s, o) => s + o.hours, 0)}h</Badge>
                                <Button variant="ghost" size="sm" className="h-8 w-8 lg:h-9 lg:w-9 p-0 border border-border"><Plus className="h-4 w-4" /></Button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] lg:text-[10px] font-black text-muted-foreground uppercase">Misc Deduct</Label>
                              <Input type="number" className="font-bold h-8 lg:h-9 text-xs border-red-50" value={adj.otherDeductions || ""} onChange={(e) => updateEmployeeAdjustment(index, "otherDeductions", parseFloat(e.target.value))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] lg:text-[10px] font-black text-muted-foreground uppercase">Unpaid salary</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                className="font-bold h-8 lg:h-9 text-xs border-emerald-500/30"
                                value={adj.unpaidSalary ?? ""}
                                onChange={(e) =>
                                  updateEmployeeAdjustment(index, "unpaidSalary", parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] lg:text-[10px] font-black text-muted-foreground uppercase">Reimbursement</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                className="font-bold h-8 lg:h-9 text-xs border-emerald-500/30"
                                value={adj.reimbursement ?? ""}
                                onChange={(e) =>
                                  updateEmployeeAdjustment(index, "reimbursement", parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                          </div>
                        </div>
                     </Card>
                   )
                 })}
               </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

       {/* Attendance Detail Modal */}
       <Dialog open={attendanceDetailOpen} onOpenChange={setAttendanceDetailOpen}>
        <DialogContent className="w-[95%] sm:max-w-3xl overflow-hidden rounded-2xl lg:rounded-3xl p-0 border-0 shadow-2xl">
          <div className="p-4 lg:p-8 bg-card border-b border-border/40">
            <DialogHeader>
              <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-xl lg:text-2xl font-black">{selectedAttendanceDetail?.employee_name}</span>
                <Badge variant="outline" className="font-bold border-primary text-primary transition-colors text-[10px] lg:text-xs">Daily Rate: ₱{selectedAttendanceDetail?.dailyRate.toLocaleString()}</Badge>
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="p-4 lg:p-8 max-h-[70vh] lg:max-h-[60vh] overflow-y-auto space-y-4 lg:space-y-6 bg-muted/5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="p-3 lg:p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-border/30">
                <p className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Lates</p>
                <p className="text-sm lg:text-xl font-black text-red-600">{selectedAttendanceDetail?.daysLate} Days</p>
              </div>
              <div className="p-3 lg:p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-border/30">
                <p className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Absences</p>
                <p className="text-sm lg:text-xl font-black text-red-600">{selectedAttendanceDetail?.daysAbsent} Days</p>
              </div>
              <div className="p-3 lg:p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-border/30">
                <p className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Minutes</p>
                <p className="text-sm lg:text-xl font-black">{selectedAttendanceDetail?.totalLateMinutes}m</p>
              </div>
              <div className="p-3 lg:p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-border/30">
                <p className="text-[9px] lg:text-[10px] font-bold text-muted-foreground uppercase mb-1">Calculated Cost</p>
                <p className="text-sm lg:text-xl font-black">₱{selectedAttendanceDetail?.calculatedDeduction.toLocaleString()}</p>
              </div>
            </div>

            <div className="border border-border/60 rounded-xl lg:rounded-2xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-4">Date</TableHead>
                      <TableHead className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Time In</TableHead>
                      <TableHead className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Time Out</TableHead>
                      <TableHead className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Late</TableHead>
                      <TableHead className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Deduction</TableHead>
                      <TableHead className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAttendanceDetail?.logs.map((log: LogEntry, i: number) => {
                      const isEditingIn = editingCell?.rowIdx === i && editingCell?.field === "time_in";
                      const isEditingOut = editingCell?.rowIdx === i && editingCell?.field === "time_out";
                      const isEditingStatus = editingCell?.rowIdx === i && editingCell?.field === "status";

                      return (
                        <TableRow key={i} className={cn("hover:bg-muted/10 border-border/40", (log.lateMins > 0 || log.status === "Absent") && "bg-red-50/20")}>
                          <TableCell className="text-[10px] lg:text-[11px] font-bold py-3 pl-4 whitespace-nowrap">{format(new Date(log.date), "MMM d, EEE")}</TableCell>
                          
                          {/* Time In */}
                          <TableCell 
                            className="text-center font-mono text-[10px] lg:text-[11px] cursor-pointer whitespace-nowrap" 
                            onDoubleClick={() => { setEditingCell({ rowIdx: i, field: "time_in" }); setEditValue(log.time_in || "08:00"); }}
                          >
                            {isEditingIn ? (
                              <Input 
                                type="time" 
                                autoFocus 
                                className="h-7 text-[10px] px-1 w-20 lg:w-24 mx-auto font-bold" 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleUpdateLog(log, "time_in", editValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateLog(log, "time_in", editValue);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                              />
                            ) : (
                              formatTo12Hour(log.time_in)
                            )}
                          </TableCell>

                          {/* Time Out */}
                          <TableCell 
                            className="text-center font-mono text-[10px] lg:text-[11px] cursor-pointer whitespace-nowrap"
                            onDoubleClick={() => { setEditingCell({ rowIdx: i, field: "time_out" }); setEditValue(log.time_out || "17:00"); }}
                          >
                            {isEditingOut ? (
                              <Input 
                                type="time" 
                                autoFocus 
                                className="h-7 text-[10px] px-1 w-20 lg:w-24 mx-auto font-bold" 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleUpdateLog(log, "time_out", editValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateLog(log, "time_out", editValue);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                              />
                            ) : (
                              formatTo12Hour(log.time_out)
                            )}
                          </TableCell>

                          {/* Late Minutes */}
                          <TableCell className="text-center">
                            {log.lateMins > 0 ? (
                              <Badge className="bg-red-500 font-bold text-[8px] lg:text-[9px] h-4 lg:h-5 px-1 lg:px-1.5 border-0">{log.lateMins}m</Badge>
                            ) : (
                              <span className="opacity-10">-</span>
                            )}
                          </TableCell>

                          {/* Individual Deduction */}
                          <TableCell className="text-center whitespace-nowrap">
                            {log.deduction > 0 ? (
                              <span className="text-[10px] lg:text-[11px] font-black text-red-600">₱{log.deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            ) : (
                              <span className="opacity-10">-</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell 
                            className="text-right pr-4 cursor-pointer"
                            onDoubleClick={() => { setEditingCell({ rowIdx: i, field: "status" }); setEditValue(log.status); }}
                          >
                            {isEditingStatus ? (
                              <select 
                                autoFocus
                                className="h-7 text-[9px] lg:text-[10px] px-1 bg-background border border-border rounded font-bold outline-none"
                                value={editValue}
                                onChange={(e) => handleUpdateLog(log, "status", e.target.value)}
                                onBlur={() => setEditingCell(null)}
                              >
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Weekend">Weekend</option>
                                <option value="Holiday">Holiday</option>
                                <option value="Work From Home">WFH</option>
                                <option value="Remote">Remote</option>
                              </select>
                            ) : (
                              <Badge 
                                variant={log.status === "Present" ? "outline" : log.status === "Weekend" ? "secondary" : "destructive"} 
                                className={cn("text-[8px] lg:text-[9px] uppercase font-black px-1.5 lg:px-2 py-0 h-4 lg:h-5 border-0", log.status === "Present" && "bg-emerald-50 text-emerald-600 border border-emerald-100")}
                              >
                                {log.status}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <div className="p-4 lg:p-6 bg-muted/10 flex justify-end gap-3">
             <Button variant="ghost" className="font-bold text-xs lg:text-sm h-8 lg:h-10" onClick={() => setAttendanceDetailOpen(false)}>Close Review</Button>
          </div>
        </DialogContent>
       </Dialog>

      <AlertDialog open={attendanceDeductionConfirmOpen} onOpenChange={setAttendanceDeductionConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Attendance deductions not fully applied?</AlertDialogTitle>
            <AlertDialogDescription>
              The attendance tracker shows late/absence deductions for this period that are not fully reflected in
              payroll adjustments (for example, you may not have used &quot;Apply Selected&quot; on the attendance tracker
              yet). Generating
              now will use the current adjustment values, which may omit those amounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-semibold">Review attendance</AlertDialogCancel>
            <AlertDialogAction className="font-semibold" onClick={confirmGenerateDespiteAttendance}>
              Generate anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
