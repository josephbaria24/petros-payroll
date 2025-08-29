"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProtectedPage } from "../hooks/useProtectedPage"

type PayrollRecord = {
  id: string
  employee_id: string
  employee_name?: string
  pay_type?: string
  period_start: string
  period_end: string
  net_pay: number
  status: string
  total_deductions?: number
  net_after_deductions?: number
}

export default function PayrollPage() {
  useProtectedPage(["admin", "hr"])
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    employee_id: "",
    period_start: "",
    period_end: "",
    net_pay: "",
    status: "Pending Payment",
  })
  const [employees, setEmployees] = useState<{ id: string; full_name: string; pay_type: string }[]>([])
  const [periodStart, setPeriodStart] = useState<Date | undefined>(undefined)
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(undefined)

  useEffect(() => {
    fetchPayroll()
    fetchEmployees()
  }, [])

  async function fetchPayroll() {
    const { data: payroll, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_start,
        period_end,
        net_pay,
        status,
        employees(full_name, pay_type)
      `)
      .order("period_end", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const { data: deductions, error: dError } = await supabase
      .from("deductions")
      .select("employee_id, amount, created_at")

    if (dError) {
      console.error(dError)
      return
    }

    const merged = payroll.map((rec: any) => {
      const totalDeductions = deductions
        ?.filter(
          (d) =>
            d.employee_id === rec.employee_id &&
            (!rec.period_start || !rec.period_end ||
              (d.created_at >= rec.period_start && d.created_at <= rec.period_end))
        )
        .reduce((sum, d) => sum + d.amount, 0) || 0

      return {
        id: rec.id,
        employee_id: rec.employee_id,
        employee_name: rec.employees?.full_name,
        pay_type: rec.employees?.pay_type,
        period_start: rec.period_start,
        period_end: rec.period_end,
        net_pay: rec.net_pay,
        status: rec.status,
        total_deductions: totalDeductions,
        net_after_deductions: rec.net_pay - totalDeductions,
      }
    })

    setRecords(merged)
  }

  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("id, full_name, pay_type")
    if (error) {
      console.error(error)
      return
    }
    setEmployees(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Saving payroll...")

    const { error } = await supabase.from("payroll_records").insert({
      employee_id: form.employee_id,
      period_start: form.period_start,
      period_end: form.period_end,
      net_pay: parseFloat(form.net_pay),
      status: form.status,
    })

    if (error) {
      toast.error("Error saving payroll", { id: toastId })
    } else {
      toast.success("Payroll saved!", { id: toastId })
      setOpen(false)
      setForm({ employee_id: "", period_start: "", period_end: "", net_pay: "", status: "Pending Payment" })
      setPeriodStart(undefined)
      setPeriodEnd(undefined)
      fetchPayroll()
    }
  }

  useEffect(() => {
    setForm((f) => ({
      ...f,
      period_start: periodStart ? format(periodStart, "yyyy-MM-dd") : "",
      period_end: periodEnd ? format(periodEnd, "yyyy-MM-dd") : "",
    }))
  }, [periodStart, periodEnd])

  // 🔹 Calculate totals
  const totalNetAfterDeductions = records.reduce((sum, r) => sum + (r.net_after_deductions || 0), 0)

  // 🔹 Group by employee for summary
  const employeeSummary = records.reduce((acc: any, r) => {
    if (!r.employee_id) return acc
    if (!acc[r.employee_id]) {
      acc[r.employee_id] = {
        employee_name: r.employee_name,
        gross: 0,
        deductions: 0,
        net: 0,
      }
    }
    acc[r.employee_id].gross += r.net_pay
    acc[r.employee_id].deductions += r.total_deductions || 0
    acc[r.employee_id].net += r.net_after_deductions || 0
    return acc
  }, {})

  const summaryArray = Object.values(employeeSummary)

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payroll</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Payroll Record</Button>
          </DialogTrigger>
          <DialogContent>
  <DialogHeader>
    <DialogTitle>Add Payroll</DialogTitle>
  </DialogHeader>
  <form onSubmit={handleSubmit} className="space-y-4">
    {/* Employee */}
    <div>
      <Label>Employee</Label>
      <Select
        value={form.employee_id}
        onValueChange={(v) => setForm({ ...form, employee_id: v })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select employee" />
        </SelectTrigger>
        <SelectContent>
          {employees.map((emp) => (
            <SelectItem key={emp.id} value={emp.id}>
              {emp.full_name} ({emp.pay_type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* Period Start */}
    <div>
      <Label>Period Start</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !periodStart && "text-muted-foreground"
            )}
          >
            {periodStart ? format(periodStart, "PPP") : "Select date"}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={periodStart}
            onSelect={setPeriodStart}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>

    {/* Period End */}
    <div>
      <Label>Period End</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !periodEnd && "text-muted-foreground"
            )}
          >
            {periodEnd ? format(periodEnd, "PPP") : "Select date"}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={periodEnd}
            onSelect={setPeriodEnd}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>

    {/* Net Pay */}
    <div>
      <Label>Net Pay</Label>
      <Input
        type="number"
        value={form.net_pay}
        onChange={(e) => setForm({ ...form, net_pay: e.target.value })}
        required
      />
    </div>

    {/* Status */}
    <div>
      <Label>Status</Label>
      <Select
        value={form.status}
        onValueChange={(v) => setForm({ ...form, status: v })}
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

      {/* 🔹 Summary Cards */}
      <div className="flex flex-wrap gap-2">
        <Card className="flex-1 min-w-[100px]">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Net After Deductions</p>
            <h2 className="text-xl font-bold">
              ₱ {totalNetAfterDeductions.toLocaleString()}
            </h2>
          </CardContent>
        </Card>
      </div>

      {/* 🔹 Employee Breakdown Table */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">Employee Breakdown</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Net After Deductions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryArray.map((emp: any, idx) => (
                <TableRow key={idx}>
                  <TableCell>{emp.employee_name}</TableCell>
                  <TableCell>₱ {emp.gross.toLocaleString()}</TableCell>
                  <TableCell>₱ {emp.deductions.toLocaleString()}</TableCell>
                  <TableCell className="font-bold">₱ {emp.net.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 🔹 Full Payroll Records */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Pay Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross Net Pay</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Net After Deductions</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>{rec.employee_name}</TableCell>
                  <TableCell>{rec.pay_type}</TableCell>
                  <TableCell>
                    {rec.period_start} → {rec.period_end}
                  </TableCell>
                  <TableCell>₱ {rec.net_pay.toLocaleString()}</TableCell>
                  <TableCell>₱ {rec.total_deductions?.toLocaleString()}</TableCell>
                  <TableCell className="font-bold">₱ {rec.net_after_deductions?.toLocaleString()}</TableCell>
                  <TableCell>{rec.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
