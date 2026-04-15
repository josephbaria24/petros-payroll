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
import { format } from "date-fns"
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
  Info
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
import { useProtectedPage } from "../../hooks/useProtectedPage"

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
}

type EditingCell = {
  rowIdx: number;
  field: "time_in" | "time_out" | "status";
} | null

type AttendanceDetail = {
  employee_id: string
  employee_name: string
  totalLateMinutes: number
  calculatedDeduction: number
  daysLate: number
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
  const [attendanceDetails, setAttendanceDetails] = useState<AttendanceDetail[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceDetailOpen, setAttendanceDetailOpen] = useState(false)
  const [selectedAttendanceDetail, setSelectedAttendanceDetail] = useState<AttendanceDetail | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState("")
  const [selectedLateIds, setSelectedLateIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const fetchEmployees = async () => {useState(false)}

  const pendingRequests = employeeRequests.filter(r => r.status === "Pending")
  const approvedRequests = employeeRequests.filter(r => r.status === "Approved")

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

        // Calculate standardized daily rate for deduction
        let dailyRate = emp.daily_rate || 0
        if (!dailyRate || dailyRate === 0) {
          // Fallback calculation if not set in profile
          const baseSalary = emp.base_salary || 0
          const monthlySalary = emp.pay_type === "semi-monthly" ? baseSalary * 2 : baseSalary
          const daysPerWeek = (emp.working_days && emp.working_days.length > 0) ? emp.working_days.length : 5
          dailyRate = (monthlySalary * 12) / (52 * daysPerWeek)
        }

        let totalLateMinutes = 0
        let daysLate = 0
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

          if (dayLateMins > 0) {
            totalLateMinutes += dayLateMins;
            daysLate++;
          }

          fullPeriodLogs.push({
            date: dateStr,
            time_in: firstIn ? extractPhilippineTime(firstIn.timestamp) : null,
            time_out: firstOut ? extractPhilippineTime(firstOut.timestamp) : null,
            lateMins: dayLateMins,
            deduction: (dayLateMins / 60) * (dailyRate / 8),
            status: finalStatus,
            in_id: overrideLog?.id || firstIn?.id || null,
            out_id: firstOut?.id || null,
            is_manual: overrideLog?.is_manual || firstIn?.is_manual || firstOut?.is_manual || false
          })
          current.setDate(current.getDate() + 1);
        }
        
        const deduction = (dailyRate / 8) * (totalLateMinutes / 60)

        attendanceMap.set(emp.id, {
          employee_id: emp.id,
          employee_name: emp.full_name,
          totalLateMinutes,
          calculatedDeduction: Math.round(deduction * 100) / 100,
          daysLate,
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
    const toApply = attendanceDetails.filter(d => selectedLateIds.has(d.employee_id) && d.daysLate > 0)
    toApply.forEach(detail => {
      const idx = employeeAdjustments.findIndex(a => a.employee_id === detail.employee_id)
      if (idx !== -1) {
        const updated = [...employeeAdjustments]
        updated[idx].lateDeduction = detail.calculatedDeduction
        setEmployeeAdjustments(updated)
      } else {
        setEmployeeAdjustments(prev => [...prev, {
          employee_id: detail.employee_id,
          absenceDays: 0,
          absenceAmountPerDay: 0,
          overtimeEntries: [],
          lateDeduction: detail.calculatedDeduction
        }])
      }
    })
    toast.success(`Applied late deductions for ${toApply.length} employee(s)`)
    setSelectedLateIds(new Set())
  }

  const lateEmployees = useMemo(() => attendanceDetails.filter(d => d.daysLate > 0), [attendanceDetails])

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
  const addEmployeeAdjustment = async () => {
    const table = activeOrganization === "pdn" ? "pdn_employees" : "employees"
    const { data: emps } = await supabase.from(table).select("id, full_name").neq("employment_status", "Inactive")
    
    if (emps && emps.length > 0) {
      const emp = emps[0]
      if (!employeeAdjustments.some(a => a.employee_id === emp.id)) {
        setEmployeeAdjustments(prev => [...prev, {
          employee_id: emp.id,
          absenceDays: 0,
          absenceAmountPerDay: 0,
          overtimeEntries: []
        }])
      }
    }
  }

  const updateEmployeeAdjustment = (index: number, field: keyof EmployeeAdjustment, value: any) => {
    const updated = [...employeeAdjustments]
    updated[index] = { ...updated[index], [field]: value }
    setEmployeeAdjustments(updated)
  }

  const handleBulkGeneratePayroll = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select a period")
      return
    }

    const toastId = toast.loading("Generating payroll...")
    const { data: { user } } = await supabase.auth.getUser()
    const creatorId = user?.id

    try {
      const payrollTable = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
      
      // Delete existing
      await supabase.from(payrollTable).delete()
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))

      // Fetch employees and deductions
      const empTable = activeOrganization === "pdn" ? "pdn_employees" : "employees"
      const dedTable = activeOrganization === "pdn" ? "pdn_deductions" : "deductions"
      
      const { data: allEmployees } = await supabase.from(empTable).select("*")
      const { data: allDeductions } = await supabase.from(dedTable).select("*")

      const recordsToInsert = []
      for (const emp of allEmployees || []) {
        if (!emp.base_salary) continue

        const empDeductions = (allDeductions || []).filter(d => d.employee_id === emp.id)
        let sss = 0, philhealth = 0, pagibig = 0, loans = 0
        
        empDeductions.forEach(d => {
          const t = d.type.toLowerCase()
          if (t.includes("sss")) sss += d.amount
          else if (t.includes("philhealth")) philhealth += d.amount
          else if (t.includes("pagibig") || t.includes("hdmf")) pagibig += d.amount
          else loans += d.amount
        })

        const adj = employeeAdjustments.find(a => a.employee_id === emp.id)
        const late = adj?.lateDeduction || 0
        const absence = (adj?.absenceDays || 0) * (adj?.absenceAmountPerDay || 0)
        const overtime = (adj?.overtimeEntries || []).reduce((s, ot) => s + (ot.hours * ot.ratePerHour), 0)
        const holiday = adj?.holidayPay || 0
        const other = adj?.otherDeductions || 0
        const cashAdvance = adj?.cashAdvance || 0
        const withholding = adj?.withholdingTax || 0

        const totalDeductions = sss + philhealth + pagibig + loans + absence + late + other + cashAdvance + withholding
        const gross = emp.base_salary + overtime + holiday + (emp.allowance || 0)

        recordsToInsert.push({
          employee_id: emp.id,
          period_start: format(periodStart, "yyyy-MM-dd"),
          period_end: format(periodEnd, "yyyy-MM-dd"),
          basic_salary: emp.base_salary,
          overtime_pay: overtime,
          holiday_pay: holiday,
          allowances: emp.allowance || 0,
          absences: absence,
          tardiness: late,
          sss, philhealth, pagibig,
          loans: loans + other,
          withholding_tax: withholding,
          cash_advance: cashAdvance,
          gross_pay: gross,
          total_deductions: totalDeductions,
          net_pay: gross - totalDeductions,
          status: "Pending Payment",
          creator_id: creatorId
        })
      }

      if (recordsToInsert.length > 0) {
        await supabase.from(payrollTable).insert(recordsToInsert)
        toast.success("Payroll generated successfully", { id: toastId })
        router.push("/payroll")
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/payroll")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Generate Payroll</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Payroll Management <ArrowRight className="inline h-3 w-3" /> New Period
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 font-bold">
            {activeOrganization?.toUpperCase() || "PETROSPHERE"}
          </Badge>
          <Button className="bg-primary hover:bg-primary/90 font-bold shadow-lg" onClick={handleBulkGeneratePayroll}>
            <Calculator className="h-4 w-4 mr-2" />
            Generate All
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Config */}
        <aside className="w-80 border-r border-border bg-muted/20 p-6 overflow-y-auto space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Period Configuration</h3>
            
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
              Calculations are based on 15-day semi-monthly logic. 8:31 AM marks the start of deductions.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          <Tabs defaultValue="attendance" className="w-full">
            <TabsList className="grid w-fit grid-cols-3 bg-muted/30 p-1 mb-8">
              <TabsTrigger value="requests" className="font-bold px-6">
                Requests 
                {pendingRequests.length > 0 && <Badge className="ml-2 bg-red-500">{pendingRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="attendance" className="font-bold px-6">Attendance Logs</TabsTrigger>
              <TabsTrigger value="adjustments" className="font-bold px-6">Adjustments</TabsTrigger>
            </TabsList>

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

            <TabsContent value="attendance" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <h2 className="text-xl font-black">Late Tracking</h2>
                   <p className="text-sm text-muted-foreground font-medium">Automatic deduction calculation from logs</p>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchAttendanceAndCalculateLates} disabled={attendanceLoading}>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Recalculate
                    </Button>
                    <Button size="sm" onClick={applyAttendanceDeductions} disabled={selectedLateIds.size === 0}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Apply Selected ({selectedLateIds.size})
                    </Button>
                 </div>
               </div>

               {attendanceLoading ? (
                 <div className="h-64 flex flex-col items-center justify-center bg-muted/10 rounded-3xl border border-dashed border-border gap-4">
                   <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                   <p className="font-bold text-muted-foreground">Analyzing check-ins...</p>
                 </div>
               ) : (
                 <>
                 {lateEmployees.length > 0 && (
                   <div className="flex items-center gap-2 mb-2">
                     <Checkbox
                       id="select-all-lates"
                       checked={selectedLateIds.size === lateEmployees.length && lateEmployees.length > 0}
                       onCheckedChange={toggleSelectAllLates}
                     />
                     <label htmlFor="select-all-lates" className="text-xs font-bold text-muted-foreground cursor-pointer select-none">
                       {selectedLateIds.size === lateEmployees.length ? "Deselect All" : "Select All"} ({lateEmployees.length})
                     </label>
                   </div>
                 )}
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                   {lateEmployees.map(detail => {
                     const isSelected = selectedLateIds.has(detail.employee_id)
                     return (
                     <Card key={detail.employee_id} className={cn("cursor-pointer transition-all shadow-sm group", isSelected ? "border-primary/60 bg-primary/[0.02] ring-1 ring-primary/20" : "hover:border-primary/40")}>
                       <CardHeader className="flex flex-row items-center justify-between py-4">
                         <div className="flex items-center gap-3">
                           <Checkbox
                             checked={isSelected}
                             onCheckedChange={() => toggleLateSelection(detail.employee_id)}
                             className="shrink-0"
                           />
                           <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary overflow-hidden border-2 border-transparent group-hover:border-primary/20 transition-all" onClick={() => { setSelectedAttendanceDetail(detail); setAttendanceDetailOpen(true); }}>
                             {detail.profile_picture_url ? (
                               <img src={detail.profile_picture_url} className="w-full h-full object-cover" alt={detail.employee_name} />
                             ) : (
                               <span>{detail.employee_name.charAt(0)}</span>
                             )}
                           </div>
                           <div onClick={() => { setSelectedAttendanceDetail(detail); setAttendanceDetailOpen(true); }}>
                             <CardTitle className="text-sm">{detail.employee_name}</CardTitle>
                             <CardDescription className="text-[10px] font-bold uppercase tracking-wider">{detail.daysLate} Days Late</CardDescription>
                           </div>
                         </div>
                         <div className="text-right" onClick={() => { setSelectedAttendanceDetail(detail); setAttendanceDetailOpen(true); }}>
                           <p className="text-lg font-black text-red-600">₱{detail.calculatedDeduction.toLocaleString()}</p>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">{detail.totalLateMinutes} mins total</p>
                         </div>
                       </CardHeader>
                     </Card>
                   )})}
                   {lateEmployees.length === 0 && (
                     <div className="col-span-full h-48 flex flex-col items-center justify-center bg-muted/10 rounded-3xl border border-dashed border-border">
                        <Clock className="h-8 w-8 text-muted-foreground mb-2 opacity-30" />
                        <p className="font-bold text-muted-foreground">Everything looks on time! No late arrivals found.</p>
                     </div>
                   )}
                 </div>
                 </>
               )}
            </TabsContent>

            <TabsContent value="adjustments" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black">Manual Adjustments</h2>
                    <Badge variant="outline" className="font-bold">{employeeAdjustments.length}</Badge>
                  </div>
                  <Button onClick={addEmployeeAdjustment} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Employee
                  </Button>
               </div>

               <div className="grid grid-cols-1 gap-4">
                 {employeeAdjustments.map((adj, index) => {
                   const empName = attendanceDetails.find(d => d.employee_id === adj.employee_id)?.employee_name || "Unknown Employee"
                   return (
                     <Card key={adj.employee_id} className="overflow-hidden border-border/60">
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                          <div className="p-6 bg-muted/10 md:w-1/3">
                            <div className="flex items-center gap-2 mb-4">
                              <h3 className="font-black text-sm">{empName}</h3>
                              <Badge key="idtag" className="bg-primary/10 text-primary border-0 text-[9px] uppercase">ID: {adj.employee_id.substring(0,6)}</Badge>
                            </div>
                            
                            {adj.lateDeduction && (
                              <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between group">
                                <div>
                                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Attendance Late</p>
                                  <p className="text-sm font-black text-red-600">- ₱{adj.lateDeduction.toLocaleString()}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-500 hover:bg-transparent" onClick={() => updateEmployeeAdjustment(index, "lateDeduction", 0)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="p-6 flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-muted-foreground uppercase">Absence Days</Label>
                              <Input type="number" className="font-bold h-9" value={adj.absenceDays} onChange={(e) => updateEmployeeAdjustment(index, "absenceDays", parseFloat(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-muted-foreground uppercase">Cash Advance</Label>
                              <Input type="number" className="font-bold h-9" value={adj.cashAdvance || ""} onChange={(e) => updateEmployeeAdjustment(index, "cashAdvance", parseFloat(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-muted-foreground uppercase">OT Hours</Label>
                              <div className="flex items-center gap-2">
                                <Badge className="h-9 px-3 bg-muted text-foreground border-border">{adj.overtimeEntries.reduce((s, o) => s + o.hours, 0)}h</Badge>
                                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 border border-border"><Plus className="h-4 w-4" /></Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-muted-foreground uppercase">Misc Deduct</Label>
                              <Input type="number" className="font-bold h-9 border-red-100" value={adj.otherDeductions || ""} onChange={(e) => updateEmployeeAdjustment(index, "otherDeductions", parseFloat(e.target.value))} />
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
        <DialogContent className="max-w-3xl overflow-hidden rounded-3xl p-0 border-0 shadow-2xl">
          <div className="p-8 bg-card border-b border-border/40">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="text-2xl font-black">{selectedAttendanceDetail?.employee_name}</span>
                <Badge variant="outline" className="font-bold border-primary text-primary">Daily Rate: ₱{selectedAttendanceDetail?.dailyRate.toLocaleString()}</Badge>
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 bg-muted/5">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-border/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Lates</p>
                <p className="text-xl font-black text-red-600">{selectedAttendanceDetail?.daysLate} Days</p>
              </div>
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-border/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Minutes</p>
                <p className="text-xl font-black">{selectedAttendanceDetail?.totalLateMinutes}m</p>
              </div>
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-border/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Calculated Cost</p>
                <p className="text-xl font-black">₱{selectedAttendanceDetail?.calculatedDeduction.toLocaleString()}</p>
              </div>
            </div>

            <div className="border border-border/60 rounded-2xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-4">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Time In</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Time Out</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Late</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Deduction</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedAttendanceDetail?.logs.map((log: LogEntry, i: number) => {
                    const isEditingIn = editingCell?.rowIdx === i && editingCell?.field === "time_in";
                    const isEditingOut = editingCell?.rowIdx === i && editingCell?.field === "time_out";
                    const isEditingStatus = editingCell?.rowIdx === i && editingCell?.field === "status";

                    return (
                      <TableRow key={i} className={cn("hover:bg-muted/10 border-border/40", log.lateMins > 0 && "bg-red-50/20")}>
                        <TableCell className="text-[11px] font-bold py-3 pl-4">{format(new Date(log.date), "MMM d, EEE")}</TableCell>
                        
                        {/* Time In */}
                        <TableCell 
                          className="text-center font-mono text-[11px] cursor-pointer" 
                          onDoubleClick={() => { setEditingCell({ rowIdx: i, field: "time_in" }); setEditValue(log.time_in || "08:00"); }}
                        >
                          {isEditingIn ? (
                            <Input 
                              type="time" 
                              autoFocus 
                              className="h-7 text-[11px] px-1 w-24 mx-auto font-bold" 
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
                          className="text-center font-mono text-[11px] cursor-pointer"
                          onDoubleClick={() => { setEditingCell({ rowIdx: i, field: "time_out" }); setEditValue(log.time_out || "17:00"); }}
                        >
                          {isEditingOut ? (
                            <Input 
                              type="time" 
                              autoFocus 
                              className="h-7 text-[11px] px-1 w-24 mx-auto font-bold" 
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
                            <Badge className="bg-red-500 font-bold text-[9px] h-5 px-1.5 border-0">{log.lateMins}m</Badge>
                          ) : (
                            <span className="opacity-10">-</span>
                          )}
                        </TableCell>

                        {/* Individual Deduction */}
                        <TableCell className="text-center">
                          {log.deduction > 0 ? (
                            <span className="text-[11px] font-black text-red-600">₱{log.deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                              className="h-7 text-[10px] px-1 bg-background border border-border rounded font-bold outline-none"
                              value={editValue}
                              onChange={(e) => handleUpdateLog(log, "status", e.target.value)}
                              onBlur={() => setEditingCell(null)}
                            >
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                              <option value="On Leave">On Leave</option>
                              <option value="Weekend">Weekend</option>
                              <option value="Holiday">Holiday</option>
                            </select>
                          ) : (
                            <Badge 
                              variant={log.status === "Present" ? "outline" : log.status === "Weekend" ? "secondary" : "destructive"} 
                              className={cn("text-[9px] uppercase font-black px-2 py-0 h-5 border-0", log.status === "Present" && "bg-emerald-50 text-emerald-600 border border-emerald-100")}
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
          <div className="p-6 bg-muted/10 flex justify-end gap-3">
             <Button variant="ghost" className="font-bold" onClick={() => setAttendanceDetailOpen(false)}>Close Review</Button>
          </div>
        </DialogContent>
       </Dialog>
    </div>
  )
}
