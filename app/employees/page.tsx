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
  CardHeader,
  CardTitle,
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
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Plus,
  Users,
  UserCheck,
  Clock,
  Search,
  Building2,
  Briefcase
} from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"

export default function EmployeesPage() {
  useProtectedPage(["admin", "hr"])
  const { activeOrganization } = useOrganization()
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [emailSuggestions, setEmailSuggestions] = useState<{ full_name: string; corp_email: string }[]>([])
  const [searchTerm, setSearchTerm] = useState("")

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
        setOpen(false)
        setForm(initialForm)
        setIsEditing(false)
        setEditingId(null)
        fetchEmployees()
      }
    }
  }

  function handleRowClick(emp: Employee) {
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
      pay_type: emp.pay_type || "semi-monthly",
      shift: emp.shift || "",
      hours_per_week: emp.hours_per_week?.toString() || "",
      leave_credits: emp.leave_credits.toString() || "0",
    })
    setEditingId(emp.id)
    setIsEditing(true)
    setOpen(true)
  }

  function resetForm() {
    setForm(initialForm)
    setIsEditing(false)
    setEditingId(null)
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

  // Filter data based on search
  const filteredData = data.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-slate-400 rounded-full animate-pulse"></div>
          <span className="text-slate-600 font-medium">Loading employees...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-slate-50/50">
      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Employees</h1>
        <p className="text-slate-600">
          Manage employee information, roles, and compensation details
        </p>
      </div>

      {/* Ultra-Compact Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-md">
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-1">Total Employees</p>
            <p className="text-base font-bold text-slate-900 truncate leading-none">{totalEmployees}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-md">
            <UserCheck className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-1">Regular</p>
            <p className="text-base font-bold text-slate-900 truncate leading-none">{regularEmployees}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-md">
            <Clock className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-1">Probationary</p>
            <p className="text-base font-bold text-slate-900 truncate leading-none">{probationaryEmployees}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-md">
            <Building2 className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-1">Departments</p>
            <p className="text-base font-bold text-slate-900 truncate leading-none">{uniqueDepartments}</p>
          </div>
        </div>
      </div>

      {/* Controls & Table Container */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 w-full sm:w-64 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              />
            </div>

            {/* Add Employee Button */}
            <Dialog open={open} onOpenChange={(v) => {
              setOpen(v)
              if (!v) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button className="h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-sm gap-2">
                  <Plus className="w-4 h-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="lg:w-[50vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {isEditing ? "Edit Employee" : "Add New Employee"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900">Basic Information</h3>

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
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="full_name_email">Employee Identity</Label>
                      <Select
                        onValueChange={(v) => {
                          const [name, email] = v.split("|||")
                          setForm({ ...form, full_name: name, email: email })
                        }}
                      >
                        <SelectTrigger>
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
                    <h3 className="text-lg font-medium text-slate-900">Government IDs</h3>

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
                    <h3 className="text-lg font-medium text-slate-900">Compensation & Schedule</h3>

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

                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">
                    {isEditing ? "Update Employee" : "Add Employee"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataTable
              data={filteredData}
              columns={columns}
              onEdit={handleRowClick}
              onDelete={handleDelete}
            />
          </div>

          {filteredData.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-2">
                <Users className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">No employees found</h3>
              <p className="text-slate-500">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Get started by adding your first employee"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}