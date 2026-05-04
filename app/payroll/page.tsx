"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Eye, Trash2, Plus, X, Calculator, Users, PhilippinePeso, TrendingUp, FileText, Check, XCircle, Clock, CheckCircle, ChevronDown, CheckCircle2, AlertCircle, Mail, Search } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProtectedPage } from "../hooks/useProtectedPage"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PayrollNotifyDialog } from "@/components/payroll-notify-dialog"



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




type PayrollRecord = {
  id: string
  employee_id: string
  employee_name?: string
  pay_type?: string
  period_start: string
  period_end: string
  basic_salary: number
  overtime_pay: number
  holiday_pay?: number
  night_diff?: number
  allowances?: number
  unpaid_salary?: number
  reimbursement?: number
  status: string
  absences?: number
  tardiness?: number
  cash_advance?: number
  sss?: number
  philhealth?: number
  pagibig?: number
  withholding_tax?: number
  loans?: number
  total_deductions?: number
  net_after_deductions?: number
  total_net?: number
  profile_picture_url?: string
}

type PayrollPeriod = {
  period_key: string
  period_start: string
  period_end: string
  display_name: string
  total_employees: number
  total_basic_salary: number
  total_overtime: number
  total_holiday_pay?: number
  total_deductions: number
  total_net_after_deductions: number
  records: PayrollRecord[]
  status: string
  created_at: string
  updated_at?: string
  creator: string
}



const statusVariants: Record<string, string> = {
  "Paid": "bg-primary text-primary-foreground border-border",
  "Pending Payment": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "Cancelled": "bg-muted text-muted-foreground border-border",
  "Released": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Partially Released": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Pending": "bg-muted text-muted-foreground border-border",
}

