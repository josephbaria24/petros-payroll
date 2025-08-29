//app\dashboard\page.tsx

"use client"

import { useRouter } from "next/navigation"


import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  } from "@/components/ui/alert-dialog"

import { useEffect, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

import { supabase } from "@/lib/supabaseClient"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIcon, Check, ChevronsUpDown, LayoutGrid } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useProtectedPage } from "../hooks/useProtectedPage"

function getStatus(net_pay: number): string {
  if (net_pay > 800000) return "On Hold Payment"
  if (net_pay > 500000) return "Payment Success"
  return "Pending Payment"
}

function statusBadge(status: string) {
  switch (status) {
    case "Payment Success":
      return <Badge className="bg-blue-100 text-blue-600">● {status}</Badge>
    case "Pending Payment":
      return <Badge className="bg-orange-100 text-orange-600">● {status}</Badge>
    case "On Hold Payment":
      return <Badge className="bg-gray-100 text-gray-600">● {status}</Badge>
    default:
      return null
  }
}

type PayrollRecord = {
  id: string
  employee_code: string
  full_name: string
  pay_type: string
  period_end: string
  net_pay: number
  status: string
}

export default function DashboardPage() {
  const { isChecking } = useProtectedPage(["admin", "hr"])

  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)



  
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null)
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [filter, setFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [payday, setPayday] = useState<Date | undefined>(undefined)
  const [dataLoading, setDataLoading] = useState(true)
  
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    id: "",
    expense_name: "",
    category: "",
    amount: "",
    incurred_on: "",
    notes: ""
  })
  
  const [form, setForm] = useState({
    employee_id: "",
    period_start: "",
    period_end: "",
    net_pay: "",
    status: "Pending Payment",   // default
  })

  useEffect(() => {
    fetchPayroll()
  }, [])

  useEffect(() => {
    const getRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
  
      if (!session) return
  
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
  
      if (!error && profile?.role) {
        setRole(profile.role)
      }
    }
  
    getRole()
  }, [])
  // Function: filter records by payday
async function handleFilterByPayday(date: Date) {
  setPayday(date)

  const formatted = date.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("payroll_records")
    .select(`
      id,
      employee_id,
      period_end,
      net_pay,
      status,
      employees ( full_name, employee_code, pay_type )
    `)
    .eq("period_end", formatted)   // ✅ filter by payday

  if (error) {
    console.error("Error filtering by payday:", error)
  } else {
    const transformed = data.map((rec: any) => ({
      id: rec.id,
      employee_code: rec.employees.employee_code,
      full_name: rec.employees.full_name,
      pay_type: rec.employees.pay_type,
      period_end: rec.period_end,
      net_pay: rec.net_pay,
      status: rec.status,
    }))
    setRecords(transformed)
  }
}


async function fetchPayroll() {
  const { data, error } = await supabase
    .from("payroll_records")
    .select(`
      id,
      employee_id,
      period_end,
      net_pay,
      status,
      employees ( full_name, employee_code, pay_type )
    `)

  if (error) {
    console.error("Error fetching payroll records:", error)
    return
  }

  const transformed = data.map((rec: any) => ({
    id: rec.id,
    employee_code: rec.employees.employee_code,
    full_name: rec.employees.full_name,
    pay_type: rec.employees.pay_type,
    period_end: rec.period_end,
    net_pay: rec.net_pay,
    status: rec.status,
  }))

  setRecords(transformed)
}


  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Adding payment...")
  
    const { error } = await supabase
      .from("payroll_records")
      .insert({
        employee_id: form.employee_id,
        period_start: form.period_start,
        period_end: form.period_end,
        net_pay: parseFloat(form.net_pay),
        basic_salary: parseFloat(form.net_pay),
        gross_pay: parseFloat(form.net_pay),
        total_deductions: 0,
        status: form.status,
      })
  
    if (error) {
      toast.error("Failed to add payment", { id: toastId })
    } else {
      toast.success("Payment added successfully", { id: toastId })
      fetchPayroll()
      setOpen(false)
    }
  }
  

  const filteredRecords =
    filter === "all" ? records : records.filter((r) => r.pay_type === filter)



    const [employees, setEmployees] = useState<{id: string, full_name: string, employee_code: string, base_salary: number}[]>([])
const [search, setSearch] = useState("")

useEffect(() => {
  fetchPayroll()
  fetchEmployees()
}, [])

async function fetchEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, base_salary")
  if (error) {
    console.error("Error fetching employees:", error)
    return
  }
  setEmployees(data)
}


const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
const selectedEmployee = employees.find(emp => emp.id === form.employee_id)

const [periodStart, setPeriodStart] = useState<Date | undefined>(undefined);
const [periodEnd, setPeriodEnd] = useState<Date | undefined>(undefined);
const [expenses, setExpenses] = useState<{
  id: string
  expense_name: string
  category: string
  amount: number
  incurred_on: string
  notes?: string   // <-- add this
}[]>([])


