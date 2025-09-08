// employees/page.tsx

"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { DataTable } from "./data-table"
import { columns, Employee } from "./columns"
import { Button } from "@/components/ui/button"
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
import { MoreHorizontal } from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"

export default function EmployeesPage() {
  useProtectedPage(["admin", "hr"])
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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
  }, [])

  async function fetchEmployees() {
    setLoading(true)
    const { data, error } = await supabase.from("employees").select("*")
    if (error) {
      console.error("Error fetching employees:", error)
    } else {
      setData(data as Employee[])
    }
    setLoading(false)
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
    const confirmDelete = window.confirm("Are you sure you want to delete this employee?");
    if (!confirmDelete) return;
  
    const { error } = await supabase.from("employees").delete().eq("id", id);
  
    if (error) {
      console.error("Error deleting employee:", error.message);
    } else {
      fetchEmployees(); // refresh data
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
  useEffect(() => {
    fetchEmailSuggestions()
  }, [])
  
  async function fetchEmailSuggestions() {
    const { data, error } = await supabase.from("emp_email").select("full_name, corp_email")
    if (error) {
      console.error("Error fetching email suggestions:", error.message)
    } else {
      setEmailSuggestions(data)
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
  
  const actionColumn = {
    id: "actions",
    cell: ({ row }: { row: any }) => {
      const emp = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(emp.id)}>
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleRowClick(emp)}>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  }
  
  let adjustedSalary = parseFloat(form.base_salary)
  if (!isEditing && form.pay_type === "semi-monthly") {
    adjustedSalary = adjustedSalary / 2
  }
  
  
  return (
    <div className="py-0 pr-4 ">
    <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 px-3">
       
       <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
       <Breadcrumb>
         <BreadcrumbList>
           <BreadcrumbItem>
             <BreadcrumbPage className="line-clamp-1">
               Employees management
             </BreadcrumbPage>
           </BreadcrumbItem>
         </BreadcrumbList>
       </Breadcrumb>
     </header>
      <div className="flex items-center justify-between mb-4">

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              {/* Employee Code */}
              <div>
                <Label htmlFor="employee_code">Employee Code</Label>
                <Input
                  id="employee_code"
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                />
              </div>

              <div>
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


              {/* Position */}
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>

              {/* Department */}
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>

              {/* Employment Status */}
              <div>
                <Label htmlFor="employment_status">Employment Status</Label>
                <Select
            value={form.employment_status}
            onValueChange={(v: string) => setForm({ ...form, employment_status: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Regular">Regular</SelectItem>
              <SelectItem value="Probationary">Probationary</SelectItem>
              <SelectItem value="Project-based">Project-based</SelectItem>
              <SelectItem value="Contractual">Contractual</SelectItem>
            </SelectContent>
          </Select>

              </div>

              {/* TIN */}
              <div>
                <Label htmlFor="tin">TIN</Label>
                <Input
                  id="tin"
                  value={form.tin}
                  onChange={(e) => setForm({ ...form, tin: e.target.value })}
                />
              </div>

              {/* SSS */}
              <div>
                <Label htmlFor="sss">SSS</Label>
                <Input
                  id="sss"
                  value={form.sss}
                  onChange={(e) => setForm({ ...form, sss: e.target.value })}
                />
              </div>

              {/* PhilHealth */}
              <div>
                <Label htmlFor="philhealth">PhilHealth</Label>
                <Input
                  id="philhealth"
                  value={form.philhealth}
                  onChange={(e) => setForm({ ...form, philhealth: e.target.value })}
                />
              </div>

              {/* Pag-IBIG */}
              <div>
                <Label htmlFor="pagibig">Pag-IBIG</Label>
                <Input
                  id="pagibig"
                  value={form.pagibig}
                  onChange={(e) => setForm({ ...form, pagibig: e.target.value })}
                />
              </div>

              {/* Base Salary */}
              <div>
                <Label htmlFor="base_salary">Base Salary</Label>
                <Input
                  id="base_salary"
                  type="number"
                  value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="allowance">Allowance</Label>
                <Input
                  id="allowance"
                  type="number"
                  value={form.allowance}
                  onChange={(e) => setForm({ ...form, allowance: e.target.value })}
                />
              </div>


              {/* Pay Type */}
              <div>
                <Label htmlFor="pay_type">Pay Type</Label>
                <Select
                  value={form.pay_type}
                  onValueChange={(v: string) => setForm({ ...form, pay_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pay type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semi-monthly">15 Days</SelectItem>
                  </SelectContent>


                </Select>

              </div>

            {/* Shift */}
            <div>
              <Label htmlFor="shift">Shift</Label>
              <Select
                value={form.shift}
                onValueChange={(v: string) => setForm({ ...form, shift: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular Day">Regular Day</SelectItem>
                  <SelectItem value="Night Shift">Night Shift</SelectItem>
                  <SelectItem value="Graveyard">Graveyard</SelectItem>
                  <SelectItem value="Split Shift">Split Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>


              {/* Hours per Week */}
              <div>
                <Label htmlFor="hours_per_week">Hours per Week</Label>
                <Input
                  id="hours_per_week"
                  type="number"
                  value={form.hours_per_week}
                  onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })}
                />
              </div>

              {/* Leave Credits */}
              <div>
                <Label htmlFor="leave_credits">Leave Credits</Label>
                <Input
                  id="leave_credits"
                  type="number"
                  value={form.leave_credits}
                  onChange={(e) => setForm({ ...form, leave_credits: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
      <p>Loading...</p>
    ) : (
        <DataTable
          data={data}
          columns={columns.map((col) =>
            col.id === "actions"
              ? { ...col, meta: { onEdit: handleRowClick, onDelete: handleDelete } }
              : col
          )}
          onEdit={handleRowClick}
          onDelete={handleDelete}
        />


    )}

    </div>
  )
}
