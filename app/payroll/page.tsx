"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { AbsenceDatesPicker } from "@/components/absence-dates-picker"
import { CalendarIcon, Trash2, Plus, X, Calculator, Users, PhilippinePeso, TrendingUp, FileText, Check, XCircle, Clock, CheckCircle, ChevronDown, CheckCircle2, AlertCircle, Search, Download, ChevronLeft, ChevronRight, HandCoins, Paperclip, ExternalLink, User, Wallet, Moon, Sun, Umbrella, BadgePercent, Building2, Banknote, Receipt, Shield } from "lucide-react"
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
import {
  PayrollEarningsReceipt,
  downloadPayrollReceiptPng,
} from "@/components/payroll-earnings-receipt"
import { ReceiptIcon } from "@/components/receipt-icon"
import { SendEmailIcon } from "@/components/send-email-icon"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"



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
  employee_code?: string
  department?: string
  position?: string
  pay_type?: string
  period_start: string
  period_end: string
  basic_salary: number
  overtime_pay: number
  holiday_pay?: number
  night_diff?: number
  rest_day_pay?: number
  allowances?: number
  bonuses?: number
  commission?: number
  unpaid_salary?: number
  reimbursement?: number
  thirteenth_month_pay?: number
  status: string
  absences?: number
  /** ISO dates (yyyy-MM-dd) for absence deduction */
  absence_dates?: string[] | null
  tardiness?: number
  cash_advance?: number
  sss?: number
  philhealth?: number
  pagibig?: number
  withholding_tax?: number
  loans?: number
  uniform?: number
  total_deductions?: number
  net_after_deductions?: number
  total_net?: number
  profile_picture_url?: string
}

type PartialPaymentAttachment = {
  name: string
  url: string
  uploaded_at?: string
}

type PartialSalaryPayment = {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  amount: number
  payment_date: string
  notes: string | null
  attachments?: PartialPaymentAttachment[] | null
  created_at: string
  updated_at?: string | null
}

type PayrollPeriod = {
  period_key: string
  period_start: string
  period_end: string
  run_id?: string | null
  display_name: string
  total_employees: number
  total_basic_salary: number
  total_overtime: number
  total_holiday_pay?: number
  total_deductions: number
  total_net_after_deductions: number
  /** Sum of gross pay (earnings before any deductions) across records in this period. */
  total_gross_pay: number
  records: PayrollRecord[]
  status: string
  created_at: string
  updated_at?: string
  creator: string
}

function payrollPeriodGroupKey(
  periodStart: string,
  periodEnd: string,
  runId?: string | null
) {
  return `${periodStart}_${periodEnd}_${runId ?? ""}`
}

function getRecordBatchId(
  rec: { run_id?: string | null; payroll_batch_id?: string | null },
  organization: "pdn" | "petrosphere"
) {
  return organization === "pdn" ? rec.payroll_batch_id ?? null : rec.run_id ?? null
}

