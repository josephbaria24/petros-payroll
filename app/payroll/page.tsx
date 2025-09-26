"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Eye, Trash2, Plus, X, Calculator, Users, DollarSign, TrendingUp, FileText } from "lucide-react"
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
  basic_salary: number
  overtime_pay: number
  allowances?: number
  status: string
  absences?: number
  total_deductions?: number
  net_after_deductions?: number
  total_net?: number
}

type PayrollPeriod = {
  period_key: string
  period_start: string
  period_end: string
  display_name: string
  total_employees: number
  total_basic_salary: number
  total_overtime: number
  total_deductions: number
  total_net_after_deductions: number
  records: PayrollRecord[]
}

type OvertimeEntry = {
  date: Date;
  hours: number;
  ratePerHour: number;
};

type EmployeeAdjustment = {
  employee_id: string;
  absenceDays: number;
  absenceAmountPerDay: number;
  holidayDate?: Date;
  holidayPay?: number;
  overtimeEntries: OvertimeEntry[];
};

const statusVariants: Record<string, string> = {
  "Paid": "bg-slate-900 text-white border-slate-200",
  "Pending Payment": "bg-white text-slate-900 border-slate-300",
  "Cancelled": "bg-slate-100 text-slate-600 border-slate-200",
}

export default function PayrollPage() {
  
  useProtectedPage(["admin", "hr"])
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [open, setOpen] = useState(false)
  const [selectedPeriodRecords, setSelectedPeriodRecords] = useState<PayrollRecord[]>([])
  const [selectedPeriodName, setSelectedPeriodName] = useState("")
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  function handleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function addOvertimeEntry(adjustmentIndex: number) {
    const updated = [...employeeAdjustments]
    updated[adjustmentIndex].overtimeEntries.push({
      date: new Date(),
      hours: 0,
      ratePerHour: 0,
    })
    setEmployeeAdjustments(updated)
  }
  
  function updateOvertimeEntry(
    adjIndex: number,
    entryIndex: number,
    field: keyof OvertimeEntry,
    value: any
  ) {
    const updated = [...employeeAdjustments]
    updated[adjIndex].overtimeEntries[entryIndex][field] = value
    setEmployeeAdjustments(updated)
  }
  
  const [, setForm] = useState({
    employee_id: "",
    period_start: "",
    period_end: "",
    net_pay: "",
    status: "Pending Payment",
  })
  const [employees, setEmployees] = useState<{ id: string; full_name: string; pay_type: string }[]>([])
  const [periodStart, setPeriodStart] = useState<Date | undefined>(undefined)
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(undefined)
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  
  const [employeeAdjustments, setEmployeeAdjustments] = useState<EmployeeAdjustment[]>([])

  useEffect(() => {
    fetchPayrollPeriods()
    fetchEmployees()
  }, [])

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return toast.warning("No records selected.")
  
    const confirm = window.confirm("Are you sure you want to delete selected payroll records?")
    if (!confirm) return
  
    const toastId = toast.loading("Deleting selected records...")
  
    const { error } = await supabase
      .from("payroll_records")
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

    const { error } = await supabase
      .from("payroll_records")
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

  async function recalculatePayrollWithDeductions(periodStart: string, periodEnd: string) {
    const toastId = toast.loading("Recalculating payroll with latest deductions...")

    try {
      const { data: payrollRecords, error: payrollError } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)

      if (payrollError || !payrollRecords) {
        throw new Error("Failed to fetch payroll records")
      }

      const { data: allDeductions, error: deductionError } = await supabase
        .from("deductions")
        .select("employee_id, type, amount, created_at")

      if (deductionError) {
        throw new Error("Failed to fetch deductions")
      }

      const updates = []
      
      for (const record of payrollRecords) {
        const employeeDeductions = allDeductions.filter(d => 
          d.employee_id === record.employee_id &&
          (!d.created_at || d.created_at <= periodEnd)
        )

        let sss = 0, philhealth = 0, pagibig = 0, loans = 0

        employeeDeductions.forEach(d => {
          if (d.type === 'sss') sss += d.amount
          else if (d.type === 'philhealth') philhealth += d.amount
          else if (d.type === 'pagibig') pagibig += d.amount
          else if (d.type === 'other') loans += d.amount
        })

        const basicSalary = record.basic_salary || 0
        const overtimePay = record.overtime_pay || 0
        const allowances = record.allowances || 0
        const absences = record.absences || 0
        
        const grossPay = basicSalary + overtimePay
        const totalDeductions = sss + philhealth + pagibig + loans + absences
        const netPay = grossPay - totalDeductions

        updates.push({
          id: record.id,
          sss,
          philhealth,
          pagibig,
          loans,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay
        })
      }

      for (const update of updates) {
        const { id, ...updateData } = update
        const { error } = await supabase
          .from("payroll_records")
          .update(updateData)
          .eq("id", id)
        
        if (error) {
          console.error("Error updating payroll record:", error)
        }
      }

      toast.success("Payroll recalculated with latest deductions!", { id: toastId })
      fetchPayrollPeriods()
      
    } catch (error: any) {
      toast.error(error.message || "Failed to recalculate payroll", { id: toastId })
    }
  }

  async function fetchPayrollPeriods() {
    const { data: payroll, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_start,
        period_end,
        basic_salary,
        overtime_pay,
        allowances,
        absences,
        total_deductions,
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

    const processedRecords = payroll.map((rec: any) => {
      const otherDeductions = deductions
        ?.filter(d => d.employee_id === rec.employee_id)
        .reduce((sum, d) => sum + d.amount, 0) || 0

      const totalDeductions = otherDeductions + (rec.absences || 0)
      const netAfterDeductions = (rec.basic_salary || 0) + (rec.overtime_pay || 0) - totalDeductions

      return {
        id: rec.id,
        employee_id: rec.employee_id,
        employee_name: rec.employees?.full_name,
        pay_type: rec.employees?.pay_type,
        period_start: rec.period_start,
        period_end: rec.period_end,
        basic_salary: rec.basic_salary || 0,
        overtime_pay: rec.overtime_pay || 0,
        allowances: rec.allowances || 0,
        status: rec.status,
        absences: rec.absences || 0,
        total_deductions: totalDeductions,
        net_after_deductions: netAfterDeductions,
        total_net: netAfterDeductions + (rec.allowances || 0),
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
          records: []
        })
      }

      const period = periodMap.get(periodKey)!
      period.records.push(record)
      period.total_employees = period.records.length
      period.total_basic_salary += record.basic_salary
      period.total_overtime += record.overtime_pay
      period.total_deductions += record.total_deductions || 0
      period.total_net_after_deductions += record.total_net || 0
    })

    setPeriods(Array.from(periodMap.values()))
  }

  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("id, full_name, pay_type")
    if (error) {
      console.error(error)
      return
    }
    setEmployees(data)
  }

  function addEmployeeAdjustment() {
    setEmployeeAdjustments([
      ...employeeAdjustments,
      {
        employee_id: "",
        absenceDays: 0,
        absenceAmountPerDay: 0,
        holidayDate: undefined,
        holidayPay: 0,
        overtimeEntries: []
      },
    ])
  }

  function removeEmployeeAdjustment(index: number) {
    setEmployeeAdjustments(employeeAdjustments.filter((_, i) => i !== index))
  }

  function updateEmployeeAdjustment(
    index: number,
    field: keyof EmployeeAdjustment,
    value: string | number | Date
  ) {
    const updated = [...employeeAdjustments]
    updated[index] = { ...updated[index], [field]: value }
    setEmployeeAdjustments(updated)
  }

  async function handleBulkGeneratePayrollEnhanced() {
    if (!periodStart || !periodEnd) {
      toast.error("Select a valid period first.")
      return
    }

    const toastId = toast.loading("Generating payroll...")

    try {
      const { data: existingPayroll } = await supabase
        .from("payroll_records")
        .select("id")
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
        .limit(1)

      if (existingPayroll && existingPayroll.length > 0) {
        const confirm = window.confirm(
          "Payroll already exists for this period. Do you want to regenerate it? This will overwrite existing records."
        )
        if (!confirm) {
          toast.dismiss(toastId)
          return
        }
        
        await supabase
          .from("payroll_records")
          .delete()
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
      }

      const { data: allEmployees, error: empErr } = await supabase
        .from("employees")
        .select("id, base_salary, allowance, full_name")

      if (empErr || !allEmployees) {
        throw new Error("Failed to fetch employees.")
      }

      const { data: allDeductions, error: deductionError } = await supabase
        .from("deductions")
        .select("employee_id, type, amount, created_at")
        .lte("created_at", format(periodEnd, "yyyy-MM-dd"))

      if (deductionError) {
        throw new Error("Failed to fetch deductions.")
      }

      const recordsToInsert = []

      for (const emp of allEmployees) {
        const { id: employee_id, base_salary, allowance, full_name } = emp

        if (!base_salary) {
          console.warn(`Skipping ${full_name} - no base salary set`)
          continue
        }

        const employeeDeductions = allDeductions.filter(d => d.employee_id === employee_id)
        
        let sss = 0, philhealth = 0, pagibig = 0, loans = 0

        employeeDeductions.forEach(d => {
          if (d.type === 'sss') sss += d.amount
          else if (d.type === 'philhealth') philhealth += d.amount
          else if (d.type === 'pagibig') pagibig += d.amount
          else if (d.type === 'other') loans += d.amount
        })

        const adjustment = employeeAdjustments.find(a => a.employee_id === employee_id)
        
        let absenceDeduction = 0
        let overtimePay = 0

        const overtimeEntries = adjustment?.overtimeEntries || []

        for (const ot of overtimeEntries) {
          overtimePay += ot.hours * ot.ratePerHour
        }

        if (adjustment) {
          if (adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0) {
            absenceDeduction = adjustment.absenceDays * adjustment.absenceAmountPerDay
          }
          
          if (adjustment?.overtimeEntries?.length > 0) {
            overtimePay = adjustment.overtimeEntries.reduce((sum, ot) => {
              return sum + (ot.hours * ot.ratePerHour)
            }, 0)
          }
        }

        const basicSalary = base_salary
        const totalDeductions = sss + philhealth + pagibig + loans + absenceDeduction

        let holidayPay = 0
        if (adjustment?.holidayPay && adjustment.holidayPay > 0) {
          holidayPay = adjustment.holidayPay
        }
    
        const grossPay = basicSalary + overtimePay + holidayPay
        const netPay = grossPay - totalDeductions
        
        recordsToInsert.push({
          employee_id,
          period_start: format(periodStart, "yyyy-MM-dd"),
          period_end: format(periodEnd, "yyyy-MM-dd"),
          basic_salary: basicSalary,
          overtime_pay: overtimePay,
          holiday_pay: holidayPay,
          allowances: allowance || 0,
          absences: absenceDeduction,
          sss,
          philhealth,
          pagibig,
          loans,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          status: "Pending Payment",
        })
      }

      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("payroll_records")
          .insert(recordsToInsert)
      
        if (insertError) {
          throw new Error("Bulk insert failed: " + insertError.message)
        }
      
        const { data: insertedRecords } = await supabase
          .from("payroll_records")
          .select("id, employee_id")
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
      
        const overtimeInserts: any[] = []
      
        for (const rec of insertedRecords || []) {
          const adj = employeeAdjustments.find(a => a.employee_id === rec.employee_id)
          if (!adj || !adj.overtimeEntries?.length) continue
      
          for (const ot of adj.overtimeEntries) {
            overtimeInserts.push({
              payroll_record_id: rec.id,
              employee_id: rec.employee_id,
              overtime_date: format(ot.date, "yyyy-MM-dd"),
              hours: ot.hours,
              rate_per_hour: ot.ratePerHour,
              amount: ot.hours * ot.ratePerHour,
            })
          }
        }
      
        if (overtimeInserts.length > 0) {
          await supabase.from("payroll_overtimes").insert(overtimeInserts)
        }
      
        toast.success(`Payroll generated for ${recordsToInsert.length} employees!`, { id: toastId })
        fetchPayrollPeriods()
      
        setEmployeeAdjustments([])
        setPeriodStart(undefined)
        setPeriodEnd(undefined)
      } else {
        toast.info("No eligible employees found for payroll generation.", { id: toastId })
      }

    } catch (err: any) {
      toast.error(err.message || "An error occurred", { id: toastId })
    }
  }

  useEffect(() => {
    setForm((f) => ({
      ...f,
      period_start: periodStart ? format(periodStart, "yyyy-MM-dd") : "",
      period_end: periodEnd ? format(periodEnd, "yyyy-MM-dd") : "",
    }))
  }, [periodStart, periodEnd])

  function handleViewPeriodRecords(period: PayrollPeriod) {
    setSelectedPeriodRecords(period.records)
    setSelectedPeriodName(period.display_name)
    setPeriodDialogOpen(true)
    setSelectedIds([])
  }

  // Calculate summary metrics for current periods
  const summaryMetrics = {
    totalEmployees: periods.reduce((sum, p) => sum + p.total_employees, 0),
    totalBasicSalary: periods.reduce((sum, p) => sum + p.total_basic_salary, 0),
    totalOvertime: periods.reduce((sum, p) => sum + p.total_overtime, 0),
    totalNet: periods.reduce((sum, p) => sum + p.total_net_after_deductions, 0)
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Payroll Management</h1>
        <p className="text-slate-600">Manage employee payroll periods and generate bulk payroll records</p>
      </div>

      {/* Summary Metrics */}
      {periods.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Total Employees</p>
                <Users className="h-4 w-4 text-slate-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-slate-900">{summaryMetrics.totalEmployees}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Basic Salary</p>
                <DollarSign className="h-4 w-4 text-slate-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-slate-900">₱{summaryMetrics.totalBasicSalary.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Overtime Pay</p>
                <TrendingUp className="h-4 w-4 text-slate-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-slate-900">₱{summaryMetrics.totalOvertime.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Total Net Pay</p>
                <Calculator className="h-4 w-4 text-slate-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-slate-900">₱{summaryMetrics.totalNet.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Payroll Periods</h2>
          <p className="text-slate-600">View and manage payroll periods</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Generate Payroll
            </Button>
          </DialogTrigger>

          <DialogContent className="w-[50vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">Generate Payroll for All Employees</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={(e) => {
              e.preventDefault()
              handleBulkGeneratePayrollEnhanced()
              setOpen(false)
            }} className="space-y-6">

              {/* Period Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Period Start</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3 cursor-pointer w-full justify-start text-left">
                        {periodStart ? format(periodStart, "PPP") : <span className="text-slate-500">Select date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </div>
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

                <div>
                  <Label className="text-sm font-medium text-slate-700">Period End</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3 cursor-pointer w-full justify-start text-left">
                        {periodEnd ? format(periodEnd, "PPP") : <span className="text-slate-500">Select date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </div>
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
              </div>

              {/* Employee Adjustments Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-lg font-medium text-slate-900">Employee Adjustments</Label>
                    <p className="text-slate-600 text-sm">Add overtime, absences, or holiday pay adjustments</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addEmployeeAdjustment}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Employee
                  </Button>
                </div>

                {employeeAdjustments.length === 0 && (
                  <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No employee adjustments added</p>
                    <p className="text-sm">Click "Add Employee" to include specific adjustments</p>
                  </div>
                )}

                {employeeAdjustments.map((adjustment, index) => (
                  <Card key={index} className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-slate-700">Employee #{index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEmployeeAdjustment(index)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-slate-700">Employee</Label>
                          <Select
                            value={adjustment.employee_id}
                            onValueChange={(value) => updateEmployeeAdjustment(index, 'employee_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees
                                .filter(emp => !employeeAdjustments.some((a, i) => i !== index && a.employee_id === emp.id))
                                .map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.full_name} ({emp.pay_type})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Absence Section */}
                        <div className="border-t border-slate-200 pt-4">
                          <Label className="text-sm font-medium text-slate-900 mb-3 block">Absence Deductions</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-slate-600">Days Absent</Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={adjustment.absenceDays || ''}
                                onChange={(e) =>
                                  updateEmployeeAdjustment(index, 'absenceDays', parseInt(e.target.value) || 0)
                                }
                              />
                            </div>

                            <div>
                              <Label className="text-sm text-slate-600">Amount Per Day</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={adjustment.absenceAmountPerDay || ''}
                                onChange={(e) =>
                                  updateEmployeeAdjustment(index, 'absenceAmountPerDay', parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                          </div>

                          {adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0 && (
                            <div className="text-sm text-slate-900 bg-slate-100 p-3 rounded mt-3">
                              <span className="font-medium">Total Absence Deduction:</span> -₱{(adjustment.absenceDays * adjustment.absenceAmountPerDay).toLocaleString()}
                            </div>
                          )}
                        </div>

                        {/* Overtime Section */}
                        <div className="border-t border-slate-200 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <Label className="text-sm font-medium text-slate-900">Overtime Pay</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addOvertimeEntry(index)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Entry
                            </Button>
                          </div>

                          {adjustment.overtimeEntries.length > 0 && (
                            <div className="text-sm text-slate-900 bg-slate-100 p-3 rounded mb-3">
                              <span className="font-medium">Total Overtime Pay:</span> +₱
                              {adjustment.overtimeEntries
                                .reduce((sum, ot) => sum + (ot.hours * ot.ratePerHour), 0)
                                .toLocaleString()}
                            </div>
                          )}

                          {adjustment.overtimeEntries.map((ot, otIndex) => (
                            <div key={otIndex} className="grid grid-cols-3 gap-3 items-end border border-slate-200 p-3 rounded mb-2 bg-slate-50">
                              <div>
                                <Label className="text-sm text-slate-600">Date</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3 cursor-pointer w-full justify-start text-left">
                                      {ot.date ? format(ot.date, "PPP") : <span className="text-slate-500">Select date</span>}
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={ot.date}
                                      onSelect={(date) => updateOvertimeEntry(index, otIndex, "date", date)}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>

                              <div>
                                <Label className="text-sm text-slate-600">Hours</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={isNaN(ot.hours) ? "" : ot.hours}
                                  onChange={(e) =>
                                    updateOvertimeEntry(index, otIndex, "hours", parseFloat(e.target.value) || 0)
                                  }
                                />
                              </div>

                              <div>
                                <Label className="text-sm text-slate-600">Rate Per Hour</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={isNaN(ot.ratePerHour) ? "" : ot.ratePerHour}
                                  onChange={(e) =>
                                    updateOvertimeEntry(index, otIndex, "ratePerHour", parseFloat(e.target.value) || 0)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Holiday Pay Section */}
                        <div className="border-t border-slate-200 pt-4">
                          <Label className="text-sm font-medium text-slate-900 mb-3 block">Holiday Pay</Label>
                          <div className="space-y-3">
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3 cursor-pointer w-full justify-start text-left">
                                  {adjustment.holidayDate ? format(adjustment.holidayDate, "PPP") : <span className="text-slate-500">Select holiday date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={adjustment.holidayDate}
                                  onSelect={(date) => updateEmployeeAdjustment(index, "holidayDate", date as Date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>

                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Holiday pay amount"
                              value={adjustment.holidayPay || ""}
                              onChange={(e) =>
                                updateEmployeeAdjustment(index, "holidayPay", parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                        </div>

                        {/* Net Effect Summary */}
                        {((adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0) || 
                          (adjustment.overtimeEntries?.length > 0) ||
                          (adjustment.holidayPay && adjustment.holidayPay > 0)) && (
                          <div className="border-t border-slate-200 pt-4 bg-slate-50 p-4 rounded">
                            <Label className="text-sm font-medium text-slate-900 mb-2 block">Net Adjustment Summary</Label>
                            <div className="space-y-1 text-sm">
                              {adjustment.overtimeEntries.length > 0 && (
                                <div className="text-slate-700">
                                  Overtime: +₱
                                  {adjustment.overtimeEntries.reduce(
                                    (sum, ot) => sum + (ot.hours * ot.ratePerHour),
                                    0
                                  ).toLocaleString()}
                                </div>
                              )}

                              {adjustment.holidayPay && adjustment.holidayPay > 0 && (
                                <div className="text-slate-700">
                                  Holiday Pay: +₱{adjustment.holidayPay.toLocaleString()}
                                </div>
                              )}

                              {adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0 && (
                                <div className="text-slate-700">
                                  Absence: -₱
                                  {(adjustment.absenceDays * adjustment.absenceAmountPerDay).toLocaleString()}
                                </div>
                              )}

                              <div className="font-medium text-slate-900 border-t border-slate-200 pt-2 mt-2">
                                Net Effect: {(() => {
                                  const overtime = adjustment.overtimeEntries.reduce(
                                    (sum, ot) => sum + (ot.hours * ot.ratePerHour),
                                    0
                                  )
                                  const holiday = adjustment.holidayPay || 0
                                  const absence = (adjustment.absenceDays || 0) * (adjustment.absenceAmountPerDay || 0)
                                  const net = overtime + holiday - absence
                                  return net >= 0 ? `+₱${net.toLocaleString()}` : `-₱${Math.abs(net).toLocaleString()}`
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                Generate Payroll
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payroll Periods List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No payroll periods found</h3>
              <p className="text-slate-600 mb-4">Generate your first payroll to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {periods.map((period) => (
                <div
                  key={period.period_key}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-slate-900">{period.display_name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-slate-600">Employees:</span>
                        <span className="font-medium text-slate-900 ml-1">{period.total_employees}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Basic Pay:</span>
                        <span className="font-medium text-slate-900 ml-1">₱{period.total_basic_salary.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Overtime:</span>
                        <span className="font-medium text-slate-900 ml-1">₱{period.total_overtime.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Deductions:</span>
                        <span className="font-medium text-slate-900 ml-1">₱{period.total_deductions.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Total Net:</span>
                        <span className="font-bold text-slate-900 ml-1">₱{period.total_net_after_deductions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPeriodRecords(period)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePeriod(period.period_key)}
                      className="text-slate-500 hover:text-slate-700 border-slate-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Details Dialog */}
      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent className="max-w-7xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Payroll Details - {selectedPeriodName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-600">{selectedIds.length} records selected</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="text-slate-700 border-slate-300"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </Button>
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-medium text-slate-900">Employee</TableHead>
                    <TableHead className="font-medium text-slate-900">Pay Type</TableHead>
                    <TableHead className="font-medium text-slate-900">Basic Salary</TableHead>
                    <TableHead className="font-medium text-slate-900">Overtime Pay</TableHead>
                    <TableHead className="font-medium text-slate-900">Allowance</TableHead>
                    <TableHead className="font-medium text-slate-900">Total Deductions</TableHead>
                    <TableHead className="font-medium text-slate-900">Absences</TableHead>
                    <TableHead className="font-medium text-slate-900">Net After Deductions</TableHead>
                    <TableHead className="font-medium text-slate-900">Total Net</TableHead>
                    <TableHead className="font-medium text-slate-900">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPeriodRecords.map((rec) => (
                    <TableRow
                      key={rec.id}
                      onClick={() => {
                        setEditRecord(rec)
                        setEditDialogOpen(true)
                      }}
                      className="cursor-pointer hover:bg-slate-50 transition border-b border-slate-100"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rec.id)}
                          onChange={() => handleSelect(rec.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{rec.employee_name}</TableCell>
                      <TableCell className="text-slate-600">{rec.pay_type}</TableCell>
                      <TableCell className="text-slate-900">₱{rec.basic_salary.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-900 font-medium">₱{rec.overtime_pay.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-900">₱{rec.allowances?.toLocaleString() || 0}</TableCell>
                      <TableCell className="text-slate-900">₱{rec.total_deductions?.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-900">₱{rec.absences?.toLocaleString() || 0}</TableCell>
                      <TableCell className="text-slate-900 font-bold">₱{rec.net_after_deductions?.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-900 font-bold">
                        ₱{rec.total_net?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium border",
                          statusVariants[rec.status] || "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {rec.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-900">Edit Payroll Record</DialogTitle>
          </DialogHeader>

          {editRecord && (
            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault()
                const toastId = toast.loading("Updating payroll...")

                const grossPay = (editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)
                const netAfterDeductions = grossPay - (editRecord.total_deductions || 0)
                const totalNet = netAfterDeductions + (editRecord.allowances || 0)

                const { error } = await supabase
                  .from("payroll_records")
                  .update({
                    basic_salary: editRecord.basic_salary,
                    overtime_pay: editRecord.overtime_pay,
                    allowances: editRecord.allowances || 0,
                    holiday_pay: 0,
                    absences: editRecord.absences || 0,
                    gross_pay: grossPay,
                    total_deductions: editRecord.total_deductions || 0,
                    net_pay: netAfterDeductions,
                    status: editRecord.status,
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
                        total_net: totalNet,
                        net_after_deductions: netAfterDeductions
                      } : rec
                    )
                    setSelectedPeriodRecords(updatedRecords)
                  }
                }
              }}
            >
              {/* Read-only fields */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Employee</Label>
                  <Input
                    value={editRecord.employee_name || ""}
                    disabled
                    className="bg-slate-50 border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Pay Type</Label>
                    <Input
                      value={editRecord.pay_type || ""}
                      disabled
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Period</Label>
                    <Input
                      value={editRecord.period_start && editRecord.period_end ? 
                        `${format(new Date(editRecord.period_start), "MMM d")} - ${format(new Date(editRecord.period_end), "MMM d, yyyy")}` : ""}
                      disabled
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Basic Salary</Label>
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
                    <Label className="text-sm font-medium text-slate-700">Overtime Pay</Label>
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
                    <Label className="text-sm font-medium text-slate-700">Allowances</Label>
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
                    <Label className="text-sm font-medium text-slate-700">Absence Deductions</Label>
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
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Other Deductions</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={(editRecord.total_deductions || 0) - (editRecord.absences || 0)}
                    onChange={(e) => {
                      const otherDeductions = parseFloat(e.target.value) || 0
                      const totalDeductions = (editRecord.absences || 0) + otherDeductions
                      setEditRecord((prev) =>
                        prev ? { ...prev, total_deductions: totalDeductions } : prev
                      )
                    }}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Payment Status</Label>
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

              {/* Calculated Values */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-sm font-medium text-slate-900">Calculated Values</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Gross Pay (Basic + Overtime):</span>
                    <div className="font-medium text-slate-900">
                      ₱{((editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-600">Total Deductions:</span>
                    <div className="font-medium text-slate-900">
                      ₱{(editRecord.total_deductions || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Net After Deductions:</span>
                    <div className="font-medium text-slate-900">
                      ₱{(((editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)) - (editRecord.total_deductions || 0)).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-600">Total Net (with Allowances):</span>
                    <div className="font-bold text-slate-900">
                      ₱{((((editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)) - (editRecord.total_deductions || 0)) + (editRecord.allowances || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white">
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