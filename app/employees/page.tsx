"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { DataTable } from "./data-table"
import { columns, Employee } from "./columns"
import { Button } from "@/components/ui/button"
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
import {
  Building2,
  Briefcase,
  Edit,
  Calculator,
  Plus,
  Users,
  UserCheck,
  Clock
} from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"

export default function EmployeesPage() {
  useProtectedPage(["admin", "hr"])
  const { activeOrganization } = useOrganization()
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState(false)
  const [emailSuggestions, setEmailSuggestions] = useState<{ full_name: string; corp_email: string }[]>([])

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
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchEmployees()
    fetchEmailSuggestions()
  }, [activeOrganization])

  async function fetchEmployees() {
    setLoading(true)
    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_employees")
      setData(stored ? JSON.parse(stored) : [])
    } else {
      const { data, error } = await supabase.from("employees").select("*")
      if (error) {
        console.error("Error fetching employees:", error)
      } else {
        setData(data as Employee[])
      }
    }
    setLoading(false)
  }

  async function fetchEmailSuggestions() {
    if (activeOrganization === "palawan") {
      // For Palawan, don't show any email suggestions from Petrosphere
      // Palawan employees are managed separately in localStorage
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
  }

  async function handleDelete(id: string) {
    const confirmDelete = window.confirm("Are you sure you want to delete this employee?")
    if (!confirmDelete) return

    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_employees")
      const employees = stored ? JSON.parse(stored) : []
      const updated = employees.filter((emp: Employee) => emp.id !== id)
      localStorage.setItem("palawan_employees", JSON.stringify(updated))
      fetchEmployees()
    } else {
      const { error } = await supabase.from("employees").delete().eq("id", id)
      if (error) {
        console.error("Error deleting employee:", error.message)
      } else {
        fetchEmployees()
      }
    }
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
    }

    let error

    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_employees")
      const employees = stored ? JSON.parse(stored) : []

      if (isEditing && editingId) {
        const updated = employees.map((emp: Employee) =>
          emp.id === editingId ? { ...emp, ...payload } : emp
        )
        localStorage.setItem("palawan_employees", JSON.stringify(updated))
      } else {
        const newEmployee = { ...payload, id: `emp_${Date.now()}`, created_at: new Date().toISOString() }
        employees.push(newEmployee)
        localStorage.setItem("palawan_employees", JSON.stringify(employees))
      }

      setOpen(false)
      setForm(initialForm)
      setIsEditing(false)
      setEditingId(null)
      fetchEmployees()
    } else {
      if (isEditing && editingId) {
        const res = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingId)
        error = res.error
      } else {
        const res = await supabase.from("employees").insert([payload])
        error = res.error
      }

      if (error) {
        console.error("Error saving employee:", error.message)
      } else {
        // Sync with emp_email table
        const { full_name, email } = form
        const emailLower = email.trim().toLowerCase()

        // Check if it already exists
        const { data: existing } = await supabase
          .from("emp_email")
          .select("id")
          .eq("corp_email", emailLower)
          .maybeSingle()

        if (!existing && full_name && emailLower) {
          await supabase.from("emp_email").insert([{
            full_name: full_name,
            corp_email: emailLower
          }])
          fetchEmailSuggestions()
        }

        setOpen(false)
        setForm(initialForm)
        setIsEditing(false)
        setEditingId(null)
        fetchEmployees()
      }
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

  // Calculate metrics
  const totalEmployees = data.length
  const regularEmployees = data.filter(emp => emp.employment_status === "Regular").length
  const probationaryEmployees = data.filter(emp => emp.employment_status === "Probationary").length

  // Calculate unique departments
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
        data={data}
        columns={columns}
        onEdit={(emp) => handleRowClick(emp, "edit")}
        onDelete={handleDelete}
        onRowClick={(emp) => handleRowClick(emp, "view")}
        initialSorting={[{ id: "full_name", desc: false }]}
      >
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
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Base Salary</p>
                        <p className="text-sm font-bold">₱{parseFloat(form.base_salary || "0").toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Shift</p>
                        <p className="text-sm font-semibold">{form.shift}</p>
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
                          value={form.employee_code}
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
                            value={form.full_name}
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
                            value={form.email}
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
                          value={form.position}
                          onChange={(e) => setForm({ ...form, position: e.target.value })}
                          placeholder="Job title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={form.department}
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
                          value={form.tin}
                          onChange={(e) => setForm({ ...form, tin: e.target.value })}
                          placeholder="Tax Identification Number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sss">SSS</Label>
                        <Input
                          id="sss"
                          value={form.sss}
                          onChange={(e) => setForm({ ...form, sss: e.target.value })}
                          placeholder="Social Security System"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="philhealth">PhilHealth</Label>
                        <Input
                          id="philhealth"
                          value={form.philhealth}
                          onChange={(e) => setForm({ ...form, philhealth: e.target.value })}
                          placeholder="PhilHealth Number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pagibig">Pag-IBIG</Label>
                        <Input
                          id="pagibig"
                          value={form.pagibig}
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
                        <Label htmlFor="base_salary">Base Salary</Label>
                        <Input
                          id="base_salary"
                          type="number"
                          value={form.base_salary}
                          onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="allowance">Allowance</Label>
                        <Input
                          id="allowance"
                          type="number"
                          value={form.allowance}
                          onChange={(e) => setForm({ ...form, allowance: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pay_type">Pay Type</Label>
                        <Select
                          value={form.pay_type}
                          onValueChange={(v: string) => setForm({ ...form, pay_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="semi-monthly">15 Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

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
                          value={form.hours_per_week}
                          onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })}
                          placeholder="40"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leave_credits">Leave Credits</Label>
                        <Input
                          id="leave_credits"
                          type="number"
                          value={form.leave_credits}
                          onChange={(e) => setForm({ ...form, leave_credits: e.target.value })}
                          placeholder="0"
                        />
                      </div>
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