function applyPayrollPeriodVersionLabels(periods: PayrollPeriod[]): PayrollPeriod[] {
  const byRange = new Map<string, PayrollPeriod[]>()
  for (const p of periods) {
    const range = `${p.period_start}_${p.period_end}`
    if (!byRange.has(range)) byRange.set(range, [])
    byRange.get(range)!.push(p)
  }
  for (const list of byRange.values()) {
    if (list.length <= 1) continue
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    list.forEach((p, i) => {
      const base = p.display_name.replace(/ · v\d+$/, "")
      p.display_name = `${base} · v${i + 1}`
    })
  }
  return periods
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
  const searchParams = useSearchParams()
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
  const [periodDialogContext, setPeriodDialogContext] = useState<PayrollPeriod | null>(null)
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

  const [partialDialogOpen, setPartialDialogOpen] = useState(false)
  const [partialRecord, setPartialRecord] = useState<PayrollRecord | null>(null)
  const [partialEntries, setPartialEntries] = useState<PartialSalaryPayment[]>([])
  const [partialLoading, setPartialLoading] = useState(false)
  const [partialSaving, setPartialSaving] = useState(false)
  const [partialForm, setPartialForm] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    files: [] as File[],
  })
  const [uploadingAttachmentFor, setUploadingAttachmentFor] = useState<string | null>(null)

  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [receiptPeriod, setReceiptPeriod] = useState<PayrollPeriod | null>(null)
  const [receiptRecordId, setReceiptRecordId] = useState<string | null>(null)
  const [receiptEmployeePickerOpen, setReceiptEmployeePickerOpen] = useState(false)

  const RECEIPT_EXPORT_ID = "payroll-receipt-export"

  type PayrollWorkspace = {
    id: string
    name: string
    organization: string
    created_at: string
  }

  /** null = Regular Payroll (default tab) */
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => searchParams.get("workspace")
  )
  const [workspaces, setWorkspaces] = useState<PayrollWorkspace[]>([])
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)

  useEffect(() => {
    const fromUrl = searchParams.get("workspace")
    if (fromUrl !== activeWorkspaceId) {
      // Keep URL and tab in sync when navigating back from generate
      if (fromUrl) setActiveWorkspaceId(fromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    fetchWorkspaces()
  }, [activeOrganization])

  useEffect(() => {
    fetchPayrollPeriods()
    fetchEmployees()
    setCurrentPeriodPage(1)
  }, [activeOrganization, activeWorkspaceId])

  async function fetchWorkspaces() {
    const org = activeOrganization === "pdn" ? "pdn" : "petrosphere"
    const { data, error } = await supabase
      .from("payroll_workspaces")
      .select("id, name, organization, created_at")
      .eq("organization", org)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching payroll workspaces:", error)
      // Table may not exist yet — keep empty list
      setWorkspaces([])
      return
    }
    setWorkspaces(data || [])
    // If current tab was deleted / org switched, fall back to Regular
    if (activeWorkspaceId && !(data || []).some((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(null)
    }
  }

  async function handleCreateWorkspace() {
    const name = newWorkspaceName.trim()
    if (!name) {
      toast.warning("Enter a name for this custom payroll.")
      return
    }

    setCreatingWorkspace(true)
    const { data: { user } } = await supabase.auth.getUser()
    const org = activeOrganization === "pdn" ? "pdn" : "petrosphere"
    const { data, error } = await supabase
      .from("payroll_workspaces")
      .insert({
        name,
        organization: org,
        creator_id: user?.id ?? null,
      })
      .select("id, name, organization, created_at")
      .single()
    setCreatingWorkspace(false)

    if (error || !data) {
      console.error("Error creating payroll workspace:", error)
      toast.error(
        error?.message?.includes("does not exist")
          ? "Workspaces table missing. Run payroll_add_workspaces.sql in Supabase."
          : "Failed to create custom payroll."
      )
      return
    }

    setWorkspaces((prev) => [...prev, data])
    setActiveWorkspaceId(data.id)
    setNewWorkspaceName("")
    setCreateWorkspaceOpen(false)
    toast.success(`Custom payroll “${name}” created.`)
  }

  async function handleDeleteWorkspace(workspace: PayrollWorkspace) {
    const confirmed = window.confirm(
      `Delete custom payroll “${workspace.name}”? Records in this workspace keep their data but become unassigned (Regular).`
    )
    if (!confirmed) return

    const toastId = toast.loading("Deleting custom payroll…")
    const { error } = await supabase.from("payroll_workspaces").delete().eq("id", workspace.id)
    if (error) {
      toast.error("Failed to delete custom payroll.", { id: toastId })
      return
    }

    setWorkspaces((prev) => prev.filter((w) => w.id !== workspace.id))
    if (activeWorkspaceId === workspace.id) setActiveWorkspaceId(null)
    toast.success("Custom payroll deleted.", { id: toastId })
  }

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
    let deleteQuery = supabase
      .from(table)
      .delete()
      .eq("period_start", period.period_start)
      .eq("period_end", period.period_end)

    if (activeOrganization === "pdn") {
      if (period.run_id) {
        deleteQuery = deleteQuery.eq("payroll_batch_id", period.run_id)
      } else {
        deleteQuery = deleteQuery.is("payroll_batch_id", null)
      }
    } else if (period.run_id) {
      deleteQuery = deleteQuery.eq("run_id", period.run_id)
    } else {
      deleteQuery = deleteQuery.is("run_id", null)
    }

    deleteQuery = activeWorkspaceId
      ? deleteQuery.eq("workspace_id", activeWorkspaceId)
      : deleteQuery.is("workspace_id", null)

    const { error } = await deleteQuery

    if (error) {
      toast.error("Failed to delete payroll period", { id: toastId })
    } else {
      toast.success("Payroll period deleted!", { id: toastId })
      fetchPayrollPeriods()
    }
  }

  async function fetchPayrollPeriods() {
    if (activeOrganization === "pdn") {
      let pdnQuery = supabase
        .from("pdn_payroll_records")
        .select(`
          id, employee_id, period_start, period_end, payroll_batch_id, basic_salary,
          overtime_pay, holiday_pay, night_diff, rest_day_pay, allowances, bonuses, commission,
          unpaid_salary, reimbursement, thirteenth_month_pay,
          absences, absence_dates, tardiness,
          cash_advance, sss, philhealth, pagibig, withholding_tax, loans, uniform,
          total_deductions, net_pay, status, created_at, updated_at, creator_id,
          pdn_employees(full_name, pay_type, profile_picture_url, employee_code, department, position)
        `)
        .order("period_end", { ascending: false })

      pdnQuery = activeWorkspaceId
        ? pdnQuery.eq("workspace_id", activeWorkspaceId)
        : pdnQuery.is("workspace_id", null)

      const { data: payroll, error } = await pdnQuery

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
          (rec.rest_day_pay || 0) +
          (rec.allowances || 0) +
          (rec.bonuses || 0) +
          (rec.commission || 0) +
          (rec.unpaid_salary || 0) +
          (rec.reimbursement || 0) +
          (rec.thirteenth_month_pay || 0)
        const totalDeductions = rec.total_deductions || 0
        const netAfterDeductions = grossPay - totalDeductions

        return {
          id: rec.id,
          employee_id: rec.employee_id,
          employee_name: rec.pdn_employees?.full_name,
          employee_code: rec.pdn_employees?.employee_code,
          department: rec.pdn_employees?.department,
          position: rec.pdn_employees?.position,
          pay_type: rec.pdn_employees?.pay_type,
          profile_picture_url: rec.pdn_employees?.profile_picture_url,
          period_start: rec.period_start,
          period_end: rec.period_end,
          run_id: getRecordBatchId(rec, "pdn"),
          basic_salary: rec.basic_salary || 0,
          overtime_pay: rec.overtime_pay || 0,
          holiday_pay: rec.holiday_pay || 0,
          night_diff: rec.night_diff || 0,
          rest_day_pay: rec.rest_day_pay || 0,
          allowances: rec.allowances || 0,
          bonuses: rec.bonuses || 0,
          commission: rec.commission || 0,
          unpaid_salary: rec.unpaid_salary || 0,
          reimbursement: rec.reimbursement || 0,
          thirteenth_month_pay: rec.thirteenth_month_pay || 0,
          status: rec.status,
          absences: rec.absences || 0,
          absence_dates: Array.isArray(rec.absence_dates) ? rec.absence_dates : [],
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
        const runId = record.run_id ?? null
        const periodKey = payrollPeriodGroupKey(record.period_start, record.period_end, runId)

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
            run_id: runId,
            display_name: displayName,
            total_employees: 0,
            total_basic_salary: 0,
            total_overtime: 0,
            total_deductions: 0,
            total_net_after_deductions: 0,
            total_gross_pay: 0,
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
        period.total_gross_pay +=
          (record.net_after_deductions ?? record.total_net ?? 0) + (record.total_deductions || 0)
      })

      setPeriods(applyPayrollPeriodVersionLabels(Array.from(periodMap.values())))
      return
    }

    let payrollQuery = supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_start,
        period_end,
        run_id,
        basic_salary,
        overtime_pay,
        holiday_pay,
        night_diff,
        rest_day_pay,
        allowances,
        bonuses,
        commission,
        unpaid_salary,
        reimbursement,
        thirteenth_month_pay,
        absences,
        absence_dates,
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
        employees(full_name, pay_type, profile_picture_url, employee_code, department, position)
      `)
      .order("period_end", { ascending: false })

    payrollQuery = activeWorkspaceId
      ? payrollQuery.eq("workspace_id", activeWorkspaceId)
      : payrollQuery.is("workspace_id", null)

    const { data: payroll, error } = await payrollQuery

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
        (rec.rest_day_pay || 0) +
        (rec.allowances || 0) +
        (rec.bonuses || 0) +
        (rec.commission || 0) +
        (rec.unpaid_salary || 0) +
        (rec.reimbursement || 0) +
        (rec.thirteenth_month_pay || 0)

      const totalDeductions = (rec.total_deductions || 0)
      const netAfterDeductions = grossPay - totalDeductions

      return {
        id: rec.id,
        employee_id: rec.employee_id,
        employee_name: rec.employees?.full_name,
        employee_code: rec.employees?.employee_code,
        department: rec.employees?.department,
        position: rec.employees?.position,
        pay_type: rec.employees?.pay_type,
        profile_picture_url: rec.employees?.profile_picture_url,
        period_start: rec.period_start,
        period_end: rec.period_end,
        run_id: rec.run_id ?? null,
        basic_salary: rec.basic_salary || 0,
        overtime_pay: rec.overtime_pay || 0,
        holiday_pay: rec.holiday_pay || 0,
        night_diff: rec.night_diff || 0,
        rest_day_pay: rec.rest_day_pay || 0,
        allowances: rec.allowances || 0,
        bonuses: rec.bonuses || 0,
        commission: rec.commission || 0,
        unpaid_salary: rec.unpaid_salary || 0,
        reimbursement: rec.reimbursement || 0,
        thirteenth_month_pay: rec.thirteenth_month_pay || 0,
        status: rec.status,
        absences: rec.absences || 0,
        absence_dates: Array.isArray(rec.absence_dates) ? rec.absence_dates : [],
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
      const runId = (record as { run_id?: string | null }).run_id ?? null
      const periodKey = payrollPeriodGroupKey(record.period_start, record.period_end, runId)

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
          run_id: runId,
          display_name: displayName,
          total_employees: 0,
          total_basic_salary: 0,
          total_overtime: 0,
          total_deductions: 0,
          total_net_after_deductions: 0,
          total_gross_pay: 0,
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
      period.total_gross_pay +=
        (record.net_after_deductions ?? record.total_net ?? 0) + (record.total_deductions || 0)

    })

    setPeriods(applyPayrollPeriodVersionLabels(Array.from(periodMap.values())))
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
    setPeriodDialogContext(period)
    setSelectedPeriodRecords(period.records)
    setSelectedPeriodName(period.display_name)
    setPeriodDialogOpen(true)
    setSelectedIds([])
  }

  function openReceiptDialog(period: PayrollPeriod, preferredEmployeeId?: string | null) {
    if (!period.records.length) {
      toast.warning("No payroll rows for this period.")
      return
    }
    const sorted = [...period.records].sort((a, b) =>
      (a.employee_name || "").localeCompare(b.employee_name || "", undefined, { sensitivity: "base" })
    )
    const fallbackId = sorted[0]?.id ?? null
    const chosen =
      preferredEmployeeId && period.records.some((r) => r.id === preferredEmployeeId)
        ? preferredEmployeeId
        : fallbackId
    setReceiptPeriod(period)
    setReceiptRecordId(chosen)
    setReceiptDialogOpen(true)
  }

  async function handleDownloadReceipt() {
    const rec = receiptPeriod?.records.find((r) => r.id === receiptRecordId)
    if (!rec || !receiptPeriod) return
    const toastId = toast.loading("Downloading receipt...")
    try {
      const safeName = (rec.employee_name || "employee").replace(/[^\w\-]+/g, "_")
      await downloadPayrollReceiptPng(
        RECEIPT_EXPORT_ID,
        `earnings_${safeName}_${receiptPeriod.period_start}_${receiptPeriod.period_end}`
      )
      toast.success("Receipt downloaded", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download receipt", { id: toastId })
    }
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
      .update({ status: "Paid" })
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
      .update({ status: "Paid" })
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
    let statusQuery = supabase
      .from(table)
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("period_start", period.period_start)
      .eq("period_end", period.period_end)

    if (activeOrganization === "pdn") {
      statusQuery = period.run_id
        ? statusQuery.eq("payroll_batch_id", period.run_id)
        : statusQuery.is("payroll_batch_id", null)
    } else {
      statusQuery = period.run_id
        ? statusQuery.eq("run_id", period.run_id)
        : statusQuery.is("run_id", null)
    }

    statusQuery = activeWorkspaceId
      ? statusQuery.eq("workspace_id", activeWorkspaceId)
      : statusQuery.is("workspace_id", null)

    const { error } = await statusQuery

    if (error) {
      toast.error(`Failed to update period status`, { id: toastId })
    } else {
      toast.success(`Period status updated to ${newStatus}!`, { id: toastId })
      fetchPayrollPeriods()
    }
  }

  const partialPaymentsTable =
    activeOrganization === "pdn" ? "pdn_partial_salary_payments" : "partial_salary_payments"

  function recordGrossPay(rec: PayrollRecord) {
    return (
      (rec.basic_salary || 0) +
      (rec.overtime_pay || 0) +
      (rec.holiday_pay || 0) +
      (rec.night_diff || 0) +
      (rec.rest_day_pay || 0) +
      (rec.allowances || 0) +
      (rec.bonuses || 0) +
      (rec.commission || 0) +
      (rec.unpaid_salary || 0) +
      (rec.reimbursement || 0) +
      (rec.thirteenth_month_pay || 0)
    )
  }

  /** Deductions excluding the partial-salary (cash_advance) portion. */
  function recordBaseDeductions(rec: PayrollRecord) {
    return (
      (rec.sss || 0) +
      (rec.philhealth || 0) +
      (rec.pagibig || 0) +
      (rec.withholding_tax || 0) +
      (rec.loans || 0) +
      (rec.absences || 0) +
      (rec.tardiness || 0)
    )
  }

  async function uploadPartialAttachments(files: File[]): Promise<PartialPaymentAttachment[]> {
    if (files.length === 0) return []
    const body = new FormData()
    for (const file of files) body.append("files", file)

    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = {}
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    const res = await fetch("/api/upload-partial-attachment", {
      method: "POST",
      body,
      headers,
      credentials: "same-origin",
      redirect: "manual",
    })

    if (res.type === "opaqueredirect" || res.status === 0 || (res.status >= 300 && res.status < 400)) {
      throw new Error("Upload blocked by auth redirect. Please refresh and sign in again.")
    }

    const text = await res.text()
    let json: { error?: string; files?: PartialPaymentAttachment[] } = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(
        res.status === 404
          ? "Upload API not found on server. Redeploy the latest build."
          : `Upload failed (${res.status}). Server returned a non-JSON response.`
      )
    }

    if (!res.ok) throw new Error(json.error || "Upload failed")
    return (json.files || []) as PartialPaymentAttachment[]
  }

  async function openPartialPaymentsDialog(rec: PayrollRecord) {
    setPartialRecord(rec)
    setPartialEntries([])
    setPartialForm({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), notes: "", files: [] })
    setPartialDialogOpen(true)
    setPartialLoading(true)

    const { data, error } = await supabase
      .from(partialPaymentsTable)
      .select("id, employee_id, period_start, period_end, amount, payment_date, notes, attachments, created_at, updated_at")
      .eq("employee_id", rec.employee_id)
      .eq("period_start", rec.period_start)
      .eq("period_end", rec.period_end)
      .order("payment_date", { ascending: true })

    setPartialLoading(false)
    if (error) {
      console.error("Error fetching partial salary payments:", error)
      toast.error(
        error.message.includes("does not exist")
          ? "Partial payments table missing. Run partial_salary_payments.sql in Supabase."
          : error.message.includes("attachments") || error.message.includes("updated_at")
            ? "Run partial_salary_payments_attachments.sql in Supabase to enable attachments."
            : "Failed to load partial salary payments."
      )
      return
    }
    setPartialEntries(data || [])
  }

  /** Sync the sum of partial payments into the payroll record (cash_advance) and recompute totals. */
  async function syncPartialTotalsToRecord(rec: PayrollRecord, totalPartial: number) {
    const grossPay = recordGrossPay(rec)
    const totalDeductions = recordBaseDeductions(rec) + totalPartial
    const netPay = grossPay - totalDeductions

    const table = activeOrganization === "pdn" ? "pdn_payroll_records" : "payroll_records"
    const { error } = await supabase
      .from(table)
      .update({
        cash_advance: totalPartial,
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        net_pay: netPay,
      })
      .eq("id", rec.id)

    if (error) {
      console.error("Error syncing partial totals to payroll record:", error)
      toast.error("Saved the payment, but failed to update the payroll record totals.")
      return
    }

    const patch = {
      cash_advance: totalPartial,
      total_deductions: totalDeductions,
      net_after_deductions: netPay,
      total_net: netPay,
    }
    setPartialRecord((prev) => (prev && prev.id === rec.id ? { ...prev, ...patch } : prev))
    setSelectedPeriodRecords((prev) => prev.map((r) => (r.id === rec.id ? { ...r, ...patch } : r)))
    fetchPayrollPeriods()
  }

  async function handleAddPartialPayment() {
    if (!partialRecord) return
    const amount = Math.round((parseFloat(partialForm.amount) || 0) * 100) / 100
    if (amount <= 0) {
      toast.warning("Enter a partial payment amount greater than zero.")
      return
    }
    if (!partialForm.payment_date) {
      toast.warning("Select the date the partial payment was given.")
      return
    }

    setPartialSaving(true)
    try {
      let attachments: PartialPaymentAttachment[] = []
      if (partialForm.files.length > 0) {
        attachments = await uploadPartialAttachments(partialForm.files)
      }

      const nowIso = new Date().toISOString()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from(partialPaymentsTable)
        .insert({
          employee_id: partialRecord.employee_id,
          period_start: partialRecord.period_start,
          period_end: partialRecord.period_end,
          amount,
          payment_date: partialForm.payment_date,
          notes: partialForm.notes.trim() || null,
          attachments,
          creator_id: user?.id ?? null,
          updated_at: nowIso,
        })
        .select("id, employee_id, period_start, period_end, amount, payment_date, notes, attachments, created_at, updated_at")
        .single()

      if (error || !data) {
        console.error("Error adding partial salary payment:", error)
        toast.error(
          error?.message.includes("does not exist")
            ? "Partial payments table missing. Run partial_salary_payments.sql in Supabase."
            : error?.message.includes("attachments") || error?.message.includes("updated_at")
              ? "Run partial_salary_payments_attachments.sql in Supabase."
              : "Failed to add partial salary payment."
        )
        return
      }

      const updated = [...partialEntries, data].sort((a, b) => a.payment_date.localeCompare(b.payment_date))
      setPartialEntries(updated)
      setPartialForm({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), notes: "", files: [] })
      toast.success("Partial salary payment recorded.")
      await syncPartialTotalsToRecord(partialRecord, updated.reduce((s, p) => s + (p.amount || 0), 0))
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Failed to add partial salary payment.")
    } finally {
      setPartialSaving(false)
    }
  }

  async function handleAddAttachmentsToPayment(entry: PartialSalaryPayment, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setUploadingAttachmentFor(entry.id)
    try {
      const uploaded = await uploadPartialAttachments(files)
      const nextAttachments = [...(entry.attachments || []), ...uploaded]
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from(partialPaymentsTable)
        .update({ attachments: nextAttachments, updated_at: nowIso })
        .eq("id", entry.id)
        .select("id, employee_id, period_start, period_end, amount, payment_date, notes, attachments, created_at, updated_at")
        .single()

      if (error || !data) {
        console.error("Error updating attachments:", error)
        toast.error(
          error?.message.includes("attachments")
            ? "Run partial_salary_payments_attachments.sql in Supabase."
            : "Failed to save attachments."
        )
        return
      }

      setPartialEntries((prev) => prev.map((p) => (p.id === entry.id ? data : p)))
      toast.success(`${uploaded.length} attachment(s) added.`)
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Failed to upload attachments.")
    } finally {
      setUploadingAttachmentFor(null)
    }
  }

  async function handleRemoveAttachment(entry: PartialSalaryPayment, url: string) {
    const nextAttachments = (entry.attachments || []).filter((a) => a.url !== url)
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from(partialPaymentsTable)
      .update({ attachments: nextAttachments, updated_at: nowIso })
      .eq("id", entry.id)
      .select("id, employee_id, period_start, period_end, amount, payment_date, notes, attachments, created_at, updated_at")
      .single()

    if (error || !data) {
      toast.error("Failed to remove attachment.")
      return
    }
    setPartialEntries((prev) => prev.map((p) => (p.id === entry.id ? data : p)))
  }

  async function handleDeletePartialPayment(entry: PartialSalaryPayment) {
    if (!partialRecord) return
    const confirmed = window.confirm(
      `Delete the ₱${entry.amount.toLocaleString()} partial payment dated ${entry.payment_date}?`
    )
    if (!confirmed) return

    const { error } = await supabase.from(partialPaymentsTable).delete().eq("id", entry.id)
    if (error) {
      console.error("Error deleting partial salary payment:", error)
      toast.error("Failed to delete partial salary payment.")
      return
    }

    const updated = partialEntries.filter((p) => p.id !== entry.id)
    setPartialEntries(updated)
    toast.success("Partial salary payment deleted.")
    await syncPartialTotalsToRecord(partialRecord, updated.reduce((s, p) => s + (p.amount || 0), 0))
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

  const receiptSorted =
    receiptPeriod == null
      ? []
      : [...receiptPeriod.records].sort((a, b) =>
          (a.employee_name || "").localeCompare(b.employee_name || "", undefined, { sensitivity: "base" })
        )
  const receiptNavIndex = receiptRecordId ? receiptSorted.findIndex((r) => r.id === receiptRecordId) : -1
  const currentReceiptRecord =
    receiptRecordId && receiptPeriod ? receiptPeriod.records.find((r) => r.id === receiptRecordId) : undefined

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground">Manage employee payroll periods and generate bulk payroll records</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setNewWorkspaceName("")
            setCreateWorkspaceOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Payroll
        </Button>
      </div>

      <div className="rounded-xl border-2 border-primary/20 bg-muted/40 p-2 sm:p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground px-1.5 mr-1">
            Payroll view
          </span>
          <button
            type="button"
            onClick={() => setActiveWorkspaceId(null)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold border-2 transition-all",
              activeWorkspaceId === null
                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
            )}
          >
            <FileText className="h-4 w-4 shrink-0 opacity-90" />
            Regular Payroll
          </button>
          {workspaces.map((ws) => {
            const isActive = activeWorkspaceId === ws.id
            return (
              <div key={ws.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceId(ws.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold border-2 transition-all",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <Calculator className="h-4 w-4 shrink-0 opacity-90" />
                  {ws.name}
                </button>
                {isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    title={`Delete ${ws.name}`}
                    onClick={() => handleDeleteWorkspace(ws)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {activeWorkspaceId && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 px-1">
            Viewing custom payroll:{" "}
            <span className="font-semibold text-foreground">
              {workspaces.find((w) => w.id === activeWorkspaceId)?.name || "—"}
            </span>
            . Periods and generation here are separate from Regular Payroll.
          </p>
        )}
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

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <Button
                    className="w-full md:w-48 h-12 text-base font-bold shadow-lg shadow-primary/20 group-hover:scale-[1.02] transition-transform"
                    onClick={() => openReceiptDialog(periods[0])}
                  >
                    <ReceiptIcon className="mr-2 h-5 w-5" />
                    View pay slips
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full md:w-48 h-9 text-sm"
                    onClick={() => handleViewPeriodRecords(periods[0])}
                  >
                    Manage payroll records
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10 pt-8 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Before Deductions</p>
                  <p className="text-lg font-bold text-foreground">
                    ₱{(periods[0].total_gross_pay || periods[0].total_net_after_deductions + periods[0].total_deductions).toLocaleString()}
                  </p>
                  {(periods[0].total_deductions || 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      After deductions: ₱{periods[0].total_net_after_deductions.toLocaleString()}
                    </p>
                  )}
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
          <p className="text-muted-foreground">
            {activeWorkspaceId
              ? `Periods for ${workspaces.find((w) => w.id === activeWorkspaceId)?.name || "this custom payroll"}`
              : "View and manage payroll periods"}
          </p>
        </div>

        <Button 
          onClick={() =>
            router.push(
              activeWorkspaceId
                ? `/payroll/generate?workspace=${activeWorkspaceId}`
                : "/payroll/generate"
            )
          }
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
              <p className="text-muted-foreground mb-4">
                {activeWorkspaceId
                  ? "Generate payroll in this custom ledger to get started"
                  : "Generate your first payroll to get started"}
              </p>
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
                      className="border-b border-border last:border-0 cursor-pointer transition-colors duration-150 hover:bg-primary/10 dark:hover:bg-primary/20 active:bg-primary/[0.14]"
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
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                ₱{(period.total_gross_pay || period.total_net_after_deductions + period.total_deductions).toLocaleString()}
                              </span>
                              {(period.total_deductions || 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  After deductions: ₱{period.total_net_after_deductions.toLocaleString()}
                                </span>
                              )}
                            </div>
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
                              openReceiptDialog(period)
                            }}
                            title="View earnings receipt"
                          >
                            <ReceiptIcon className="h-4 w-4" />
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
                            <SendEmailIcon className="h-4 w-4" />
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

        <Dialog
          open={receiptDialogOpen}
          onOpenChange={(open) => {
            setReceiptDialogOpen(open)
            if (!open) {
              setReceiptPeriod(null)
              setReceiptRecordId(null)
              setReceiptEmployeePickerOpen(false)
            }
          }}
        >
          <DialogContent className="lg:w-[50vw] w-[90vw] p-5 overflow-hidden max-h-[92vh] overflow-y-auto">
            <DialogHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
              <DialogTitle className="text-xl font-semibold text-foreground pr-8">
                Earnings receipt{receiptPeriod ? ` — ${receiptPeriod.display_name}` : ""}
              </DialogTitle>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={() => void handleDownloadReceipt()}
                disabled={!currentReceiptRecord}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-border">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={receiptNavIndex <= 0}
                onClick={() => {
                  if (receiptNavIndex > 0) setReceiptRecordId(receiptSorted[receiptNavIndex - 1].id)
                }}
                aria-label="Previous employee"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={receiptEmployeePickerOpen} onOpenChange={setReceiptEmployeePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={receiptEmployeePickerOpen}
                    className="min-w-[200px] max-w-[min(100vw-8rem,320px)] justify-between font-normal"
                  >
                    <span
                      className={cn(
                        "truncate",
                        !currentReceiptRecord && "text-muted-foreground"
                      )}
                    >
                      {currentReceiptRecord?.employee_name ?? "Select employee"}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[200px] max-w-[min(100vw-8rem,320px)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search employee..." />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {receiptSorted.map((r) => (
                          <CommandItem
                            key={r.id}
                            value={r.id}
                            keywords={[
                              r.employee_name ?? "",
                              r.employee_code ?? "",
                              r.employee_id ?? "",
                            ]}
                            onSelect={() => {
                              setReceiptRecordId(r.id)
                              setReceiptEmployeePickerOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                receiptRecordId === r.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{r.employee_name || r.id}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={receiptNavIndex < 0 || receiptNavIndex >= receiptSorted.length - 1}
                onClick={() => {
                  if (receiptNavIndex >= 0 && receiptNavIndex < receiptSorted.length - 1) {
                    setReceiptRecordId(receiptSorted[receiptNavIndex + 1].id)
                  }
                }}
                aria-label="Next employee"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {currentReceiptRecord ? (
              <div className="pt-2">
                <PayrollEarningsReceipt
                  exportRootId={RECEIPT_EXPORT_ID}
                  organization={activeOrganization === "pdn" ? "pdn" : "petrosphere"}
                  record={currentReceiptRecord}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Select an employee to preview the receipt.</p>
            )}
          </DialogContent>
        </Dialog>
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

      <Dialog
        open={periodDialogOpen}
        onOpenChange={(open) => {
          setPeriodDialogOpen(open)
          if (!open) setPeriodDialogContext(null)
        }}
      >
        <DialogContent
          className="
            w-[calc(100%-1rem)] max-w-[calc(100%-1rem)]
            sm:max-w-[95vw] lg:max-w-[92vw]
            max-h-[92dvh] h-[92dvh]
            overflow-hidden !flex !flex-col p-0 gap-0
          "
        >
          {(() => {
            const filteredPeriodRecords = selectedPeriodRecords.filter((rec) =>
              rec.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            const periodGross = filteredPeriodRecords.reduce((s, r) => s + recordGrossPay(r), 0)
            const periodNet = filteredPeriodRecords.reduce((s, r) => s + (r.total_net || 0), 0)
            const periodDed = filteredPeriodRecords.reduce((s, r) => s + (r.total_deductions || 0), 0)
            const money = (n?: number | null) =>
              `₱${(Number(n) || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`
            const thBase =
              "sticky top-0 z-20 whitespace-nowrap px-2.5 py-2.5 text-[10px] font-black uppercase tracking-wider border-b border-border/40"
            const earnTh = cn(thBase, "bg-emerald-700 text-emerald-50")
            const dedTh = cn(thBase, "bg-rose-700 text-rose-50")
            const metaTh = cn(thBase, "bg-slate-800 text-slate-50")
            const netTh = cn(thBase, "bg-primary text-primary-foreground")
            const earnTd = "bg-emerald-500/[0.03] text-foreground tabular-nums text-xs px-2.5 py-2.5 whitespace-nowrap"
            const dedTd = "bg-rose-500/[0.04] text-rose-700/90 dark:text-rose-300 tabular-nums text-xs px-2.5 py-2.5 whitespace-nowrap font-medium"
            const netTd = "bg-primary/5 text-foreground tabular-nums text-xs px-2.5 py-2.5 whitespace-nowrap font-bold"

            return (
              <>
          <DialogHeader className="px-4 sm:px-5 py-4 border-b border-border bg-muted/30 text-left shrink-0 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between pr-8">
              <div className="space-y-1 min-w-0">
                <DialogTitle className="text-base sm:text-xl font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  Payroll Details
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                  {selectedPeriodName}
                </p>
              </div>
              <div className="relative w-full lg:w-72 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-background border-border"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px]">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Employees</span>
                <span className="font-bold text-foreground">{filteredPeriodRecords.length}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px]">
                <Wallet className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700/80 dark:text-emerald-400">Gross</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{money(periodGross)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 text-[11px]">
                <AlertCircle className="h-3 w-3 text-rose-600" />
                <span className="text-rose-700/80 dark:text-rose-400">Deductions</span>
                <span className="font-bold text-rose-700 dark:text-rose-300 tabular-nums">{money(periodDed)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px]">
                <PhilippinePeso className="h-3 w-3 text-primary" />
                <span className="text-primary/80">Net</span>
                <span className="font-bold text-primary tabular-nums">{money(periodNet)}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 px-3 sm:px-4 py-3 gap-3">
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3 bg-amber-500/5 rounded-xl border border-amber-500/25 shrink-0">
                <Badge variant="secondary" className="font-semibold">
                  {selectedIds.length} selected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkSelectedAsPaid}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8 text-xs"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Mark Paid
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeleteSelected} className="h-8 text-xs text-rose-700 border-rose-200 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            )}

            {/* Mobile: compact cards */}
            <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === selectedPeriodRecords.length &&
                      selectedPeriodRecords.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                  Select all
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {filteredPeriodRecords.length} employees
                </span>
              </div>
              {filteredPeriodRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rec.id)}
                        onChange={() => handleSelect(rec.id)}
                        className="mt-1.5 rounded shrink-0"
                      />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => {
                          setEditRecord(rec)
                          setEditDialogOpen(true)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                            {rec.profile_picture_url ? (
                              <img src={rec.profile_picture_url} className="h-full w-full object-cover" alt="" />
                            ) : (
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{rec.employee_name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{rec.pay_type?.replace(/-/g, " ") || "—"}</p>
                          </div>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                              statusVariants[rec.status] || "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {rec.status}
                          </span>
                        </div>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pl-6">
                      <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2 py-1.5 flex justify-between gap-1">
                        <span className="text-emerald-700/70 dark:text-emerald-400">Gross</span>
                        <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">{money(recordGrossPay(rec))}</span>
                      </div>
                      <div className="rounded-lg border border-rose-500/15 bg-rose-500/5 px-2 py-1.5 flex justify-between gap-1">
                        <span className="text-rose-700/70 dark:text-rose-400">Deductions</span>
                        <span className="font-semibold tabular-nums text-rose-700">{money(rec.total_deductions)}</span>
                      </div>
                      <div className="col-span-2 rounded-lg border border-primary/15 bg-primary/5 px-2 py-1.5 flex justify-between gap-1">
                        <span className="text-primary/70">Net pay</span>
                        <span className="font-bold tabular-nums text-primary">{money(rec.total_net)}</span>
                      </div>
                      {(rec.cash_advance || 0) > 0 && (
                        <div className="col-span-2 flex justify-between gap-1 border-t border-border/60 pt-1.5">
                          <span className="text-muted-foreground">Partial salary</span>
                          <span className="font-medium tabular-nums">{money(rec.cash_advance)}</span>
                        </div>
                      )}
                      {(rec.rest_day_pay || 0) > 0 && (
                        <div className="col-span-2 flex justify-between gap-1">
                          <span className="text-muted-foreground">Rest day</span>
                          <span className="font-medium tabular-nums">{money(rec.rest_day_pay)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 pl-6 pt-0.5 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-muted-foreground"
                        title="Earnings receipt"
                        type="button"
                        onClick={() => {
                          if (periodDialogContext) openReceiptDialog(periodDialogContext, rec.id)
                        }}
                      >
                        <ReceiptIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-amber-600"
                        title="Partial salary payments"
                        type="button"
                        onClick={() => openPartialPaymentsDialog(rec)}
                      >
                        <HandCoins className="h-4 w-4" />
                      </Button>
                      {rec.status !== "Paid" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => handleMarkAsPaid(rec.id)}
                          className="h-8 px-2 text-green-600 text-xs"
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Paid
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-8 ml-auto text-xs px-2"
                        onClick={() => {
                          setEditRecord(rec)
                          setEditDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden md:flex flex-1 min-h-0 flex-col rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              <div className="flex-1 min-h-0 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-0">
                      <TableHead className={cn(metaTh, "w-10")}>
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.length === selectedPeriodRecords.length &&
                            selectedPeriodRecords.length > 0
                          }
                          onChange={handleSelectAll}
                          className="rounded border-white/40"
                          title="Select all"
                        />
                      </TableHead>
                      <TableHead className={metaTh}>Actions</TableHead>
                      <TableHead className={metaTh}>Employee</TableHead>
                      <TableHead className={metaTh}>Type</TableHead>
                      <TableHead className={earnTh} title="Basic Salary">Basic</TableHead>
                      <TableHead className={earnTh} title="Overtime Pay">OT</TableHead>
                      <TableHead className={earnTh} title="Holiday Pay">Holiday</TableHead>
                      <TableHead className={earnTh} title="Night Differential">ND</TableHead>
                      <TableHead className={earnTh} title="Rest Day Pay">Rest</TableHead>
                      <TableHead className={earnTh} title="Allowances">Allow.</TableHead>
                      <TableHead className={earnTh} title="Unpaid Salary">Unpaid</TableHead>
                      <TableHead className={earnTh} title="Reimbursement">Reimb.</TableHead>
                      <TableHead className={earnTh} title="13th Month Pay">13th</TableHead>
                      <TableHead className={dedTh}>SSS</TableHead>
                      <TableHead className={dedTh} title="PhilHealth">PhilH</TableHead>
                      <TableHead className={dedTh} title="Pag-IBIG">HDMF</TableHead>
                      <TableHead className={dedTh} title="Withholding Tax">W/Tax</TableHead>
                      <TableHead className={dedTh}>Loans</TableHead>
                      <TableHead className={dedTh} title="Absences">Absent</TableHead>
                      <TableHead className={dedTh} title="Tardiness">Late</TableHead>
                      <TableHead className={dedTh} title="Partial Salary Payment">Partial</TableHead>
                      <TableHead className={dedTh} title="Total Deductions">Total Ded.</TableHead>
                      <TableHead className={netTh} title="Net After Deductions">Net</TableHead>
                      <TableHead className={netTh}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPeriodRecords.map((rec) => (
                        <TableRow
                          key={rec.id}
                          onClick={() => {
                            setEditRecord(rec)
                            setEditDialogOpen(true)
                          }}
                          className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/70"
                        >
                          <TableCell onClick={(e) => e.stopPropagation()} className="px-2.5 py-2.5 align-middle">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(rec.id)}
                              onChange={() => handleSelect(rec.id)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()} className="px-2 py-2 align-middle">
                            <div className="flex items-center gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Earnings receipt"
                                type="button"
                                onClick={() => {
                                  if (periodDialogContext) openReceiptDialog(periodDialogContext, rec.id)
                                }}
                              >
                                <ReceiptIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Partial salary payments"
                                type="button"
                                onClick={() => openPartialPaymentsDialog(rec)}
                              >
                                <HandCoins className="h-3.5 w-3.5" />
                              </Button>
                              {rec.status !== "Paid" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  type="button"
                                  onClick={() => handleMarkAsPaid(rec.id)}
                                  className="h-7 px-1.5 text-emerald-600 hover:bg-emerald-50 text-[10px] font-semibold"
                                  title="Mark as paid"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-2.5 py-2 align-middle">
                            <div className="flex items-center gap-2 min-w-[10rem]">
                              <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                                {rec.profile_picture_url ? (
                                  <img src={rec.profile_picture_url} className="h-full w-full object-cover" alt="" />
                                ) : (
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <span className="font-semibold text-sm text-foreground truncate">{rec.employee_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-2.5 py-2 text-[11px] text-muted-foreground capitalize whitespace-nowrap">
                            {rec.pay_type?.replace(/-/g, " ") || "—"}
                          </TableCell>
                          <TableCell className={earnTd}>{money(rec.basic_salary)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.overtime_pay)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.holiday_pay)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.night_diff)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.rest_day_pay)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.allowances)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.unpaid_salary)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.reimbursement)}</TableCell>
                          <TableCell className={earnTd}>{money(rec.thirteenth_month_pay)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.sss)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.philhealth)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.pagibig)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.withholding_tax)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.loans)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.absences)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.tardiness)}</TableCell>
                          <TableCell className={dedTd}>{money(rec.cash_advance)}</TableCell>
                          <TableCell className={cn(dedTd, "font-bold")}>{money(rec.total_deductions)}</TableCell>
                          <TableCell className={netTd}>{money(rec.total_net ?? rec.net_after_deductions)}</TableCell>
                          <TableCell className="px-2.5 py-2 align-middle">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap",
                              statusVariants[rec.status] || "bg-muted text-muted-foreground border-border"
                            )}>
                              {rec.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <div className="shrink-0 border-t border-border bg-muted/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  Showing <span className="font-semibold text-foreground">{filteredPeriodRecords.length}</span> of{" "}
                  <span className="font-semibold text-foreground">{selectedPeriodRecords.length}</span> employees
                </span>
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-600" /> Earnings</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-600" /> Deductions</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> Net</span>
                </span>
              </div>
            </div>
          </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border bg-muted/30 text-left shrink-0">
            <DialogTitle className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Edit Payroll Record
            </DialogTitle>
            {editRecord && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Adjust earnings, deductions, and status for this pay period
              </p>
            )}
          </DialogHeader>

          {editRecord && (
            <form
              className="flex flex-col flex-1 min-h-0"
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

                const grossPay = recordGrossPay(editRecord)
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
                    rest_day_pay: editRecord.rest_day_pay || 0,
                    unpaid_salary: editRecord.unpaid_salary || 0,
                    reimbursement: editRecord.reimbursement || 0,
                    thirteenth_month_pay: editRecord.thirteenth_month_pay || 0,
                    absences: absences,
                    absence_dates: editRecord.absence_dates?.length ? editRecord.absence_dates : [],
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
                  toast.error(
                    error.message?.includes("rest_day_pay")
                      ? "Run payroll_add_rest_day_pay.sql in Supabase, then try again."
                      : "Failed to update record",
                    { id: toastId }
                  )
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
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
              {/* Employee meta */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Employee</p>
                    <p className="text-sm font-semibold text-foreground leading-tight">{editRecord.employee_name || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pay type</p>
                    <p className="text-sm font-medium capitalize text-foreground">{editRecord.pay_type?.replace(/-/g, " ") || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period</p>
                    <p className="text-sm font-medium text-foreground">
                      {editRecord.period_start && editRecord.period_end
                        ? `${format(new Date(editRecord.period_start), "MMM d")} – ${format(new Date(editRecord.period_end), "MMM d, yyyy")}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Earnings</p>
                    <p className="text-[11px] text-muted-foreground">Amounts that add to gross pay</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: "basic_salary", label: "Basic Salary", icon: Banknote },
                    { key: "overtime_pay", label: "Overtime Pay", icon: Clock },
                    { key: "allowances", label: "Allowances", icon: Wallet },
                    { key: "holiday_pay", label: "Holiday Pay", icon: Sun },
                    { key: "night_diff", label: "Night Differential", icon: Moon },
                    { key: "rest_day_pay", label: "Rest Day Pay", icon: Umbrella },
                    { key: "unpaid_salary", label: "Unpaid Salary", icon: FileText },
                    { key: "reimbursement", label: "Reimbursement", icon: Receipt },
                    { key: "thirteenth_month_pay", label: "13th Month Pay", icon: BadgePercent },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-emerald-600/80" />
                        {label}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-7 bg-background/80 border-emerald-500/20 focus-visible:ring-emerald-500/30"
                          value={(editRecord as any)[key] || ""}
                          onChange={(e) =>
                            setEditRecord((prev) =>
                              prev ? { ...prev, [key]: parseFloat(e.target.value) || 0 } : prev
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance & other deductions */}
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Attendance & Other Deductions</p>
                    <p className="text-[11px] text-muted-foreground">Amounts subtracted from take-home pay</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-rose-600/80" />
                      Absence Deductions
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7 bg-background/80 border-rose-500/20 focus-visible:ring-rose-500/30"
                        value={editRecord.absences || ""}
                        onChange={(e) =>
                          setEditRecord((prev) =>
                            prev ? { ...prev, absences: parseFloat(e.target.value) || 0 } : prev
                          )
                        }
                      />
                    </div>
                    <Label className="text-[11px] font-medium text-muted-foreground">Absence date(s)</Label>
                    <AbsenceDatesPicker
                      dates={editRecord.absence_dates || []}
                      onChange={(dates) =>
                        setEditRecord((prev) => (prev ? { ...prev, absence_dates: dates } : prev))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-rose-600/80" />
                      Tardiness (Late)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7 bg-background/80 border-rose-500/20 focus-visible:ring-rose-500/30"
                        value={editRecord.tardiness || ""}
                        onChange={(e) =>
                          setEditRecord((prev) =>
                            prev ? { ...prev, tardiness: parseFloat(e.target.value) || 0 } : prev
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <HandCoins className="h-3.5 w-3.5 text-amber-600/90" />
                      Partial Salary Payment
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7 bg-background/80 border-rose-500/20 focus-visible:ring-rose-500/30"
                        value={editRecord.cash_advance || ""}
                        onChange={(e) =>
                          setEditRecord((prev) =>
                            prev ? { ...prev, cash_advance: parseFloat(e.target.value) || 0 } : prev
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-rose-600/80" />
                      Loans & Other
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7 bg-background/80 border-rose-500/20 focus-visible:ring-rose-500/30"
                        value={editRecord.loans || ""}
                        onChange={(e) =>
                          setEditRecord((prev) =>
                            prev ? { ...prev, loans: parseFloat(e.target.value) || 0 } : prev
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Statutory */}
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">Statutory Contributions</p>
                    <p className="text-[11px] text-muted-foreground">Government-mandated deductions</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: "sss", label: "SSS" },
                    { key: "philhealth", label: "PhilHealth" },
                    { key: "pagibig", label: "Pag-IBIG" },
                    { key: "withholding_tax", label: "Withholding Tax" },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">{label}</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-7 bg-background/80 border-sky-500/20 focus-visible:ring-sky-500/30"
                          value={(editRecord as any)[key] || ""}
                          onChange={(e) =>
                            setEditRecord((prev) =>
                              prev ? { ...prev, [key]: parseFloat(e.target.value) || 0 } : prev
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Payment Status
                </Label>
                <Select
                  value={editRecord.status}
                  onValueChange={(val) =>
                    setEditRecord((prev) => prev && { ...prev, status: val })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending Payment">Pending Payment</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Totals */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Live Totals</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-background/70 border border-border px-3 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross Pay</span>
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      ₱{recordGrossPay(editRecord).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background/70 border border-border px-3 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Deductions</span>
                    <div className="font-semibold text-rose-600 tabular-nums">
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
                <div className="pt-2 border-t border-primary/15 flex justify-between items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">Final Net Pay</span>
                  <div className="text-xl font-bold text-primary tabular-nums">
                    ₱{(
                      recordGrossPay(editRecord) -
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

              <div className="shrink-0 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 font-semibold shadow-sm">
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={partialDialogOpen} onOpenChange={setPartialDialogOpen}>
        <DialogContent className="lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-amber-600" />
              Partial Salary Payments
            </DialogTitle>
          </DialogHeader>

          {partialRecord && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                <p className="font-semibold text-foreground">{partialRecord.employee_name}</p>
                <p className="text-sm text-muted-foreground">
                  Pay period:{" "}
                  <span className="font-medium text-foreground">
                    {format(new Date(partialRecord.period_start), "MMM d")} –{" "}
                    {format(new Date(partialRecord.period_end), "MMM d, yyyy")}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Recorded payments for this period</h3>
                {partialLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading payments…</p>
                ) : partialEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                    No partial salary payments recorded for this period yet.
                  </p>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs font-bold">Date Given</TableHead>
                          <TableHead className="text-xs font-bold">Notes</TableHead>
                          <TableHead className="text-xs font-bold text-right">Amount</TableHead>
                          <TableHead className="text-xs font-bold min-w-[160px]">Attachments</TableHead>
                          <TableHead className="text-xs font-bold">Created</TableHead>
                          <TableHead className="text-xs font-bold">Updated</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partialEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(entry.payment_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                              {entry.notes || "—"}
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                              ₱{entry.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col gap-1.5 min-w-[140px]">
                                {(entry.attachments || []).length === 0 ? (
                                  <span className="text-muted-foreground text-xs">No files</span>
                                ) : (
                                  (entry.attachments || []).map((att) => (
                                    <div key={att.url} className="flex items-center gap-1 group">
                                      <a
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[120px]"
                                        title={att.name}
                                      >
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{att.name}</span>
                                      </a>
                                      <button
                                        type="button"
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600"
                                        title="Remove attachment"
                                        onClick={() => handleRemoveAttachment(entry, att.url)}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))
                                )}
                                <label className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground cursor-pointer w-fit">
                                  <Paperclip className="h-3 w-3" />
                                  {uploadingAttachmentFor === entry.id ? "Uploading…" : "Add files"}
                                  <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    disabled={uploadingAttachmentFor === entry.id}
                                    onChange={(e) => {
                                      handleAddAttachmentsToPayment(entry, e.target.files)
                                      e.target.value = ""
                                    }}
                                  />
                                </label>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatPH(entry.created_at)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatPH(entry.updated_at || entry.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                title="Delete payment"
                                onClick={() => handleDeletePartialPayment(entry)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Add partial salary payment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Amount (₱)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={partialForm.amount}
                      onChange={(e) => setPartialForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Date given</Label>
                    <Input
                      type="date"
                      value={partialForm.payment_date}
                      onChange={(e) => setPartialForm((f) => ({ ...f, payment_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
                  <Input
                    placeholder="e.g. Requested advance for emergency"
                    value={partialForm.notes}
                    onChange={(e) => setPartialForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Attachments (optional, multiple)</Label>
                  <Input
                    type="file"
                    multiple
                    className="cursor-pointer"
                    onChange={(e) =>
                      setPartialForm((f) => ({
                        ...f,
                        files: e.target.files ? Array.from(e.target.files) : [],
                      }))
                    }
                  />
                  {partialForm.files.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {partialForm.files.length} file(s) selected:{" "}
                      {partialForm.files.map((f) => f.name).join(", ")}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={partialSaving}
                  onClick={handleAddPartialPayment}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {partialSaving ? "Saving…" : "Add Payment"}
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net pay for period (before partial payments):</span>
                  <span className="font-semibold text-foreground">
                    ₱{(recordGrossPay(partialRecord) - recordBaseDeductions(partialRecord)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total partial salary payments:</span>
                  <span className="font-semibold text-red-600">
                    − ₱{partialEntries.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">Total receivable (after partial payments):</span>
                  <span className="text-lg font-bold text-primary">
                    ₱{(
                      recordGrossPay(partialRecord) -
                      recordBaseDeductions(partialRecord) -
                      partialEntries.reduce((s, p) => s + (p.amount || 0), 0)
                    ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createWorkspaceOpen} onOpenChange={setCreateWorkspaceOpen}>
        <DialogContent className="w-[50vw] max-w-[50vw] sm:max-w-[50vw]">
          <DialogHeader>
            <DialogTitle>Add Custom Payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a separate payroll ledger (for example 13th Month Pay or a special bonus run).
              It will appear as its own tab with the same period management tools.
            </p>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Payroll name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g. 13th Month Pay 2026"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreateWorkspace()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setCreateWorkspaceOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={creatingWorkspace} onClick={handleCreateWorkspace}>
                {creatingWorkspace ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}