export default function PayrollPage() {
  const router = useRouter()
  useProtectedPage(["admin", "hr"], "payroll")
  const { activeOrganization } = useOrganization()
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [currentPeriodPage, setCurrentPeriodPage] = useState(1)
  const [isNotifyDialogOpen, setIsNotifyDialogOpen] = useState(false)
  const [notificationRecords, setNotificationRecords] = useState<any[]>([])
  const [notificationPeriodName, setNotificationPeriodName] = useState("")

  const itemsPerPage = 5
  const [selectedPeriodRecords, setSelectedPeriodRecords] = useState<PayrollRecord[]>([])
  const [selectedPeriodName, setSelectedPeriodName] = useState("")
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  function handleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const [employees, setEmployees] = useState<{ id: string; full_name: string; pay_type: string }[]>([])
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchPayrollPeriods()
    fetchEmployees()
  }, [activeOrganization])

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return toast.warning("No records selected.")

    const confirm = window.confirm("Are you sure you want to delete selected payroll records?")
    if (!confirm) return

    const toastId = toast.loading("Deleting selected records...")

    const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
    const { error } = await supabase
      .from(table)
      .delete()
      .in("id", selectedIds)

    if (error) {
      toast.error("Failed to delete records", { id: toastId })
    } else {
      toast.success("Selected records deleted!", { id: toastId })
      setSelectedIds([])
      fetchPayrollPeriods()
    }
  }

  async function handleDeletePeriod(periodKey: string) {
    const confirm = window.confirm("Are you sure you want to delete this entire payroll period? This will delete all payroll records for this period.")
    if (!confirm) return

    const toastId = toast.loading("Deleting payroll period...")

    const period = periods.find(p => p.period_key === periodKey)
    if (!period) return

    const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("period_start", period.period_start)
      .eq("period_end", period.period_end)

    if (error) {
      toast.error("Failed to delete payroll period", { id: toastId })
    } else {
      toast.success("Payroll period deleted!", { id: toastId })
      fetchPayrollPeriods()
    }
  }

  async function fetchPayrollPeriods() {
    if (activeOrganization === "pdn") {
      const { data: payroll, error } = await supabase
        .from("pdn_payroll_records")
        .select(`
          id, employee_id, period_start, period_end, basic_salary,
          overtime_pay, holiday_pay, night_diff, allowances, bonuses, commission,
          unpaid_salary, reimbursement,
          absences, tardiness,
          cash_advance, sss, philhealth, pagibig, withholding_tax, loans, uniform,
          total_deductions, net_pay, status, created_at, updated_at, creator_id,
          pdn_employees(full_name, pay_type, profile_picture_url)
        `)
        .order("period_end", { ascending: false })

      if (error) {
        console.error("Error fetching PDN payroll:", error.message, error.details, error.hint)
        return
      }

      const processedRecords = (payroll ?? []).map((rec: any) => {
        const grossPay =
          (rec.basic_salary || 0) +
          (rec.overtime_pay || 0) +
          (rec.holiday_pay || 0) +
          (rec.night_diff || 0) +
          (rec.allowances || 0) +
          (rec.bonuses || 0) +
          (rec.commission || 0) +
          (rec.unpaid_salary || 0) +
          (rec.reimbursement || 0)
        const totalDeductions = rec.total_deductions || 0
        const netAfterDeductions = grossPay - totalDeductions

        return {
          id: rec.id,
          employee_id: rec.employee_id,
          employee_name: rec.pdn_employees?.full_name,
          pay_type: rec.pdn_employees?.pay_type,
          profile_picture_url: rec.pdn_employees?.profile_picture_url,
          period_start: rec.period_start,
          period_end: rec.period_end,
          basic_salary: rec.basic_salary || 0,
          overtime_pay: rec.overtime_pay || 0,
          holiday_pay: rec.holiday_pay || 0,
          night_diff: rec.night_diff || 0,
          allowances: rec.allowances || 0,
          bonuses: rec.bonuses || 0,
          commission: rec.commission || 0,
          unpaid_salary: rec.unpaid_salary || 0,
          reimbursement: rec.reimbursement || 0,
          status: rec.status,
          absences: rec.absences || 0,
          tardiness: rec.tardiness || 0,
          cash_advance: rec.cash_advance || 0,
          sss: rec.sss || 0,
          philhealth: rec.philhealth || 0,
          pagibig: rec.pagibig || 0,
          withholding_tax: rec.withholding_tax || 0,
          loans: rec.loans || 0,
          uniform: rec.uniform || 0,
          total_deductions: totalDeductions,
          net_after_deductions: netAfterDeductions,
          total_net: netAfterDeductions,
          created_at: rec.created_at,
          updated_at: rec.updated_at || rec.created_at,
          creator_name: (rec as any).profiles?.[0]?.fullname || (rec as any).profiles?.fullname ||
            (rec.creator_id === "7229a103-7f3e-464c-8032-970b9df6220b" || !rec.creator_id ? "Joseph Baria" : "User " + rec.creator_id.substring(0, 5))
        }
      })

      // Group by period
      const periodMap = new Map<string, PayrollPeriod>()

      processedRecords.forEach((record: any) => {
        const periodKey = `${record.period_start}_${record.period_end}`

        if (!periodMap.has(periodKey)) {
          const startDate = new Date(record.period_start)
          const endDate = new Date(record.period_end)
          const monthName = startDate.toLocaleDateString('en-US', { month: 'long' })
          const year = startDate.getFullYear()
          const displayName = `${monthName} ${startDate.getDate()}-${endDate.getDate()}, ${year}`

          periodMap.set(periodKey, {
            period_key: periodKey,
            period_start: record.period_start,
            period_end: record.period_end,
            display_name: displayName,
            total_employees: 0,
            total_basic_salary: 0,
            total_overtime: 0,
            total_deductions: 0,
            total_net_after_deductions: 0,
            records: [],
            status: record.status || "Pending",
            created_at: record.created_at,
            updated_at: record.updated_at || record.created_at,
            creator: "System Admin"
          })
        }

        const period = periodMap.get(periodKey)!
        period.records.push(record)
        period.total_employees = period.records.length
        period.total_basic_salary += record.basic_salary || 0
        period.total_overtime += record.overtime_pay || 0
        period.total_holiday_pay = (period.total_holiday_pay || 0) + (record.holiday_pay || 0)
        period.total_deductions += record.total_deductions || 0
        period.total_net_after_deductions += record.total_net || 0
      })

      setPeriods(Array.from(periodMap.values()))
      return
    }

    const { data: payroll, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_start,
        period_end,
        basic_salary,
        overtime_pay,
        holiday_pay,
        night_diff,
        allowances,
        bonuses,
        commission,
        unpaid_salary,
        reimbursement,
        absences,
        tardiness,
        cash_advance,
        sss,
        philhealth,
        pagibig,
        withholding_tax,
        loans,
        uniform,
        total_deductions,
        net_pay,
        status,
        created_at,
        updated_at,
        creator_id,
        profiles(fullname),
        employees(full_name, pay_type, profile_picture_url)
      `)
      .order("period_end", { ascending: false })

    if (error) {
      console.error("Error fetching payroll records:", error.message, error.hint, error.details)
      return
    }

    const processedRecords = payroll.map((rec: any) => {
      const grossPay =
        (rec.basic_salary || 0) +
        (rec.overtime_pay || 0) +
        (rec.holiday_pay || 0) +
        (rec.night_diff || 0) +
        (rec.allowances || 0) +
        (rec.bonuses || 0) +
        (rec.commission || 0) +
        (rec.unpaid_salary || 0) +
        (rec.reimbursement || 0)

      const totalDeductions = (rec.total_deductions || 0)
      const netAfterDeductions = grossPay - totalDeductions

      return {
        id: rec.id,
        employee_id: rec.employee_id,
        employee_name: rec.employees?.full_name,
        pay_type: rec.employees?.pay_type,
        profile_picture_url: rec.employees?.profile_picture_url,
        period_start: rec.period_start,
        period_end: rec.period_end,
        basic_salary: rec.basic_salary || 0,
        overtime_pay: rec.overtime_pay || 0,
        holiday_pay: rec.holiday_pay || 0,
        night_diff: rec.night_diff || 0,
        allowances: rec.allowances || 0,
        bonuses: rec.bonuses || 0,
        commission: rec.commission || 0,
        unpaid_salary: rec.unpaid_salary || 0,
        reimbursement: rec.reimbursement || 0,
        status: rec.status,
        absences: rec.absences || 0,
        tardiness: rec.tardiness || 0,
        cash_advance: rec.cash_advance || 0,
        sss: rec.sss || 0,
        philhealth: rec.philhealth || 0,
        pagibig: rec.pagibig || 0,
        withholding_tax: rec.withholding_tax || 0,
        loans: rec.loans || 0,
        uniform: rec.uniform || 0,
        total_deductions: totalDeductions,
        net_after_deductions: netAfterDeductions,
        total_net: netAfterDeductions,
        created_at: rec.created_at,
        updated_at: rec.updated_at || rec.created_at,
        creator_name: (rec as any).profiles?.[0]?.fullname || (rec as any).profiles?.fullname ||
          (rec.creator_id === "7229a103-7f3e-464c-8032-970b9df6220b" || !rec.creator_id ? "Joseph Baria" : "User " + rec.creator_id.substring(0, 5))
      }
    })

    const periodMap = new Map<string, PayrollPeriod>()

    processedRecords.forEach((record) => {
      const periodKey = `${record.period_start}_${record.period_end}`

      if (!periodMap.has(periodKey)) {
        const startDate = new Date(record.period_start)
        const endDate = new Date(record.period_end)
        const monthName = startDate.toLocaleDateString('en-US', { month: 'long' })
        const year = startDate.getFullYear()
        const displayName = `${monthName} ${startDate.getDate()}-${endDate.getDate()}, ${year}`

        periodMap.set(periodKey, {
          period_key: periodKey,
          period_start: record.period_start,
          period_end: record.period_end,
          display_name: displayName,
          total_employees: 0,
          total_basic_salary: 0,
          total_overtime: 0,
          total_deductions: 0,
          total_net_after_deductions: 0,
          records: [],
          status: record.status || "Pending",
          created_at: record.created_at,
          updated_at: record.updated_at || record.created_at,
          creator: (record as any).creator_name || "Joseph Baria"
        })
      }

      const period = periodMap.get(periodKey)!

      period.records.push(record)
      period.total_employees = period.records.length

      // ✅ Add each field once
      period.total_basic_salary += record.basic_salary || 0
      period.total_overtime += record.overtime_pay || 0
      period.total_holiday_pay = (period.total_holiday_pay || 0) + (record.holiday_pay || 0)
      period.total_deductions += record.total_deductions || 0
      period.total_net_after_deductions += record.total_net || 0

    })

    setPeriods(Array.from(periodMap.values()))
  }

  async function fetchEmployees() {
    if (activeOrganization === "pdn") {
      const { data, error } = await supabase.from("pdn_employees").select("id, full_name, pay_type")
      if (error) {
        console.error("Error fetching PDN employees:", error)
        return
      }
      setEmployees(data || [])
      return
    }

    const { data, error } = await supabase.from("employees").select("id, full_name, pay_type")
    if (error) {
      console.error("Error fetching employees:", error.message, error.hint, error.details)
      return
    }
    setEmployees(data)
  }


  function handleViewPeriodRecords(period: PayrollPeriod) {
    setSelectedPeriodRecords(period.records)
    setSelectedPeriodName(period.display_name)
    setPeriodDialogOpen(true)
    setSelectedIds([])
  }
  const summaryMetrics = {
    totalBasicSalary: periods.reduce((sum, p) => sum + p.total_basic_salary, 0),
    totalOvertime: periods.reduce((sum, p) => sum + p.total_overtime, 0),
    totalHoliday: periods.reduce((sum, p) => sum + (p.total_holiday_pay || 0), 0), // ✅ new
    totalNet: periods.reduce((sum, p) => sum + p.total_net_after_deductions, 0)
  }








  function handleSelectAll() {
    if (selectedIds.length === selectedPeriodRecords.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(selectedPeriodRecords.map(r => r.id))
    }
  }

  async function handleMarkSelectedAsPaid() {
    if (selectedIds.length === 0) {
      toast.warning("No records selected.")
      return
    }

    const confirm = window.confirm(`Mark ${selectedIds.length} record(s) as paid?`)
    if (!confirm) return

    const toastId = toast.loading("Updating payment status...")

    const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
    const { error } = await supabase
      .from(table)
      .update({
        status: "Paid",
        updated_at: new Date().toISOString()
      })
      .in("id", selectedIds)

    if (error) {
      toast.error("Failed to update status", { id: toastId })
      return
    }

    toast.success("Records marked as paid!", { id: toastId })

    setSelectedIds([])
    fetchPayrollPeriods()

    if (periodDialogOpen) {
      setSelectedPeriodRecords(prev =>
        prev.map(r =>
          selectedIds.includes(r.id) ? { ...r, status: "Paid" } : r
        )
      )
    }
  }

  async function handleMarkAsPaid(recordId: string) {
    const toastId = toast.loading("Marking as paid...")

    const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
    const { error } = await supabase
      .from(table)
      .update({
        status: "Paid",
        updated_at: new Date().toISOString()
      })
      .eq("id", recordId)

    if (error) {
      toast.error("Failed to update status", { id: toastId })
      return
    }

    toast.success("Marked as paid!", { id: toastId })
    fetchPayrollPeriods()

    if (periodDialogOpen) {
      setSelectedPeriodRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, status: "Paid" } : r
        )
      )
    }
  }

  async function handleUpdatePeriodStatus(period: PayrollPeriod, newStatus: string) {
    const toastId = toast.loading(`Updating status to ${newStatus}...`)

    const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
    const { error } = await supabase
      .from(table)
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("period_start", period.period_start)
      .eq("period_end", period.period_end)

    if (error) {
      toast.error(`Failed to update period status`, { id: toastId })
    } else {
      toast.success(`Period status updated to ${newStatus}!`, { id: toastId })
      fetchPayrollPeriods()
    }
  }




  const totalPages = Math.ceil(periods.length / itemsPerPage)
  const paginatedPeriods = periods.slice(
    (currentPeriodPage - 1) * itemsPerPage,
    currentPeriodPage * itemsPerPage
  )

  const formatPH = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A"
    try {
      // Ensure the date string is treated as UTC if no timezone is provided
      let normalizedDate = dateString
      if (!dateString.includes('Z') && !dateString.includes('+')) {
        normalizedDate = dateString.includes('T') ? `${dateString}Z` : `${dateString.replace(' ', 'T')}Z`
      }

      return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(normalizedDate))
    } catch (e) {
      console.error("Format error:", e)
      return "N/A"
    }
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Payroll Management</h1>
        <p className="text-muted-foreground">Manage employee payroll periods and generate bulk payroll records</p>
      </div>

      {periods.length > 0 && (
        <>
          {/* Summary Metrics Chips */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 shadow-sm">
              <PhilippinePeso className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">Total Net Pay</span>
              <span className="text-sm font-bold text-primary">₱{summaryMetrics.totalNet.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Basic Salary</span>
              <span className="text-sm font-bold text-foreground">₱{summaryMetrics.totalBasicSalary.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Total Overtime</span>
              <span className="text-sm font-bold text-foreground">₱{summaryMetrics.totalOvertime.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Periods</span>
              <span className="text-sm font-bold text-foreground">{periods.length}</span>
            </div>
          </div>

          {/* Latest Period Big Preview */}
          <Card className="border-2 border-primary/10 shadow-xl bg-card overflow-hidden relative group transition-all hover:border-primary/20">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <PhilippinePeso className="h-32 w-32" />
            </div>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Latest Payroll Period</span>
                    <h2 className="text-4xl font-black text-foreground tracking-tight">
                      {periods[0].display_name}
                    </h2>
                    <p className="text-sm text-muted-foreground font-mono">
                      {periods[0].period_start} to {periods[0].period_end}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase leading-none mb-1">Employees</span>
                        <span className="text-xs font-semibold">{periods[0].total_employees} Total</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase leading-none">Status</span>
                      <Badge className={cn("cursor-pointer border-transparent shadow-none", statusVariants[periods[0].status] || statusVariants["Pending"])}>
                        {periods[0].status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <Button
                    className="w-full md:w-48 h-12 text-base font-bold shadow-lg shadow-primary/20 group-hover:scale-[1.02] transition-transform"
                    onClick={() => handleViewPeriodRecords(periods[0])}
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    View Full Details
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10 pt-8 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Net Pay</p>
                  <p className="text-lg font-bold text-foreground">₱{periods[0].total_net_after_deductions.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Basic Salary</p>
                  <p className="text-lg font-bold text-foreground">₱{periods[0].total_basic_salary.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Overtime Pay</p>
                  <p className="text-lg font-bold text-foreground">₱{periods[0].total_overtime.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Deductions</p>
                  <p className="text-lg font-bold text-destructive">₱{periods[0].total_deductions.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Payroll Periods</h2>
          <p className="text-muted-foreground">View and manage payroll periods</p>
        </div>

        <Button 
          onClick={() => router.push("/payroll/generate")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg font-bold"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Payroll
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">No payroll periods found</h3>
              <p className="text-muted-foreground mb-4">Generate your first payroll to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-foreground w-[250px]">Payroll Period</TableHead>
                    <TableHead className="font-semibold text-foreground">Metrics</TableHead>
                    <TableHead className="font-semibold text-foreground">Generated On</TableHead>
                    <TableHead className="font-semibold text-foreground">Updated On</TableHead>
                    <TableHead className="font-semibold text-foreground">Creator</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPeriods.map((period) => (
                    <TableRow
                      key={period.period_key}
                      className="hover:bg-muted/30 border-b border-border last:border-0 transition-colors cursor-pointer"
                      onClick={() => handleViewPeriodRecords(period)}
                    >
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground truncate">{period.display_name}</span>
                          <span className="text-xs text-muted-foreground font-mono mt-0.5">
                            {period.period_start} to {period.period_end}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{period.total_employees} Employees</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Calculator className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">₱{period.total_net_after_deductions.toLocaleString()}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatPH(period.created_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatPH(period.updated_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border">
                            {period.creator?.charAt(0) || "S"}
                          </div>
                          <span className="text-muted-foreground truncate max-w-[100px]">{period.creator || "System"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-fit px-2 gap-2 hover:bg-transparent p-0">
                              <Badge className={cn("cursor-pointer border-transparent shadow-none", statusVariants[period.status] || statusVariants["Pending"])}>
                                {period.status}
                                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                              </Badge>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUpdatePeriodStatus(period, "Pending")}>
                              <Clock className="h-4 w-4 mr-2 text-slate-500" /> Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePeriodStatus(period, "Released")}>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" /> Released
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePeriodStatus(period, "Partially Released")}>
                              <AlertCircle className="h-4 w-4 mr-2 text-blue-500" /> Partially Released
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewPeriodRecords(period)
                            }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              setNotificationRecords(period.records)
                              setNotificationPeriodName(period.display_name)
                              setIsNotifyDialogOpen(true)
                            }}
                            title="Notify Employees"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePeriod(period.period_key)
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        <PayrollNotifyDialog
          open={isNotifyDialogOpen}
          onOpenChange={setIsNotifyDialogOpen}
          periodName={notificationPeriodName}
          records={notificationRecords}
          organization={activeOrganization}
        />
        {periods.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(currentPeriodPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPeriodPage * itemsPerPage, periods.length)}</span> of <span className="font-medium text-foreground">{periods.length}</span> periods
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPeriodPage(p => Math.max(1, p - 1))}
                disabled={currentPeriodPage === 1}
                className="h-8 px-3"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1.5">
                {[...Array(totalPages)].map((_, i) => (
                  <Button
                    key={i + 1}
                    variant={currentPeriodPage === i + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPeriodPage(i + 1)}
                    className={cn("h-8 w-8 p-0", currentPeriodPage === i + 1 ? "" : "")}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPeriodPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPeriodPage === totalPages}
                className="h-8 px-3"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent
          className="
    max-w-[95vw]
    w-full
    h-[90vh]
    overflow-hidden
    flex
    flex-col
  "
        >

          <DialogHeader className="pb-4 border-b border-border flex flex-row items-center justify-between gap-4">
            <DialogTitle className="text-xl font-semibold text-foreground">
              Payroll Details - {selectedPeriodName}
            </DialogTitle>
            <div className="relative w-70 pr-5">
              <Input
                placeholder="Search employee by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 border-primary/20 focus-visible:ring-primary/30"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 space-y-4 pt-4">


            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length} records selected
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkSelectedAsPaid}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark as Paid
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}


            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 border border-border rounded-lg overflow-auto shadow-inner [&_[data-slot=table-container]]:overflow-visible">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-primary hover:bg-primary">
                      <TableHead className="w-12 sticky top-0 bg-primary text-primary-foreground z-10 backdrop-blur-sm">
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.length === selectedPeriodRecords.length &&
                            selectedPeriodRecords.length > 0
                          }
                          onChange={handleSelectAll}
                          className="rounded"
                          title="Select all"
                        />
                      </TableHead>

                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Employee</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Pay Type</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Basic Salary</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Overtime Pay</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Holiday Pay</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Allowance</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Unpaid</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Reimb.</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">SSS</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">PhilHealth</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Pag-IBIG</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">W/Tax</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Loans</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Absences</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Tardiness</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Cash Advance</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Total Deductions</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Net After Deductions</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Total Net</TableHead>
                      <TableHead className="font-bold text-primary-foreground sticky top-0 bg-primary z-10 backdrop-blur-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPeriodRecords
                      .filter(rec =>
                        rec.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((rec) => (
                        <TableRow
                          key={rec.id}
                          onClick={() => {
                            setEditRecord(rec)
                            setEditDialogOpen(true)
                          }}
                          className="cursor-pointer hover:bg-muted/30 transition border-b border-border"
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(rec.id)}
                              onChange={() => handleSelect(rec.id)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0 shadow-sm">
                                {rec.profile_picture_url ? (
                                  <img src={rec.profile_picture_url} className="h-full w-full object-cover" alt="" />
                                ) : (
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              {rec.employee_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{rec.pay_type}</TableCell>
                          <TableCell className="text-foreground">₱{rec.basic_salary.toLocaleString()}</TableCell>
                          <TableCell className="text-foreground font-medium">₱{rec.overtime_pay.toLocaleString()}</TableCell>
                          <TableCell className="text-foreground">₱{rec.holiday_pay?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground">₱{rec.allowances?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground">₱{rec.unpaid_salary?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground">₱{rec.reimbursement?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-red-600/80 font-medium">₱{rec.sss?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-red-600/80 font-medium">₱{rec.philhealth?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-red-600/80 font-medium">₱{rec.pagibig?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-red-600/80 font-medium">₱{rec.withholding_tax?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-red-600/80 font-medium">₱{rec.loans?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground">₱{rec.absences?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground">₱{rec.tardiness?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground">₱{rec.cash_advance?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-foreground font-semibold">₱{rec.total_deductions?.toLocaleString()}</TableCell>
                          <TableCell className="text-foreground font-bold">₱{rec.net_after_deductions?.toLocaleString()}</TableCell>
                          <TableCell className="text-foreground font-bold">
                            ₱{rec.total_net?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium border",
                              statusVariants[rec.status] || "bg-muted text-muted-foreground border-border"
                            )}>
                              {rec.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {rec.status !== "Paid" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAsPaid(rec.id)
                                }}
                                className="text-green-600 hover:bg-green-50"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Mark Paid
                              </Button>
                            )}
                          </TableCell>

                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="lg:w-[50vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">Edit Payroll Record</DialogTitle>
          </DialogHeader>

          {editRecord && (
            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault()
                const toastId = toast.loading("Updating payroll...")

                const sss = editRecord.sss || 0
                const philhealth = editRecord.philhealth || 0
                const pagibig = editRecord.pagibig || 0
                const withholding_tax = editRecord.withholding_tax || 0
                const loans = editRecord.loans || 0
                const absences = editRecord.absences || 0
                const tardiness = editRecord.tardiness || 0
                const cash_advance = editRecord.cash_advance || 0

                const totalDeductions =
                  sss + philhealth + pagibig + withholding_tax + loans + absences + tardiness + cash_advance

                const grossPay =
                  (editRecord.basic_salary || 0) +
                  (editRecord.overtime_pay || 0) +
                  (editRecord.holiday_pay || 0) +
                  (editRecord.night_diff || 0) +
                  (editRecord.allowances || 0) +
                  (editRecord.unpaid_salary || 0) +
                  (editRecord.reimbursement || 0)
                const netPay = grossPay - totalDeductions

                const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
                const { error } = await supabase
                  .from(table)
                  .update({
                    basic_salary: editRecord.basic_salary,
                    overtime_pay: editRecord.overtime_pay,
                    allowances: editRecord.allowances || 0,
                    holiday_pay: editRecord.holiday_pay || 0,
                    night_diff: editRecord.night_diff || 0,
                    unpaid_salary: editRecord.unpaid_salary || 0,
                    reimbursement: editRecord.reimbursement || 0,
                    absences: absences,
                    tardiness: tardiness,
                    cash_advance: cash_advance,
                    sss: sss,
                    philhealth: philhealth,
                    pagibig: pagibig,
                    withholding_tax: withholding_tax,
                    loans: loans,
                    gross_pay: grossPay,
                    total_deductions: totalDeductions,
                    net_pay: netPay,
                    status: editRecord.status,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", editRecord.id)

                if (error) {
                  toast.error("Failed to update record", { id: toastId })
                } else {
                  toast.success("Payroll updated successfully", { id: toastId })
                  setEditDialogOpen(false)
                  fetchPayrollPeriods()
                  if (periodDialogOpen) {
                    const updatedRecords = selectedPeriodRecords.map(rec =>
                      rec.id === editRecord.id ? {
                        ...rec,
                        ...editRecord,
                        total_deductions: totalDeductions,
                        net_after_deductions: netPay,
                        total_net: netPay
                      } : rec
                    )
                    setSelectedPeriodRecords(updatedRecords)
                  }
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Employee</Label>
                  <Input
                    value={editRecord.employee_name || ""}
                    disabled
                    className="bg-muted/50 border-border"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Pay Type</Label>
                    <Input
                      value={editRecord.pay_type || ""}
                      disabled
                      className="bg-muted/50 border-border"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Period</Label>
                    <Input
                      value={editRecord.period_start && editRecord.period_end ?
                        `${format(new Date(editRecord.period_start), "MMM d")} - ${format(new Date(editRecord.period_end), "MMM d, yyyy")}` : ""}
                      disabled
                      className="bg-muted/50 border-border"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Basic Salary</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.basic_salary || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, basic_salary: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">Overtime Pay</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.overtime_pay || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, overtime_pay: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Allowances</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.allowances || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, allowances: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Holiday Pay</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.holiday_pay || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, holiday_pay: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Night differential</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.night_diff || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, night_diff: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Unpaid salary</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.unpaid_salary || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, unpaid_salary: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Reimbursement</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.reimbursement || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, reimbursement: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Absence Deductions</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.absences || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, absences: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Tardiness (Late)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.tardiness || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, tardiness: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Cash Advance Deduction</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.cash_advance || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, cash_advance: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>

                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">SSS Deduction</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.sss || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, sss: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">PhilHealth Deduction</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.philhealth || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, philhealth: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Pag-IBIG Deduction</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.pagibig || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, pagibig: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Withholding Tax</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={editRecord.withholding_tax || ""}
                      onChange={(e) =>
                        setEditRecord((prev) =>
                          prev ? { ...prev, withholding_tax: parseFloat(e.target.value) || 0 } : prev
                        )
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Loans</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={editRecord.loans || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setEditRecord((prev) =>
                        prev ? { ...prev, loans: val } : prev
                      )
                    }}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground">Payment Status</Label>
                  <Select
                    value={editRecord.status}
                    onValueChange={(val) =>
                      setEditRecord((prev) => prev && { ...prev, status: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending Payment">Pending Payment</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground">Calculated Values</h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Gross Pay (incl. unpaid & reimbursement):</span>
                    <div className="font-medium text-foreground">
                      ₱{(
                        (editRecord.basic_salary || 0) +
                        (editRecord.overtime_pay || 0) +
                        (editRecord.holiday_pay || 0) +
                        (editRecord.night_diff || 0) +
                        (editRecord.allowances || 0) +
                        (editRecord.unpaid_salary || 0) +
                        (editRecord.reimbursement || 0)
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Total Deductions:</span>
                    <div className="font-medium text-foreground text-red-600">
                      ₱{(
                        (editRecord.sss || 0) +
                        (editRecord.philhealth || 0) +
                        (editRecord.pagibig || 0) +
                        (editRecord.withholding_tax || 0) +
                        (editRecord.loans || 0) +
                        (editRecord.absences || 0) +
                        (editRecord.tardiness || 0) +
                        (editRecord.cash_advance || 0)
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-foreground">Final Net Pay:</span>
                    <div className="text-xl font-bold text-primary">
                      ₱{(
                        (editRecord.basic_salary || 0) +
                        (editRecord.overtime_pay || 0) +
                        (editRecord.holiday_pay || 0) +
                        (editRecord.night_diff || 0) +
                        (editRecord.allowances || 0) +
                        (editRecord.unpaid_salary || 0) +
                        (editRecord.reimbursement || 0) -
                        ((editRecord.sss || 0) +
                          (editRecord.philhealth || 0) +
                          (editRecord.pagibig || 0) +
                          (editRecord.withholding_tax || 0) +
                          (editRecord.loans || 0) +
                          (editRecord.absences || 0) +
                          (editRecord.tardiness || 0) +
                          (editRecord.cash_advance || 0))
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}