useEffect(() => {
  fetchExpenses()
}, [])

async function fetchExpenses() {
  const { data, error } = await supabase
    .from("company_expenses")
    .select("*")
    .order("incurred_on", { ascending: false })

  if (error) {
    console.error("Error fetching expenses:", error)
    return
  }
  setExpenses(data)
}

useEffect(() => {
  const loadData = async () => {
    await Promise.all([
      fetchPayroll(),
      fetchEmployees(),
      fetchExpenses()
    ])
    setDataLoading(false)
  }

  loadData()
}, [])

// Sync to form
useEffect(() => {
  setForm(f => ({
    ...f,
    period_start: periodStart ? periodStart.toISOString().split('T')[0] : "",
    period_end: periodEnd ? periodEnd.toISOString().split('T')[0] : "",
  }))
}, [periodStart, periodEnd]);


if (isChecking || !role || dataLoading) {
  return (
    <div className="flex items-center justify-center h-screen text-muted-foreground">
      <span className="animate-pulse text-lg">Loading dashboard...</span>
    </div>
  )
}

  return (
    
    <div className="pr-4 space-y-6">
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Generate Financial Report</h2>
          <p className="text-muted-foreground text-sm">
            Analyze your financial report more easily with our virtual assistant!
          </p>
        </div>
        <Button>Generate Report</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Card className="flex-1 min-w-[200px]">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Monthly Payroll</p>
            <h2 className="text-xl font-bold">
              ₱ {records.reduce((sum, r) => sum + r.net_pay, 0).toLocaleString()}
            </h2>
          </CardContent>
        </Card>
        <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
  <DialogTrigger asChild>
    <Card className="flex-1 min-w-[200px] cursor-pointer hover:shadow-md transition">
      <CardContent className="p-4 flex justify-between items-start">
        <div>
          <p className="text-sm text-muted-foreground">Company Expenses</p>
          <h2 className="text-xl font-bold">
            ₱ {expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            setExpenseOpen(true)
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  </DialogTrigger>

  {/* HERE: Add the dialog content */}
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Company Expenses</DialogTitle>
    </DialogHeader>

    {/* Expense Table */}
    <Table className="min-w-[700px]">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((exp) => (
          <TableRow key={exp.id}>
            <TableCell>{new Date(exp.incurred_on).toLocaleDateString()}</TableCell>
            <TableCell>{exp.expense_name}</TableCell>
            <TableCell>{exp.category}</TableCell>
            <TableCell>₱ {exp.amount.toLocaleString()}</TableCell>
            <TableCell>{exp.notes || "-"}</TableCell>
            <TableCell>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setExpenseForm({
                  ...exp,
                  amount: exp.amount.toString(), // convert number → string
                  notes: exp.notes || "",        // ensure notes exists
                })
              }
            >
              Edit
            </Button>

            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {/* Add/Edit Form */}
    <form onSubmit={handleSaveExpense} className="space-y-4 mt-6">
      <div>
        <Label>Expense Name</Label>
        <Input
          value={expenseForm.expense_name}
          onChange={(e) => setExpenseForm({ ...expenseForm, expense_name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Category</Label>
        <Input
          value={expenseForm.category}
          onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
        />
      </div>
      <div>
        <Label>Amount</Label>
        <Input
          type="number"
          value={expenseForm.amount}
          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          value={expenseForm.incurred_on}
          onChange={(e) => setExpenseForm({ ...expenseForm, incurred_on: e.target.value })}
        />
      </div>
      <div>
        <Label>Notes</Label>
        <Input
          value={expenseForm.notes}
          onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full">
        {expenseForm.id ? "Update Expense" : "Add Expense"}
      </Button>
    </form>
  </DialogContent>
</Dialog>

      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full md:w-fit">
          <TabsList>
            <TabsTrigger value="all">All Payment</TabsTrigger>
            <TabsTrigger value="Member">Member</TabsTrigger>
            <TabsTrigger value="Staff">Staff</TabsTrigger>
            <TabsTrigger value="Freelance">Freelance</TabsTrigger>
            <TabsTrigger value="Part-Time">Part-Time</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {payday ? payday.toLocaleDateString() : "Select Payday"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={payday}
              onSelect={(date) => {
                if (date) handleFilterByPayday(date)
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                + Add New Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
              <DialogTitle>{editRecord ? `Edit Payment for ${editRecord.full_name}` : "Add New Payment"}</DialogTitle>
              <Dialog onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditRecord(null)
              }} open={open}></Dialog>
              </DialogHeader>
              <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
              <Label>Employee</Label>
              <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeePopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedEmployee
                      ? `${selectedEmployee.full_name} (${selectedEmployee.employee_code})`
                      : "Select employee..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search employee..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      {employees.map(emp => (
                        <CommandItem
                          key={emp.id}
                          value={emp.id}
                          onSelect={() => {
                            setForm((prev) => ({
                              ...prev,
                              employee_id: emp.id,
                              // calculate net_pay as half the base_salary
                              net_pay: emp.base_salary ? (emp.base_salary / 2).toString() : "",
                            }))
                            setEmployeePopoverOpen(false)
                          }}
                          
                        >
                          {emp.full_name} ({emp.employee_code})
                          <Check
                            className={cn(
                              "ml-auto h-4 w-4",
                              form.employee_id === emp.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
            <Label>Period Start</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-between font-normal", !periodStart && "text-muted-foreground")}
                >
                  {periodStart ? periodStart.toLocaleDateString() : "Select date"}
                  <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={periodStart}
                  onSelect={setPeriodStart}
                  captionLayout="dropdown"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Period End</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-between font-normal", !periodEnd && "text-muted-foreground")}
                >
                  {periodEnd ? periodEnd.toLocaleDateString() : "Select date"}
                  <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={periodEnd}
                  onSelect={setPeriodEnd}
                  captionLayout="dropdown"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

                <div>
                  <Label>Net Pay</Label>
                  <Input
                    type="number"
                    value={form.net_pay}
                    onChange={(e) => setForm({ ...form, net_pay: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={v => setForm({ ...form, status: v })}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending Payment">Pending Payment</SelectItem>
                      <SelectItem value="Payment Success">Payment Success</SelectItem>
                      <SelectItem value="On Hold Payment">On Hold Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full">
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Payday</TableHead>
              <TableHead>Payment Amount</TableHead>
              <TableHead>Payment Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="font-medium">{record.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {record.employee_code}
                  </div>
                </TableCell>
                <TableCell>{record.period_end}</TableCell>
                <TableCell>₱ {record.net_pay.toLocaleString()}</TableCell>
                <TableCell>{record.pay_type} Payday</TableCell>
                <TableCell>{statusBadge(record.status)}</TableCell>
                <TableCell className="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(record)}>Edit</DropdownMenuItem>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-red-600"
                        onSelect={(e) => {
                          e.preventDefault() // <-- prevent dropdown from auto-closing
                          setDeleteRecordId(record.id)
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this payroll record? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(record.id, "Pending Payment")}>
                          Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(record.id, "Payment Success")}>
                          Paid
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(record.id, "On Hold Payment")}>
                          On Hold
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
        
      </div>


    </div>
  )
  function handleEdit(record: PayrollRecord) {
    setEditRecord(record)
    setOpen(true) // reuse existing dialog
    setForm({
    employee_id: record.id,
    period_start: "",
    period_end: record.period_end,
    net_pay: record.net_pay.toString(),
    status: record.status,
    })
    }
  

    async function handleSaveExpense(e: React.FormEvent) {
      e.preventDefault()
      const toastId = toast.loading(expenseForm.id ? "Updating expense..." : "Adding expense...")
    
      const payload = {
        expense_name: expenseForm.expense_name,
        category: expenseForm.category,
        amount: parseFloat(expenseForm.amount),
        incurred_on: expenseForm.incurred_on || new Date().toISOString().split("T")[0],
        notes: expenseForm.notes,
      }
    
      let error
      if (expenseForm.id) {
        // Update
        const res = await supabase.from("company_expenses").update(payload).eq("id", expenseForm.id)
        error = res.error
      } else {
        // Insert
        const res = await supabase.from("company_expenses").insert(payload)
        error = res.error
      }
    
      if (error) {
        toast.error("Failed to save expense", { id: toastId })
      } else {
        toast.success("Expense saved", { id: toastId })
        setExpenseForm({ id: "", expense_name: "", category: "", amount: "", incurred_on: "", notes: "" })
        fetchExpenses()
      }
    }
    
// REPLACE handleDelete()
async function handleDeleteConfirm() {
  if (!deleteRecordId) return
  
  
  const toastId = toast.loading("Deleting payment...")
  const { error } = await supabase.from("payroll_records").delete().eq("id", deleteRecordId)
  
  
  if (error) toast.error("Failed to delete", { id: toastId })
  else {
  toast.success("Deleted successfully", { id: toastId })
  fetchPayroll()
  }
  setDeleteRecordId(null)
  }
  
  
  async function handleStatusUpdate(id: string, newStatus: string) {
    const toastId = toast.loading("Updating status...")
  
    const { error } = await supabase
      .from("payroll_records")
      .update({ status: newStatus })
      .eq("id", id)
  
    if (error) {
      toast.error("Failed to update status.", { id: toastId })
    } else {
      toast.success(`Status updated to "${newStatus}"`, { id: toastId })
      fetchPayroll()
    }
  }
  
  
  
}