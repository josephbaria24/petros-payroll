"use client"

import { useEffect, useState } from "react"
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
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [filter, setFilter] = useState("all")
  const [open, setOpen] = useState(false)
  
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

  async function fetchPayroll() {
    const { data, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_end,
        net_pay,
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
      status: getStatus(rec.net_pay),
    }))

    setRecords(transformed)
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    const { error, status, statusText, data } = await supabase
    .from("payroll_records")
    .insert({
      employee_id: form.employee_id,
      period_start: form.period_start,
      period_end: form.period_end,
      net_pay: parseFloat(form.net_pay),
      basic_salary: parseFloat(form.net_pay),
      gross_pay: parseFloat(form.net_pay),
      total_deductions: 0,
    });
  if (error) {
    console.error("Insert error", error, { status, statusText, data });
    alert("Insert failed: " + (error.message || "Check browser console for details."));
  }
   else {
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

// Sync to form
useEffect(() => {
  setForm(f => ({
    ...f,
    period_start: periodStart ? periodStart.toISOString().split('T')[0] : "",
    period_end: periodEnd ? periodEnd.toISOString().split('T')[0] : "",
  }))
}, [periodStart, periodEnd]);




  return (
    <div className="p-6 space-y-6">
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
        <Card className="flex-1 min-w-[200px]">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Company Expenses</p>
            <h2 className="text-xl font-bold">₱ 0.00</h2>
          </CardContent>
        </Card>
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
          <Button variant="outline" size="sm">
            <CalendarIcon className="w-4 h-4 mr-2" /> Select Payday
          </Button>
          <Button variant="outline" size="sm">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                + Add New Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Payment</DialogTitle>
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
                <TableCell>
                  <Button size="icon" variant="ghost">
                    ...
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}