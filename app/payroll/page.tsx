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
import { CalendarIcon, Eye, Trash2, Plus, X } from "lucide-react"
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

type EmployeeAdjustment = {
  employee_id: string
  absenceDays: number
  absenceAmountPerDay: number
  overtimeHours: number
  overtimeRatePerHour: number
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
  
  // Enhanced absent employees state - now supports multiple employees
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

    // Get the period to find the date range
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



  // 1. Add this function to recalculate payroll with updated deductions
async function recalculatePayrollWithDeductions(periodStart: string, periodEnd: string) {
  const toastId = toast.loading("Recalculating payroll with latest deductions...")

  try {
    // Get all payroll records for this period
    const { data: payrollRecords, error: payrollError } = await supabase
      .from("payroll_records")
      .select("*")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)

    if (payrollError || !payrollRecords) {
      throw new Error("Failed to fetch payroll records")
    }

    // Get all deductions
    const { data: allDeductions, error: deductionError } = await supabase
      .from("deductions")
      .select("employee_id, type, amount, created_at")

    if (deductionError) {
      throw new Error("Failed to fetch deductions")
    }

    // Update each payroll record with correct deductions
    const updates = []
    
    for (const record of payrollRecords) {
      // Filter deductions for this employee within this period
      const employeeDeductions = allDeductions.filter(d => 
        d.employee_id === record.employee_id &&
        (!d.created_at || d.created_at <= periodEnd) // Only include deductions created before or during period
      )

      // Calculate deductions by type
      let sss = 0, philhealth = 0, pagibig = 0, loans = 0

      employeeDeductions.forEach(d => {
        if (d.type === 'sss') sss += d.amount
        else if (d.type === 'philhealth') philhealth += d.amount
        else if (d.type === 'pagibig') pagibig += d.amount
        else if (d.type === 'other') loans += d.amount
      })

      // Calculate totals
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

    // Batch update all records
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
    fetchPayrollPeriods() // Refresh the display
    
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

    // Process records with deductions
    const processedRecords = payroll.map((rec: any) => {
// Always show full lifetime deductions (repeated every period by design)
    const otherDeductions = deductions
      ?.filter(d => d.employee_id === rec.employee_id)
      .reduce((sum, d) => sum + d.amount, 0) || 0

    

      // Total deductions = other deductions + absences (from the payroll record)
      const totalDeductions = otherDeductions + (rec.absences || 0)

      // Calculate net after deductions = basic_salary + overtime_pay - total_deductions
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
        // Total net = net after deductions + allowances
        total_net: netAfterDeductions + (rec.allowances || 0),
      }   
    })

    // Group by period
    const periodMap = new Map<string, PayrollPeriod>()

    processedRecords.forEach((record) => {
      const periodKey = `${record.period_start}_${record.period_end}`
      
      if (!periodMap.has(periodKey)) {
        // Create display name (e.g., "September 1-15, 2025")
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

  // Function to add new absent employee
  function addEmployeeAdjustment() {
    setEmployeeAdjustments([...employeeAdjustments, {
      employee_id: "",
      absenceDays: 0,
      absenceAmountPerDay: 0,
      overtimeHours: 0,
      overtimeRatePerHour: 0
    }])
  }
  

  // Function to remove absent employee
  function removeEmployeeAdjustment(index: number) {
    setEmployeeAdjustments(employeeAdjustments.filter((_, i) => i !== index))
  }

  // Function to update absent employee
  function updateEmployeeAdjustment(index: number, field: keyof EmployeeAdjustment, value: string | number) {
    const updated = [...employeeAdjustments]
    updated[index] = { ...updated[index], [field]: value }
    setEmployeeAdjustments(updated)
  }

// 2. Enhanced bulk payroll generation with better deduction handling
async function handleBulkGeneratePayrollEnhanced() {
  if (!periodStart || !periodEnd) {
    toast.error("Select a valid period first.")
    return
  }

  const toastId = toast.loading("Generating payroll...")

  try {
    // Check if payroll already exists for this period
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
      
      // Delete existing payroll for this period
      await supabase
        .from("payroll_records")
        .delete()
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"))
    }

    // Get all employees
    const { data: allEmployees, error: empErr } = await supabase
      .from("employees")
      .select("id, base_salary, allowance, full_name")

    if (empErr || !allEmployees) {
      throw new Error("Failed to fetch employees.")
    }

    // Get all deductions (including ones created before this period)
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

      // Get deductions for this employee
      const employeeDeductions = allDeductions.filter(d => d.employee_id === employee_id)
      
      let sss = 0, philhealth = 0, pagibig = 0, loans = 0

      employeeDeductions.forEach(d => {
        if (d.type === 'sss') sss += d.amount
        else if (d.type === 'philhealth') philhealth += d.amount
        else if (d.type === 'pagibig') pagibig += d.amount
        else if (d.type === 'other') loans += d.amount
      })

      // Get employee adjustments (absences/overtime)
      const adjustment = employeeAdjustments.find(a => a.employee_id === employee_id)
      
      let absenceDeduction = 0
      let overtimePay = 0

      if (adjustment) {
        if (adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0) {
          absenceDeduction = adjustment.absenceDays * adjustment.absenceAmountPerDay
        }

        if (adjustment.overtimeHours > 0 && adjustment.overtimeRatePerHour > 0) {
          overtimePay = adjustment.overtimeHours * adjustment.overtimeRatePerHour
        }
      }

      // Calculate totals
      const basicSalary = base_salary
      const grossPay = basicSalary + overtimePay
      const totalDeductions = sss + philhealth + pagibig + loans + absenceDeduction
      const netPay = grossPay - totalDeductions

      recordsToInsert.push({
        employee_id,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        basic_salary: basicSalary,
        overtime_pay: overtimePay,
        allowances: allowance || 0,
        holiday_pay: 0,
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
      
      toast.success(`Payroll generated for ${recordsToInsert.length} employees!`, { id: toastId })
      fetchPayrollPeriods()
      
      // Reset form
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
  


  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payroll Management</h1>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Generate Payroll for All Employees</Button>
          </DialogTrigger>

          <DialogContent className="lg:w-[40vw] sm:w-[90vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Payroll</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleBulkGeneratePayrollEnhanced()
              setOpen(false)
            }} className="space-y-4">

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

              {/* {selectedPeriodRecords.length > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const period = periods.find(p => p.display_name === selectedPeriodName)
                      if (period) {
                        recalculatePayrollWithDeductions(period.period_start, period.period_end)
                      }
                    }}
                  >
                    Recalculate with Latest Deductions
                  </Button>
                )} */}

              {/* Absent Employees Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Employee Adjustments (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmployeeAdjustment}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Employee
                  </Button>
                </div>

                {employeeAdjustments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No absent employees added. Click "Add Absent Employee" to include absence deductions.
                  </p>
                )}

{employeeAdjustments.map((adjustment, index) => (
    <Card key={index} className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Employee #{index + 1}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeEmployeeAdjustment(index)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <Label className="text-sm">Employee</Label>
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
        <div className="border-t pt-3">
          <Label className="text-sm font-medium text-red-600 mb-2 block">Absence Deductions</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Days Absent</Label>
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
              <Label className="text-sm">Amount Per Day</Label>
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
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
              Total Absence Deduction: -₱{(adjustment.absenceDays * adjustment.absenceAmountPerDay).toLocaleString()}
            </div>
          )}
        </div>

        {/* Overtime Section */}
        <div className="border-t pt-3">
          <Label className="text-sm font-medium text-green-600 mb-2 block">Overtime Pay</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Overtime Hours</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={adjustment.overtimeHours || ''}
                onChange={(e) =>
                  updateEmployeeAdjustment(index, 'overtimeHours', parseFloat(e.target.value) || 0)
                }
              />
            </div>

            <div>
              <Label className="text-sm">Rate Per Hour</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={adjustment.overtimeRatePerHour || ''}
                onChange={(e) =>
                  updateEmployeeAdjustment(index, 'overtimeRatePerHour', parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          {adjustment.overtimeHours > 0 && adjustment.overtimeRatePerHour > 0 && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded mt-2">
              Total Overtime Pay: +₱{(adjustment.overtimeHours * adjustment.overtimeRatePerHour).toLocaleString()}
            </div>
          )}
        </div>

        {/* Net Effect Summary */}
        {(adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0) || 
         (adjustment.overtimeHours > 0 && adjustment.overtimeRatePerHour > 0) && (
          <div className="border-t pt-3 bg-blue-50 p-3 rounded">
            <Label className="text-sm font-medium mb-2 block">Net Adjustment</Label>
            <div className="text-sm">
              {adjustment.overtimeHours > 0 && adjustment.overtimeRatePerHour > 0 && (
                <div className="text-green-600">
                  Overtime: +₱{(adjustment.overtimeHours * adjustment.overtimeRatePerHour).toLocaleString()}
                </div>
              )}
              {adjustment.absenceDays > 0 && adjustment.absenceAmountPerDay > 0 && (
                <div className="text-red-600">
                  Absence: -₱{(adjustment.absenceDays * adjustment.absenceAmountPerDay).toLocaleString()}
                </div>
              )}
              <div className="font-medium text-blue-600 border-t pt-1 mt-1">
                Net Effect: {(() => {
                  const overtime = (adjustment.overtimeHours || 0) * (adjustment.overtimeRatePerHour || 0)
                  const absence = (adjustment.absenceDays || 0) * (adjustment.absenceAmountPerDay || 0)
                  const net = overtime - absence
                  return net >= 0 ? `+₱${net.toLocaleString()}` : `-₱${Math.abs(net).toLocaleString()}`
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  ))}
</div>

              <Button type="submit" className="w-full">
                Generate Payroll
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payroll Periods List */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Payroll Periods</h2>
          
          {periods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No payroll periods found.</p>
              <p>Generate your first payroll to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map((period) => (
                <div
                  key={period.period_key}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-lg">{period.display_name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Employees: {period.total_employees}</span>
                      <span>Basic Pay: ₱{period.total_basic_salary.toLocaleString()}</span>
                      <span>Overtime: ₱{period.total_overtime.toLocaleString()}</span>
                      <span>Deductions: ₱{period.total_deductions.toLocaleString()}</span>
                      <span className="font-medium">Total Net: ₱{period.total_net_after_deductions.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPeriodRecords(period)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePeriod(period.period_key)}
                      className="text-destructive hover:text-destructive"
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
        <DialogContent className="max-w-8xl w-[90vw] max-h-[85vh] overflow-x-auto ">
          <DialogHeader>
            <DialogTitle>Payroll Details - {selectedPeriodName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedIds.length > 0 && (
              <Button variant="destructive" onClick={handleDeleteSelected}>
                Delete Selected ({selectedIds.length})
              </Button>
            )}

            <div className="overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay Type</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Overtime Pay</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>Total Deductions</TableHead>
                    <TableHead>Absences</TableHead>
                    <TableHead>Net After Deductions</TableHead>
                    <TableHead>Total Net</TableHead>
                    <TableHead>Status</TableHead>
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
                      className="cursor-pointer hover:bg-muted transition"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rec.id)}
                          onChange={() => handleSelect(rec.id)}
                        />
                      </TableCell>
                      <TableCell>{rec.employee_name}</TableCell>
                      <TableCell>{rec.pay_type}</TableCell>
                      <TableCell>₱ {rec.basic_salary.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600 font-medium">₱ {rec.overtime_pay.toLocaleString()}</TableCell>
                      <TableCell>₱ {rec.allowances?.toLocaleString() || 0}</TableCell>
                      <TableCell>₱ {rec.total_deductions?.toLocaleString()}</TableCell>
                      <TableCell>₱ {rec.absences?.toLocaleString() || 0}</TableCell>
                      <TableCell className="font-bold">₱ {rec.net_after_deductions?.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">
                        ₱ {rec.total_net?.toLocaleString() || 0}
                      </TableCell>

                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs",
                          rec.status === "Paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
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
  <DialogContent className="w-[50vw] max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Edit Payroll Record</DialogTitle>
    </DialogHeader>

    {editRecord && (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const toastId = toast.loading("Updating payroll...")

          // Calculate derived values
          const grossPay = (editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)
          const netAfterDeductions = grossPay - (editRecord.total_deductions || 0)
          const totalNet = netAfterDeductions + (editRecord.allowances || 0)

          const { error } = await supabase
            .from("payroll_records")
            .update({
              basic_salary: editRecord.basic_salary,
              overtime_pay: editRecord.overtime_pay,
              allowances: editRecord.allowances || 0,
              holiday_pay: 0, // You can add this field if needed
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
            // Update the selected period records if viewing details
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
        {/* Employee Name (Read-only) */}
        <div>
          <Label>Employee</Label>
          <Input
            value={editRecord.employee_name || ""}
            disabled
            className="bg-muted"
          />
        </div>

        {/* Pay Type (Read-only) */}
        <div>
          <Label>Pay Type</Label>
          <Input
            value={editRecord.pay_type || ""}
            disabled
            className="bg-muted"
          />
        </div>

        {/* Period (Read-only) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Period Start</Label>
            <Input
              value={editRecord.period_start ? format(new Date(editRecord.period_start), "PPP") : ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Period End</Label>
            <Input
              value={editRecord.period_end ? format(new Date(editRecord.period_end), "PPP") : ""}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        {/* Editable Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Basic Salary</Label>
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
            <Label>Overtime Pay</Label>
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
            <Label>Allowances</Label>
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
            <Label>Absence Deductions</Label>
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
          <Label>Other Deductions</Label>
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

        {/* Calculated Fields (Read-only) */}
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-medium text-sm">Calculated Values</h3>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs">Gross Pay (Basic + Overtime)</Label>
              <div className="font-medium">
                ₱{((editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)).toLocaleString()}
              </div>
            </div>

            <div>
              <Label className="text-xs">Total Deductions</Label>
              <div className="font-medium">
                ₱{(editRecord.total_deductions || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs">Net After Deductions</Label>
              <div className="font-medium">
                ₱{(((editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)) - (editRecord.total_deductions || 0)).toLocaleString()}
              </div>
            </div>

            <div>
              <Label className="text-xs">Total Net (with Allowances)</Label>
              <div className="font-bold text-green-600">
                ₱{((((editRecord.basic_salary || 0) + (editRecord.overtime_pay || 0)) - (editRecord.total_deductions || 0)) + (editRecord.allowances || 0)).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <Label>Payment Status</Label>
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

        <div className="flex gap-2">
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