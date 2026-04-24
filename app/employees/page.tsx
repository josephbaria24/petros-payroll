"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { DataTable } from "./data-table"
import { columns, Employee } from "./columns"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import {
  Building2,
  Briefcase,
  Edit,
  Calculator,
  Plus,
  Users,
  UserCheck,
  Clock,
  Filter,
  Camera,
} from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"
import {
  baseSalaryFieldLabel,
  fromMonthlyEquivalent,
  toMonthlyEquivalent,
} from "@/lib/employee-pay-conversion"

const ALL_STATUSES = ["Regular", "Probationary", "Project-based", "Contractual", "Inactive"] as const

function loadSavedFilters(): string[] {
  if (typeof window === "undefined") return [...ALL_STATUSES]
  const stored = localStorage.getItem("employee_status_filters")
  if (stored) {
    try { return JSON.parse(stored) } catch { return [...ALL_STATUSES] }
  }
  return [...ALL_STATUSES]
}

export default function EmployeesPage() {
  useProtectedPage(["admin", "hr"], "employees")
  const { activeOrganization } = useOrganization()
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState(false)
  const [emailSuggestions, setEmailSuggestions] = useState<{ full_name: string; corp_email: string }[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>(loadSavedFilters)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // form state
  const [form, setForm] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    position: "",
    department: "",
    employment_status: "Regular",
    tin: "",
    sss: "",
    philhealth: "",
    pagibig: "",
    base_salary: "",
    allowance: "",
    pay_type: "monthly",
    shift: "Regular Day",
    hours_per_week: "",
    leave_credits: "0",
    profile_picture_url: "",
    working_days: [] as string[],
    daily_rate: "",
  })
  const [open, setOpen] = useState(false)

  // Toggle a status filter and persist
  function toggleStatusFilter(status: string) {
    setStatusFilters(prev => {
      const next = prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
      localStorage.setItem("employee_status_filters", JSON.stringify(next))
      return next
    })
  }

  // Filtered data based on status filters
  const filteredData = useMemo(() => {
    if (statusFilters.length === ALL_STATUSES.length) return data
    return data.filter(emp => statusFilters.includes(emp.employment_status))
  }, [data, statusFilters])

  const activeFilterCount = ALL_STATUSES.length - statusFilters.length
  
  // Auto-calculate daily rate from base salary, pay type, and working days per week
  useEffect(() => {
    const salary = parseFloat(form.base_salary || "0")
    const d = Math.max(1, form.working_days.length || 5)
    if (salary <= 0) return
    let calculatedDaily = 0
    const pt = form.pay_type
    if (pt === "weekly") {
      calculatedDaily = salary / d
    } else if (pt === "daily") {
      calculatedDaily = salary
    } else if (pt === "hourly") {
      calculatedDaily = salary * 8
    } else if (pt === "semi-monthly") {
      const monthlySalary = salary * 2
      calculatedDaily = monthlySalary / (4 * d)
    } else {
      calculatedDaily = salary / (4 * d)
    }
    setForm((prev) => ({ ...prev, daily_rate: calculatedDaily.toFixed(2) }))
  }, [form.base_salary, form.pay_type, form.working_days.length])

  useEffect(() => {
    let ignore = false

    async function loadData() {
      setLoading(true)

      const table = activeOrganization === "pdn" ? "pdn_employees" : "employees"

      // Fetch employees
      const { data: empData, error: empError } = await supabase.from(table).select("*")
      if (!ignore) {
        if (empError) {
          console.error("Error fetching employees:", empError)
        } else {
          setData(empData as Employee[])
        }
      }

      // Fetch email suggestions (only for petrosphere)
      if (activeOrganization === "pdn") {
        if (!ignore) setEmailSuggestions([])
      } else {
        const { data: emailData, error: emailError } = await supabase.from("emp_email").select("full_name, corp_email")
        if (!ignore) {
          if (emailError) {
            console.error("Error fetching email suggestions:", emailError.message)
          } else {
            setEmailSuggestions(emailData)
          }
        }
      }

      if (!ignore) setLoading(false)
    }

    loadData()
    return () => { ignore = true }
  }, [activeOrganization])

  async function fetchEmployees() {
    setLoading(true)
    const table = activeOrganization === "pdn" ? "pdn_employees" : "employees"
    const { data, error } = await supabase.from(table).select("*")
    if (error) {
      console.error("Error fetching employees:", error)
    } else {
      setData(data as Employee[])
    }
    setLoading(false)
  }

  async function fetchEmailSuggestions() {
    if (activeOrganization === "pdn") {
      setEmailSuggestions([])
      return
    }

    const { data, error } = await supabase.from("emp_email").select("full_name, corp_email")
    if (error) {
      console.error("Error fetching email suggestions:", error.message)
    } else {
      setEmailSuggestions(data)
    }
  }

  const initialForm = {
    employee_code: "",
    full_name: "",
    email: "",
    position: "",
    department: "",
    employment_status: "Regular",
    tin: "",
    sss: "",
    philhealth: "",
    pagibig: "",
    base_salary: "",
    allowance: "",
    pay_type: "monthly",
    shift: "Regular Day",
    hours_per_week: "",
    leave_credits: "0",
    profile_picture_url: "",
    working_days: [] as string[],
    daily_rate: "0",
  }

  async function handleDelete(id: string) {
    // Delete dependent records first to avoid foreign key constraints
    if (activeOrganization === "pdn") {
      await supabase.from("pdn_attendance_logs").delete().eq("employee_id", id)
      await supabase.from("pdn_payroll_records").delete().eq("employee_id", id)
      await supabase.from("pdn_deductions").delete().eq("employee_id", id)
    } else {
      // Fetch attendance_log_userid and email to delete related logs
      const { data: empData } = await supabase
        .from("employees")
        .select("attendance_log_userid, email")
        .eq("id", id)
        .single()

      if (empData?.attendance_log_userid) {
        await supabase.from("attendance_logs").delete().eq("user_id", empData.attendance_log_userid)
      }

      await supabase.from("attendance").delete().eq("employee_id", id)
      await supabase.from("time_logs").delete().eq("employee_id", id)
      await supabase.from("payroll_overtimes").delete().eq("employee_id", id)
      await supabase.from("payroll_records").delete().eq("employee_id", id)
      await supabase.from("employee_deductions").delete().eq("employee_id", id)
      await supabase.from("deductions").delete().eq("employee_id", id)
      await supabase.from("employee_requests").delete().eq("employee_id", id)
      
      // Delete from emp_email if matching
      if (empData?.email) {
        await supabase.from("emp_email").delete().eq("corp_email", empData.email.trim().toLowerCase())
      }
    }

    const table = activeOrganization === "pdn" ? "pdn_employees" : "employees"
    const { error } = await supabase.from(table).delete().eq("id", id)
    if (error) {
      console.error("Error deleting employee:", error.message)
      toast.error(`Failed to delete: ${error.message}`)
    } else {
      toast.success("Employee deleted successfully")
      fetchEmployees()
      if (activeOrganization !== "pdn") fetchEmailSuggestions()
    }
  }

  async function handleMove(emp: Employee) {
    const isMovingToPDN = activeOrganization !== "pdn"
    const targetTable = isMovingToPDN ? "pdn_employees" : "employees"

    const payload: any = {
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email,
      position: emp.position,
      department: emp.department,
      employment_status: emp.employment_status,
      tin: emp.tin,
      sss: emp.sss,
      philhealth: emp.philhealth,
      pagibig: emp.pagibig,
      base_salary: emp.base_salary,
      allowance: emp.allowance || 0,
      pay_type: emp.pay_type,
      shift: emp.shift,
      hours_per_week: emp.hours_per_week,
      leave_credits: emp.leave_credits || 0,
      attendance_log_userid: emp.attendance_log_userid,
      working_days: emp.working_days || [],
      daily_rate: emp.daily_rate || 0,
      monthly_salary_mode: emp.monthly_salary_mode || "prorated",
    }

    if (!isMovingToPDN) {
       payload.shift_id = (emp as any).shift_id || null
    }

    // Attempt to insert into target team first (and get the new ID)
    const { data: newEmp, error: insertError } = await supabase
      .from(targetTable)
      .insert([payload])
      .select()
      .single()
    
    if (insertError) {
      console.error("Error moving employee:", insertError.message)
      toast.error(`Failed to move employee: ${insertError.message}`)
      return
    }

    toast.info(`Successfully copied ${emp.full_name}. Now transferring timekeeping logs...`)

    // Transfer Attendance Logs
    const sourceLogTable = isMovingToPDN ? "attendance_logs" : "pdn_attendance_logs"
    const targetLogTable = isMovingToPDN ? "pdn_attendance_logs" : "attendance_logs"
    const sourceIdField = isMovingToPDN ? "user_id" : "employee_id"
    const sourceIdValue = isMovingToPDN ? emp.attendance_log_userid : emp.id

    if (sourceIdValue) {
      const { data: logs, error: logsError } = await supabase
        .from(sourceLogTable)
        .select("*")
        .eq(sourceIdField, sourceIdValue)

      if (logs && logs.length > 0) {
        const logsPayload = logs.map(log => {
          const { id, created_at, ...rest } = log
          if (isMovingToPDN) {
            return { ...rest, employee_id: newEmp.id }
          } else {
            return { ...rest, user_id: newEmp.attendance_log_userid }
          }
        })

        const { error: logsInsertError } = await supabase.from(targetLogTable).insert(logsPayload)
        if (logsInsertError) {
          console.error("Error transferring logs:", logsInsertError.message)
          toast.warning("Employee moved but some timekeeping logs failed to transfer.")
        } else {
          toast.success(`Transferred ${logs.length} timekeeping records.`)
        }
      }
    }

    toast.success(`Move complete. Removing from current team...`)

    // Call handleDelete to clean up from the current team (this also wipes the source logs)
    await handleDelete(emp.id)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      employee_code: form.employee_code,
      full_name: form.full_name,
      email: form.email.trim().toLowerCase(),
      position: form.position || null,
      department: form.department || null,
      employment_status: form.employment_status,
      tin: form.tin || null,
      sss: form.sss || null,
      philhealth: form.philhealth || null,
      pagibig: form.pagibig || null,
      base_salary: adjustedSalary,
      allowance: form.allowance ? parseFloat(form.allowance) : 0,
      pay_type: form.pay_type,
      shift: form.shift,
      hours_per_week: form.hours_per_week ? parseInt(form.hours_per_week) : null,
      leave_credits: form.leave_credits ? parseFloat(form.leave_credits) : 0,
      profile_picture_url: form.profile_picture_url || null,
      working_days: form.working_days || [],
      daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : 0,
      monthly_salary_mode: "prorated",
    }

    const table = activeOrganization === "pdn" ? "pdn_employees" : "employees"
    let error

    if (isEditing && editingId) {
      const res = await supabase.from(table).update(payload).eq("id", editingId)
      error = res.error
    } else {
      const res = await supabase.from(table).insert([payload])
      error = res.error
    }

    if (error) {
      console.error("Error saving employee:", error.message)
      toast.error(`Failed to save: ${error.message}`)
    } else {
      toast.success(isEditing ? "Employee updated" : "Employee added")

      // Sync with emp_email table (only for petrosphere)
      if (activeOrganization !== "pdn") {
        const { full_name, email } = form
        const emailLower = email.trim().toLowerCase()
        const { data: existing } = await supabase
          .from("emp_email")
          .select("id")
          .eq("corp_email", emailLower)
          .maybeSingle()

        if (!existing && full_name && emailLower) {
          await supabase.from("emp_email").insert([{ full_name, corp_email: emailLower }])
          fetchEmailSuggestions()
        }
      }

      setOpen(false)
      setForm(initialForm)
      setIsEditing(false)
      setEditingId(null)
      fetchEmployees()
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    const formData = new FormData()
    formData.append("file", file)
    if (form.profile_picture_url) {
      // Send just the file name to the api
      formData.append("oldFileName", form.profile_picture_url.split('/').pop() || "")
    }

    if (editingId) {
      formData.append("employeeId", editingId)
      formData.append("org", activeOrganization || "petrosphere")
    }

    try {
      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setForm(prev => ({ ...prev, profile_picture_url: data.url }))
        toast.success("Avatar uploaded!")
      } else {
        throw new Error(data.error || "Upload failed")
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  function handleRowClick(emp: Employee, mode: "view" | "edit" = "view") {
    setForm({
      employee_code: emp.employee_code || "",
      full_name: emp.full_name || "",
      email: emp.email || "",
      position: emp.position || "",
      department: emp.department || "",
      employment_status: emp.employment_status || "Regular",
      tin: emp.tin || "",
      sss: emp.sss || "",
      philhealth: emp.philhealth || "",
      pagibig: emp.pagibig || "",
      base_salary: emp.base_salary?.toString() || "",
      allowance: emp.allowance?.toString() || "",
      pay_type: emp.pay_type || "monthly",
      shift: emp.shift || "",
      hours_per_week: emp.hours_per_week?.toString() || "",
      leave_credits: emp.leave_credits.toString() || "0",
      profile_picture_url: emp.profile_picture_url || "",
      working_days: emp.working_days || [],
      daily_rate: emp.daily_rate?.toString() || "",
    })
    setEditingId(emp.id)
    setIsEditing(true)
    setViewMode(mode === "view")
    setOpen(true)
  }

  function resetForm() {
    setForm(initialForm)
    setIsEditing(false)
    setEditingId(null)
    setViewMode(false)
  }


  let adjustedSalary = parseFloat(form.base_salary)
  if (!isEditing && form.pay_type === "semi-monthly") {
    adjustedSalary = adjustedSalary / 2
  }

  // Calculate metrics from full data (not filtered)
  const totalEmployees = data.length
  const regularEmployees = data.filter(emp => emp.employment_status === "Regular").length
  const probationaryEmployees = data.filter(emp => emp.employment_status === "Probationary").length
  const uniqueDepartments = new Set(data.map(emp => emp.department).filter(Boolean)).size


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-muted-foreground/20 rounded-full animate-pulse"></div>
          <span className="text-muted-foreground font-medium">Loading employees...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background">
      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Employees</h1>
        <p className="text-muted-foreground">
          Manage employee information, roles, and compensation details
        </p>
      </div>

      {/* Summary Metrics Chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 shadow-sm">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">Total</span>
          <span className="text-sm font-bold text-primary">{totalEmployees}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
          <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Regular</span>
          <span className="text-sm font-bold text-foreground">{regularEmployees}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Probationary</span>
          <span className="text-sm font-bold text-foreground">{probationaryEmployees}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Departments</span>
          <span className="text-sm font-bold text-foreground">{uniqueDepartments}</span>
        </div>
      </div>

      {/* Data Table with Integrated Controls */}
      <DataTable
        data={filteredData}
        columns={columns}
        onEdit={(emp) => handleRowClick(emp, "edit")}
        onDelete={handleDelete}
        onMove={handleMove}
        onRowClick={(emp) => handleRowClick(emp, "view")}
        initialSorting={[{ id: "full_name", desc: false }]}
      >
        {/* Status Filters Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 gap-2 font-semibold relative">
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Employment Status</p>
            </div>
            <div className="p-2 space-y-1">
              {ALL_STATUSES.map(status => (
                <label
                  key={status}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <span className="text-sm font-medium">{status}</span>
                </label>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs font-semibold"
                  onClick={() => {
                    setStatusFilters([...ALL_STATUSES])
                    localStorage.setItem("employee_status_filters", JSON.stringify([...ALL_STATUSES]))
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v)
          if (!v) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="h-9 gap-2 shadow-sm font-semibold">
              <Plus className="w-4 h-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="lg:w-[50vw] max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
            <DialogHeader className="p-6 bg-muted/30 border-b border-border space-y-1">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className={cn(
                        "h-16 w-16 rounded-full overflow-hidden border-2 border-border/50 flex items-center justify-center bg-muted shrink-0 text-xl font-bold text-muted-foreground",
                        isUploadingAvatar && "opacity-50"
                      )}>
                      {form.profile_picture_url ? (
                        <img src={form.profile_picture_url} className="h-full w-full object-cover" alt="Profile" />
                      ) : (
                        form.full_name?.charAt(0) || "E"
                      )}
                    </div>
                    {(!viewMode || (viewMode && !isEditing)) && (
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer backdrop-blur-sm">
                        <Camera className="h-5 w-5" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                      </label>
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-foreground">
                      {!isEditing ? "New Employee" : (viewMode ? (
                        <div className="flex items-center gap-2 text-foreground">
                          <span className="text-muted-foreground/50 text-sm font-normal">#{form.employee_code}</span>
                          <span>{form.full_name}</span>
                        </div>
                      ) : "Edit Employee")}
                    </DialogTitle>
                    {viewMode && isEditing && (
                      <p className="text-muted-foreground text-sm font-medium">{form.position} • {form.department}</p>
                    )}
                  </div>
                </div>
                {isEditing && viewMode && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewMode(false)}
                    className="gap-2 rounded-full px-4 h-9 shadow-sm hover:translate-y-[-1px] transition-all"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Details
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {viewMode && isEditing ? (
                <div className="grid gap-8 pb-4">
                  {/* View Sections */}
                  <div>
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Briefcase className="h-3 w-3" /> Professional
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Status</p>
                        <div className="flex">
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase ring-1 ring-inset ring-primary/20">{form.employment_status}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Corporate Email</p>
                        <p className="text-sm font-semibold truncate">{form.email}</p>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border/50" />

                  <div>
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Calculator className="h-3 w-3" /> Compensation
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Pay type</p>
                        <p className="text-sm font-bold capitalize">{form.pay_type?.replace(/-/g, " ") || "—"}</p>
                        {form.pay_type === "monthly" && (
                          <p className="text-[10px] text-muted-foreground">
                            Generate: date range = prorated by days; fixed monthly = ×1 / ×½ / ×¼ of this monthly base.
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Base pay</p>
                        <p className="text-[9px] text-muted-foreground leading-tight">{baseSalaryFieldLabel(form.pay_type)}</p>
                        <p className="text-sm font-bold">₱{parseFloat(form.base_salary || "0").toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Daily Rate (Per Day)</p>
                        <p className="text-sm font-bold text-primary">₱{parseFloat(form.daily_rate || "0").toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Shift</p>
                        <p className="text-sm font-semibold">{form.shift}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Days of Work</p>
                        <div className="flex flex-wrap gap-1">
                          {form.working_days.length > 0 ? (
                            form.working_days.map(day => (
                              <Badge key={day} variant="outline" className="text-[9px] font-black uppercase px-1.5 py-0 bg-primary/5 text-primary border-primary/20">{day}</Badge>
                            ))
                          ) : (
                            <span className="text-sm font-medium">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border/50" />

                  <div>
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Users className="h-3 w-3" /> Identification
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">SSS</p>
                        <p className="text-sm font-medium">{form.sss || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">PhilHealth</p>
                        <p className="text-sm font-medium">{form.philhealth || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Basic Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employee_code">Employee Code</Label>
                        <Input
                          id="employee_code"
                          value={form.employee_code || ""}
                          onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                          placeholder="e.g., EMP001"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="employment_status">Employment Status</Label>
                        <Select
                          value={form.employment_status}
                          onValueChange={(v: string) => setForm({ ...form, employment_status: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Probationary">Probationary</SelectItem>
                            <SelectItem value="Project-based">Project-based</SelectItem>
                            <SelectItem value="Contractual">Contractual</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="space-y-2">
                        <Label htmlFor="full_name_lookup" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Directory Lookup (Optional Helper)</Label>
                        <Select
                          onValueChange={(v) => {
                            const [name, email] = v.split("|||")
                            setForm({ ...form, full_name: name, email: email })
                          }}
                        >
                          <SelectTrigger id="full_name_lookup">
                            <SelectValue placeholder="Select from directory..." />
                          </SelectTrigger>
                          <SelectContent>
                            {emailSuggestions.map((entry) => (
                              <SelectItem key={entry.corp_email} value={`${entry.full_name}|||${entry.corp_email}`}>
                                {entry.full_name} ({entry.corp_email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Selecting an identity will pre-fill the name and email fields below.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="full_name">Full Name</Label>
                          <Input
                            id="full_name"
                            required
                            value={form.full_name || ""}
                            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            placeholder="e.g. Juan Dela Cruz"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Corporate Email</Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            value={form.email || ""}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="e.g. juan@petrosphere.com.ph"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="position">Position</Label>
                        <Input
                          id="position"
                          value={form.position || ""}
                          onChange={(e) => setForm({ ...form, position: e.target.value })}
                          placeholder="Job title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={form.department || ""}
                          onChange={(e) => setForm({ ...form, department: e.target.value })}
                          placeholder="Department name"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Government IDs */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Government IDs</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tin">TIN</Label>
                        <Input
                          id="tin"
                          value={form.tin || ""}
                          onChange={(e) => setForm({ ...form, tin: e.target.value })}
                          placeholder="Tax Identification Number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sss">SSS</Label>
                        <Input
                          id="sss"
                          value={form.sss || ""}
                          onChange={(e) => setForm({ ...form, sss: e.target.value })}
                          placeholder="Social Security System"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="philhealth">PhilHealth</Label>
                        <Input
                          id="philhealth"
                          value={form.philhealth || ""}
                          onChange={(e) => setForm({ ...form, philhealth: e.target.value })}
                          placeholder="PhilHealth Number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pagibig">Pag-IBIG</Label>
                        <Input
                          id="pagibig"
                          value={form.pagibig || ""}
                          onChange={(e) => setForm({ ...form, pagibig: e.target.value })}
                          placeholder="Pag-IBIG Number"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Compensation */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Compensation & Schedule</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="base_salary">{baseSalaryFieldLabel(form.pay_type)}</Label>
                        <Input
                          id="base_salary"
                          type="number"
                          value={form.base_salary || ""}
                          onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="daily_rate">Daily Rate (Per Day)</Label>
                        <Input
                          id="daily_rate"
                          type="number"
                          step="0.01"
                          value={form.daily_rate || ""}
                          onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                          placeholder="0.00"
                        />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Calculated automatically but can be edited manually.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="allowance">Allowance (per half-month)</Label>
                        <Input
                          id="allowance"
                          type="number"
                          value={form.allowance || ""}
                          onChange={(e) => setForm({ ...form, allowance: e.target.value })}
                          placeholder="0.00"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Payroll treats full-month allowance as 2× this amount, then applies the pay run (e.g. half month =
                          1× here, four-part = ½× here).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pay_type">Pay Type</Label>
                        <Select
                          value={form.pay_type}
                          onValueChange={(newType: string) => {
                            const salary = parseFloat(form.base_salary || "0")
                            const d = Math.max(1, form.working_days.length || 5)
                            if (salary > 0 && newType !== form.pay_type) {
                              const monthly = toMonthlyEquivalent(salary, form.pay_type, d)
                              const newBase = fromMonthlyEquivalent(monthly, newType, d)
                              setForm((prev) => ({
                                ...prev,
                                pay_type: newType,
                                base_salary: newBase.toFixed(2),
                              }))
                            } else {
                              setForm((prev) => ({
                                ...prev,
                                pay_type: newType,
                              }))
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="semi-monthly">Semi-monthly (15 days)</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {form.pay_type === "monthly" && (
                        <p className="text-[11px] text-muted-foreground col-span-2 leading-snug border border-border/60 rounded-md px-3 py-2 bg-muted/20">
                          <span className="font-semibold text-foreground">Generate Payroll:</span> choose{" "}
                          <strong>Date range</strong> to prorate this salary by scheduled working days in that window, or{" "}
                          <strong>Fixed monthly</strong> or a matching date range to pay ×1, ×½, or ×¼ of monthly pay
                          (semi-monthly uses 2× cutoff as full month; four-part = ÷4),
                          independent of how many working days fall in the slice.
                        </p>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="shift">Shift</Label>
                        <Select
                          value={form.shift}
                          onValueChange={(v: string) => setForm({ ...form, shift: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Regular Day">Regular Day</SelectItem>
                            <SelectItem value="Night Shift">Night Shift</SelectItem>
                            <SelectItem value="Graveyard">Graveyard</SelectItem>
                            <SelectItem value="Split Shift">Split Shift</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hours_per_week">Hours per Week</Label>
                        <Input
                          id="hours_per_week"
                          type="number"
                          value={form.hours_per_week || ""}
                          onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })}
                          placeholder="40"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leave_credits">Leave Credits</Label>
                        <Input
                          id="leave_credits"
                          type="number"
                          value={form.leave_credits || ""}
                          onChange={(e) => setForm({ ...form, leave_credits: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3 pt-6 border-t border-border/50">
                      <Label className="text-sm font-bold text-foreground">Days of Work</Label>
                      <div className="flex flex-wrap gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => {
                          const isSelected = form.working_days.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  working_days: isSelected
                                    ? prev.working_days.filter((d) => d !== day)
                                    : [...prev.working_days, day],
                                }))
                              }}
                              className={cn(
                                "h-9 px-4 rounded-full text-xs font-bold transition-all border duration-200",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm hover:translate-y-[-1px]"
                                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                              )}
                            >
                              {day}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        {form.working_days.length} days selected
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    {isEditing ? "Update Employee" : "Add Employee"}
                  </Button>
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DataTable>

      {data.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-2">
            <Users className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No employees found</h3>
          <p className="text-muted-foreground"> Get started by adding your first employee </p>
        </div>
      )}
    </div>
  )
}