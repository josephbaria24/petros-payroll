"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, DollarSign, Users, TrendingUp, Calculator, FileText, Calendar, Building2, PieChart, BarChart3, Settings2, ChevronLeft, ChevronRight } from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"

declare global {
  interface Window {
    XLSX: any;
  }
}

type PayrollSummary = {
  totalGross: number
  totalDeductions: number
  netAfterDeductions: number
  totalAllowances: number
  totalNetPay: number
}

type MonthlyPayrollSummary = {
  month: string
  year: number
  monthYear: string
  totalEmployees: number
  totalGrossPay: number
  totalDeductions: number
  totalNetPay: number
  totalAllowances: number
  recordCount: number
}

type EmployeePayrollDetail = {
  id: string
  employee_id: string
  employee_code?: string
  full_name: string
  pay_type: string
  basic_salary: number
  allowances: number
  overtime_pay: number
  holiday_pay: number
  gross_pay: number
  absences: number
  total_deductions: number
  net_pay: number
  period_start: string
  period_end: string
  month_year: string
  status: string
  sss: number
  philhealth: number
  pagibig: number
  withholding_tax: number
  loans: number
  uniform: number
  tardiness: number
  cash_advance: number
}

type Deduction = {
  id: string
  employee_name: string
  type: string
  amount: number
  created_at: string
}

type Expense = {
  id: string
  expense_name: string
  category: string
  amount: number
  incurred_on: string
}

const statusVariants: Record<string, string> = {
  "Paid": "bg-primary text-primary-foreground border-transparent",
  "Pending Payment": "bg-muted text-muted-foreground border-border",
  "Cancelled": "bg-muted/50 text-muted-foreground border-border",
}

export default function ReportsPage() {
  useProtectedPage(["admin", "hr"])
  const { activeOrganization } = useOrganization()

  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary>({
    totalGross: 0,
    totalDeductions: 0,
    netAfterDeductions: 0,
    totalAllowances: 0,
    totalNetPay: 0,
  })
  const [monthlyPayrollSummary, setMonthlyPayrollSummary] = useState<MonthlyPayrollSummary[]>([])
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [employeePayrollDetails, setEmployeePayrollDetails] = useState<EmployeePayrollDetail[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [currentMonthlyPage, setCurrentMonthlyPage] = useState(1)
  const [currentDeductionsPage, setCurrentDeductionsPage] = useState(1)
  const [currentExpensesPage, setCurrentExpensesPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    fetchReports()
    loadXLSXLibrary()
    setCurrentPage(1)
    setCurrentMonthlyPage(1)
    setCurrentDeductionsPage(1)
    setCurrentExpensesPage(1)
  }, [activeOrganization])

  const loadXLSXLibrary = () => {
    if (typeof window !== 'undefined' && !window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = () => {
        console.log('XLSX library loaded')
      }
      document.head.appendChild(script)
    }
  }

  const exportToExcel = () => {
    if (!window.XLSX) {
      alert('Excel library is still loading. Please try again in a moment.')
      return
    }

    if (employeePayrollDetails.length === 0) {
      alert('No employee payroll data to export')
      return
    }

    const excelData = employeePayrollDetails.map(emp => ({
      'Employee ID': emp.employee_id,
      'Employee Code': emp.employee_code || 'N/A',
      'Full Name': emp.full_name,
      'Pay Type': emp.pay_type,
      'Period Start': emp.period_start,
      'Period End': emp.period_end,
      'Basic Salary': emp.basic_salary,
      'Allowances': emp.allowances,
      'Overtime Pay': emp.overtime_pay,
      'Holiday Pay': emp.holiday_pay,
      'Gross Pay': emp.gross_pay,
      'Absences': emp.absences,
      'SSS': emp.sss,
      'PhilHealth': emp.philhealth,
      'Pag-IBIG': emp.pagibig,
      'Withholding Tax': emp.withholding_tax,
      'Loans': emp.loans,
      'Uniform': emp.uniform,
      'Tardiness': emp.tardiness,
      'Cash Advance': emp.cash_advance, // ✅ add this
      'Total Deductions': emp.total_deductions + emp.cash_advance, // ✅ updated
      'Net Pay': emp.net_pay + emp.allowances - emp.cash_advance, // ✅ adjusted
      'Status': emp.status,
      'Month/Year': emp.month_year
    }))

    const wb = window.XLSX.utils.book_new()
    const ws = window.XLSX.utils.json_to_sheet(excelData)

    ws['!cols'] = Array(24).fill({ width: 15 })

    window.XLSX.utils.book_append_sheet(wb, ws, "Employee Payroll Details")

    const currentDate = new Date().toISOString().split('T')[0]
    const filename = `Employee_Payroll_Report_${currentDate}.xlsx`

    window.XLSX.writeFile(wb, filename)
  }

  async function fetchReports() {
    try {
      if (activeOrganization === "palawan") {
        // Load Palawan data from localStorage
        const storedPayroll = localStorage.getItem("palawan_payroll_records")
        const storedDeductions = localStorage.getItem("palawan_deductions")
        const storedEmployees = localStorage.getItem("palawan_employees")

        const palawanPayroll = storedPayroll ? JSON.parse(storedPayroll) : []
        const palawanDeductions = storedDeductions ? JSON.parse(storedDeductions) : []
        const palawanEmployees = storedEmployees ? JSON.parse(storedEmployees) : []

        const enrichedPayroll = palawanPayroll.map((rec: any) => {
          const emp = palawanEmployees.find((e: any) => e.id === rec.employee_id)
          const periodEndDate = new Date(rec.period_end)
          const monthYear = `${periodEndDate.toLocaleDateString('en-US', { month: 'long' })} ${periodEndDate.getFullYear()}`

          return {
            ...rec,
            full_name: emp?.full_name || 'Unknown',
            employee_code: emp?.employee_code || 'N/A',
            pay_type: emp?.pay_type || 'N/A',
            month_year: monthYear,
            withholding_tax: rec.withholding_tax || 0,
            uniform: rec.uniform || 0,
            tardiness: rec.tardiness || 0,
          }
        })

        setEmployeePayrollDetails(enrichedPayroll)
        setDeductions(palawanDeductions)

        // Calculate summary from localStorage data
        const totalGross = enrichedPayroll.reduce((sum: number, r: any) => sum + (r.gross_pay || 0), 0)
        const totalDeductions = enrichedPayroll.reduce((sum: number, r: any) => sum + (r.total_deductions || 0), 0)
        const totalNetPay = enrichedPayroll.reduce((sum: number, r: any) => sum + (r.net_pay || 0), 0)

        setPayrollSummary({
          totalGross,
          totalDeductions,
          netAfterDeductions: totalNetPay,
          totalAllowances: enrichedPayroll.reduce((sum: number, r: any) => sum + (r.allowances || 0), 0),
          totalNetPay
        })

        return
      }

      const { data: payrollRecords, error: payrollError } = await supabase
        .from("payroll_records")
        .select(`
          id,
          employee_id,
          period_start,
          period_end,
          basic_salary,
          allowances,
          overtime_pay,
          holiday_pay,
          gross_pay,
          absences,
          cash_advance,
          total_deductions,
          net_pay,
          sss,
          philhealth,
          pagibig,
          withholding_tax,
          loans,
          uniform,
          tardiness,
          status,
          employees(id, employee_code, full_name, pay_type)
        `)
        .order("period_end", { ascending: false })

      if (payrollError) {
        console.error("Error fetching payroll records:", payrollError)
        return
      }

      const { data: deductionRecords, error: deductionError } = await supabase
        .from("deductions")
        .select(`
          id,
          employee_id,
          type,
          amount,
          created_at,
          employees(full_name)
        `)
        .order("created_at", { ascending: false })

      if (deductionError) {
        console.error("Error fetching deductions:", deductionError)
      }

      const employeeDetails: EmployeePayrollDetail[] = (payrollRecords || []).map((record: any) => {
        const periodEndDate = new Date(record.period_end)
        const monthYear = `${periodEndDate.toLocaleDateString('en-US', { month: 'long' })} ${periodEndDate.getFullYear()}`

        return {
          id: record.id,
          employee_id: record.employee_id,
          employee_code: record.employees?.employee_code || 'N/A',
          full_name: record.employees?.full_name || 'Unknown',
          pay_type: record.employees?.pay_type || 'N/A',
          basic_salary: record.basic_salary || 0,
          allowances: record.allowances || 0,
          overtime_pay: record.overtime_pay || 0,
          holiday_pay: record.holiday_pay || 0,
          gross_pay: record.gross_pay || 0,
          absences: record.absences || 0,
          total_deductions: record.total_deductions || 0,
          net_pay: record.net_pay || 0,
          period_start: record.period_start,
          period_end: record.period_end,
          month_year: monthYear,
          status: record.status || 'Unknown',
          sss: record.sss || 0,
          philhealth: record.philhealth || 0,
          pagibig: record.pagibig || 0,
          withholding_tax: record.withholding_tax || 0,
          loans: record.loans || 0,
          uniform: record.uniform || 0,
          tardiness: record.tardiness || 0,
          cash_advance: record.cash_advance || 0,
        }
      })

      setEmployeePayrollDetails(employeeDetails)

      const monthlyMap = new Map<string, MonthlyPayrollSummary>()

      employeeDetails.forEach((record) => {
        const periodEndDate = new Date(record.period_end)
        const month = periodEndDate.toLocaleDateString('en-US', { month: 'long' })
        const year = periodEndDate.getFullYear()
        const monthYearKey = `${year}-${String(periodEndDate.getMonth() + 1).padStart(2, '0')}`
        const monthYear = `${month} ${year}`

        if (!monthlyMap.has(monthYearKey)) {
          monthlyMap.set(monthYearKey, {
            month,
            year,
            monthYear,
            totalEmployees: 0,
            totalGrossPay: 0,
            totalDeductions: 0,
            totalNetPay: 0,
            totalAllowances: 0,
            recordCount: 0
          })
        }

        const monthlyData = monthlyMap.get(monthYearKey)!
        monthlyData.recordCount += 1
        monthlyData.totalGrossPay += record.gross_pay || record.basic_salary || 0
        monthlyData.totalDeductions += (record.total_deductions || 0) + (record.cash_advance || 0)
        monthlyData.totalNetPay += (record.net_pay || 0) - (record.cash_advance || 0)
        monthlyData.totalAllowances += record.allowances

        const uniqueEmployees = new Set<string>()
        employeeDetails.forEach((emp) => {
          const empEndDate = new Date(emp.period_end)
          if (empEndDate.getFullYear() === year && empEndDate.getMonth() === periodEndDate.getMonth()) {
            uniqueEmployees.add(emp.employee_id)
          }
        })
        monthlyData.totalEmployees = uniqueEmployees.size
      })

      const monthlySummary = Array.from(monthlyMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month.localeCompare(a.month)
      })

      setMonthlyPayrollSummary(monthlySummary)

      const totalGross = employeeDetails.reduce((sum, record) => sum + (record.gross_pay || record.basic_salary || 0), 0)
      const totalAllowances = employeeDetails.reduce((sum, record) => sum + record.allowances, 0)
      const totalDeductions = employeeDetails.reduce(
        (sum, record) => sum + record.total_deductions + (record.cash_advance || 0),
        0
      )
      const totalNetPay = employeeDetails.reduce(
        (sum, record) => sum + (record.net_pay - (record.cash_advance || 0)),
        0
      )

      const netAfterDeductions = totalGross - totalDeductions

      setPayrollSummary({
        totalGross,
        totalDeductions,
        netAfterDeductions,
        totalAllowances,
        totalNetPay
      })

      setDeductions(
        (deductionRecords || []).map((d: any) => ({
          id: d.id,
          employee_name: d.employees?.full_name || 'Unknown',
          type: d.type,
          amount: d.amount,
          created_at: d.created_at,
        }))
      )

      const { data: expenseRecords, error: expenseError } = await supabase
        .from("company_expenses")
        .select("*")
        .order("incurred_on", { ascending: false })

      if (expenseError) {
        console.error("Error fetching expenses:", expenseError)
      } else {
        setExpenses(
          (expenseRecords || []).map((e: any) => ({
            id: e.id,
            expense_name: e.expense_name,
            category: e.category,
            amount: e.amount,
            incurred_on: e.incurred_on,
          }))
        )
      }

    } catch (error) {
      console.error("Error in fetchReports:", error)
    }
  }

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    employee_id: false,
    full_name: true,
    pay_type: false,
    period: true,
    basic_salary: true,
    allowances: true,
    overtime: true,
    holiday_pay: true,
    gross_pay: true,
    absences: true,
    cash_advance: true,
    total_deductions: true,
    net_pay: true,
    status: true,
  })

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

  const columnLabels: Record<string, string> = {
    employee_id: "Employee ID",
    full_name: "Full Name",
    pay_type: "Pay Type",
    period: "Period",
    basic_salary: "Basic Salary",
    allowances: "Allowances",
    overtime: "Overtime",
    holiday_pay: "Holiday Pay",
    gross_pay: "Gross Pay",
    absences: "Absences",
    cash_advance: "Cash Advance",
    total_deductions: "Total Deductions",
    net_pay: "Net Pay",
    status: "Status",
  }

  // Pagination Logic
  const totalPages = Math.ceil(employeePayrollDetails.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedDetails = employeePayrollDetails.slice(startIndex, startIndex + pageSize)

  // Calculate additional metrics
  const additionalMetrics = {
    totalEmployees: new Set(employeePayrollDetails.map(emp => emp.employee_id)).size,
    totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    totalRecords: employeePayrollDetails.length,
    averageGrossPay: employeePayrollDetails.length > 0 ? payrollSummary.totalGross / employeePayrollDetails.length : 0,
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background text-foreground">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground">Comprehensive payroll and financial reporting dashboard</p>
      </div>

      {/* Primary Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Gross Payroll</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">₱{payrollSummary.totalGross.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Allowances</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">₱{payrollSummary.totalAllowances.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Deductions</p>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">₱{payrollSummary.totalDeductions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Net Pay</p>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">₱{payrollSummary.totalNetPay.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                <div className="text-lg font-bold text-foreground">{additionalMetrics.totalEmployees}</div>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <div className="text-lg font-bold text-foreground">₱{additionalMetrics.totalExpenses.toLocaleString()}</div>
              </div>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payroll Records</p>
                <div className="text-lg font-bold text-foreground">{additionalMetrics.totalRecords}</div>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Gross Pay</p>
                <div className="text-lg font-bold text-foreground">₱{additionalMetrics.averageGrossPay.toLocaleString()}</div>
              </div>
              <PieChart className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="employee-details" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employee-details" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee Details
          </TabsTrigger>
          <TabsTrigger value="monthly-payroll" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Monthly Payroll
          </TabsTrigger>
          <TabsTrigger value="deductions" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Deductions
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Expenses
          </TabsTrigger>
        </TabsList>

        {/* Employee Details Tab */}
        <TabsContent value="employee-details">
          <Card className="border border-border shadow-sm bg-card overflow-hidden">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-foreground">Employee Payroll Details</h3>
                  <p className="text-muted-foreground">Detailed breakdown of employee payroll records</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Column Visibility Toggle */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 transition-transform group-hover:rotate-12" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {Object.keys(visibleColumns).map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col}
                          checked={visibleColumns[col]}
                          onCheckedChange={() => toggleColumn(col)}
                        >
                          {columnLabels[col]}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    onClick={exportToExcel}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export to Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {employeePayrollDetails.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No payroll data available</h3>
                  <p className="text-muted-foreground">Generate payroll records to see detailed reports</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-200">
                          {visibleColumns.employee_id && <TableHead className="text-center font-medium text-slate-900">Employee ID</TableHead>}
                          {visibleColumns.full_name && <TableHead className="text-center font-medium text-slate-900">Full Name</TableHead>}
                          {visibleColumns.pay_type && <TableHead className="text-center font-medium text-slate-900">Pay Type</TableHead>}
                          {visibleColumns.period && <TableHead className="text-center font-medium text-slate-900">Period</TableHead>}
                          {visibleColumns.basic_salary && <TableHead className="text-center font-medium text-slate-900">Basic Salary</TableHead>}
                          {visibleColumns.allowances && <TableHead className="text-center font-medium text-slate-900">Allowances</TableHead>}
                          {visibleColumns.overtime && <TableHead className="text-center font-medium text-slate-900">Overtime</TableHead>}
                          {visibleColumns.holiday_pay && <TableHead className="text-center font-medium text-slate-900">Holiday Pay</TableHead>}
                          {visibleColumns.gross_pay && <TableHead className="text-center font-medium text-slate-900">Gross Pay</TableHead>}
                          {visibleColumns.absences && <TableHead className="text-center font-medium text-slate-900">Absences</TableHead>}
                          {visibleColumns.cash_advance && <TableHead className="text-center font-medium text-slate-900">Cash Advance</TableHead>}
                          {visibleColumns.total_deductions && <TableHead className="text-center font-medium text-slate-900">Total Deductions</TableHead>}
                          {visibleColumns.net_pay && <TableHead className="text-center font-medium text-slate-900">Net Pay</TableHead>}
                          {visibleColumns.status && <TableHead className="text-center font-medium text-slate-900">Status</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDetails.map((emp) => (
                          <TableRow key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            {visibleColumns.employee_id && <TableCell className="py-4 text-center font-medium text-slate-900">{emp.employee_code}</TableCell>}
                            {visibleColumns.full_name && <TableCell className="py-4 text-center font-medium text-slate-900">{emp.full_name}</TableCell>}
                            {visibleColumns.pay_type && <TableCell className="py-4 text-center text-slate-600">{emp.pay_type}</TableCell>}
                            {visibleColumns.period && (
                              <TableCell className="py-4 text-center text-sm text-slate-600">
                                {new Date(emp.period_start).toLocaleDateString()} - {new Date(emp.period_end).toLocaleDateString()}
                              </TableCell>
                            )}
                            {visibleColumns.basic_salary && <TableCell className="py-4 text-center text-slate-900">₱{emp.basic_salary.toLocaleString()}</TableCell>}
                            {visibleColumns.allowances && <TableCell className="py-4 text-center text-slate-900">₱{emp.allowances.toLocaleString()}</TableCell>}
                            {visibleColumns.overtime && <TableCell className="py-4 text-center text-slate-900">₱{emp.overtime_pay.toLocaleString()}</TableCell>}
                            {visibleColumns.holiday_pay && <TableCell className="py-4 text-center text-slate-900">₱{emp.holiday_pay.toLocaleString()}</TableCell>}
                            {visibleColumns.gross_pay && <TableCell className="py-4 text-center text-slate-900">₱{(emp.gross_pay || emp.basic_salary).toLocaleString()}</TableCell>}
                            {visibleColumns.absences && <TableCell className="py-4 text-center text-slate-900">₱{emp.absences.toLocaleString()}</TableCell>}
                            {visibleColumns.cash_advance && <TableCell className="py-4 text-center text-slate-900">₱{emp.cash_advance.toLocaleString()}</TableCell>}
                            {visibleColumns.total_deductions && <TableCell className="py-4 text-center text-slate-900">₱{emp.total_deductions.toLocaleString()}</TableCell>}
                            {visibleColumns.net_pay && <TableCell className="py-4 text-center font-bold text-slate-900">₱{(emp.net_pay + emp.allowances).toLocaleString()}</TableCell>}
                            {visibleColumns.status && (
                              <TableCell className="py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusVariants[emp.status] || "bg-slate-100 text-slate-600 border-slate-200"

                                  }`}>
                                  {emp.status}
                                </span>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                      <p className="text-sm text-slate-500">
                        Showing <span className="font-medium text-slate-700">{startIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startIndex + pageSize, employeePayrollDetails.length)}</span> of <span className="font-medium text-slate-700">{employeePayrollDetails.length}</span> results
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={`h-8 w-8 p-0 ${currentPage === pageNum ? "bg-slate-900" : ""}`}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Payroll Tab */}
        <TabsContent value="monthly-payroll">
          <Card className="border border-border shadow-sm bg-card overflow-hidden">
            <CardHeader>
              <div>
                <h3 className="text-lg font-medium text-foreground">Monthly Payroll Summary</h3>
                <p className="text-muted-foreground">Payroll breakdown organized by month</p>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyPayrollSummary.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No monthly data available</h3>
                  <p className="text-muted-foreground">Generate payroll records to see monthly summaries</p>
                </div>
              ) : (() => {
                const totalMonthlyPages = Math.ceil(monthlyPayrollSummary.length / pageSize);
                const startMonthlyIndex = (currentMonthlyPage - 1) * pageSize;
                const paginatedMonthlySummary = monthlyPayrollSummary.slice(startMonthlyIndex, startMonthlyIndex + pageSize);

                return (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-200">
                            <TableHead className="text-center font-medium text-slate-900">Month</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Total Employees</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Payroll Records</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Gross Pay</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Allowances</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Deductions</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Net Pay (incl. Allowances)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedMonthlySummary.map((summary) => (
                            <TableRow key={`${summary.year}-${summary.month}`} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <TableCell className="py-4 text-center font-medium text-slate-900">{summary.monthYear}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">{summary.totalEmployees}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">{summary.recordCount}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{summary.totalGrossPay.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{summary.totalAllowances.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{summary.totalDeductions.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center font-bold text-slate-900">₱{summary.totalNetPay.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                          {monthlyPayrollSummary.length > 1 && currentMonthlyPage === totalMonthlyPages && (
                            <TableRow className="border-t-2 border-slate-300 font-bold bg-slate-50">
                              <TableCell className="py-4 text-center text-slate-900">Total</TableCell>
                              <TableCell className="py-4 text-center text-slate-500">—</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                {monthlyPayrollSummary.reduce((sum, s) => sum + s.recordCount, 0)}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalGrossPay, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalAllowances, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalDeductions, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalNetPay, 0).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalMonthlyPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-sm text-slate-500">
                          Showing <span className="font-medium text-slate-700">{startMonthlyIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startMonthlyIndex + pageSize, monthlyPayrollSummary.length)}</span> of <span className="font-medium text-slate-700">{monthlyPayrollSummary.length}</span> results
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentMonthlyPage(prev => Math.max(1, prev - 1))}
                            disabled={currentMonthlyPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalMonthlyPages) }, (_, i) => {
                              let pageNum;
                              if (totalMonthlyPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentMonthlyPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentMonthlyPage >= totalMonthlyPages - 2) {
                                pageNum = totalMonthlyPages - 4 + i;
                              } else {
                                pageNum = currentMonthlyPage - 2 + i;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentMonthlyPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentMonthlyPage(pageNum)}
                                  className={`h-8 w-8 p-0 ${currentMonthlyPage === pageNum ? "bg-slate-900 text-white" : ""}`}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentMonthlyPage(prev => Math.min(totalMonthlyPages, prev + 1))}
                            disabled={currentMonthlyPage === totalMonthlyPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div>
                <h3 className="text-lg font-medium text-foreground">Employee Deductions (Detailed)</h3>
                <p className="text-muted-foreground">Breakdown of all deduction types by employee</p>
              </div>
            </CardHeader>
            <CardContent>
              {employeePayrollDetails.length === 0 ? (
                <div className="text-center py-12">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No deduction records found</h3>
                  <p className="text-muted-foreground">Add employee deductions to see detailed reports</p>
                </div>
              ) : (() => {
                const totalDeductionsPages = Math.ceil(employeePayrollDetails.length / pageSize);
                const startDeductionsIndex = (currentDeductionsPage - 1) * pageSize;
                const paginatedDeductionsDetails = employeePayrollDetails.slice(startDeductionsIndex, startDeductionsIndex + pageSize);

                return (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-200">
                            <TableHead className="text-center font-medium text-slate-900">Employee</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">SSS</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">PhilHealth</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Pag-IBIG</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Withholding Tax</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Loans</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Uniform</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Tardiness</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Cash Advance</TableHead>
                            <TableHead className="text-center font-medium text-slate-900">Total</TableHead>

                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedDeductionsDetails.map(emp => (
                            <TableRow key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <TableCell className="py-4 text-center font-medium text-slate-900">{emp.full_name}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.sss.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.philhealth.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.pagibig.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.withholding_tax.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.loans.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.uniform.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.tardiness.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">₱{emp.cash_advance.toLocaleString()}</TableCell>
                              <TableCell className="py-4 text-center font-bold text-slate-900">
                                ₱{(emp.total_deductions + emp.cash_advance).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalDeductionsPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-sm text-slate-500">
                          Showing <span className="font-medium text-slate-700">{startDeductionsIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startDeductionsIndex + pageSize, employeePayrollDetails.length)}</span> of <span className="font-medium text-slate-700">{employeePayrollDetails.length}</span> results
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDeductionsPage(prev => Math.max(1, prev - 1))}
                            disabled={currentDeductionsPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalDeductionsPages) }, (_, i) => {
                              let pageNum;
                              if (totalDeductionsPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentDeductionsPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentDeductionsPage >= totalDeductionsPages - 2) {
                                pageNum = totalDeductionsPages - 4 + i;
                              } else {
                                pageNum = currentDeductionsPage - 2 + i;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentDeductionsPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentDeductionsPage(pageNum)}
                                  className={`h-8 w-8 p-0 ${currentDeductionsPage === pageNum ? "bg-slate-900 text-white" : ""}`}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDeductionsPage(prev => Math.min(totalDeductionsPages, prev + 1))}
                            disabled={currentDeductionsPage === totalDeductionsPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card className="border border-border shadow-sm bg-card overflow-hidden">
            <CardHeader>
              <div>
                <h3 className="text-lg font-medium text-foreground">Company Expenses</h3>
                <p className="text-muted-foreground">Overview of company operational expenses</p>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No expense records found</h3>
                  <p className="text-muted-foreground">Add company expenses to see financial reports</p>
                </div>
              ) : (() => {
                const totalExpensesPages = Math.ceil(expenses.length / pageSize);
                const startExpensesIndex = (currentExpensesPage - 1) * pageSize;
                const paginatedExpenses = expenses.slice(startExpensesIndex, startExpensesIndex + pageSize);

                return (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="text-center font-medium text-slate-900">Date</TableHead>
                          <TableHead className="text-center font-medium text-slate-900">Name</TableHead>
                          <TableHead className="text-center font-medium text-slate-900">Category</TableHead>
                          <TableHead className="text-center font-medium text-slate-900">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedExpenses.map((e) => (
                          <TableRow key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <TableCell className="py-4 text-center text-slate-900">{new Date(e.incurred_on).toLocaleDateString()}</TableCell>
                            <TableCell className="py-4 text-center font-medium text-slate-900">{e.expense_name}</TableCell>
                            <TableCell className="py-4 text-center text-slate-600">{e.category}</TableCell>
                            <TableCell className="py-4 text-center font-medium text-slate-900">₱{e.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination Controls */}
                    {totalExpensesPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-sm text-slate-500">
                          Showing <span className="font-medium text-slate-700">{startExpensesIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startExpensesIndex + pageSize, expenses.length)}</span> of <span className="font-medium text-slate-700">{expenses.length}</span> results
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentExpensesPage(prev => Math.max(1, prev - 1))}
                            disabled={currentExpensesPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalExpensesPages) }, (_, i) => {
                              let pageNum;
                              if (totalExpensesPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentExpensesPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentExpensesPage >= totalExpensesPages - 2) {
                                pageNum = totalExpensesPages - 4 + i;
                              } else {
                                pageNum = currentExpensesPage - 2 + i;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentExpensesPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentExpensesPage(pageNum)}
                                  className={`h-8 w-8 p-0 ${currentExpensesPage === pageNum ? "bg-slate-900 text-white" : ""}`}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentExpensesPage(prev => Math.min(totalExpensesPages, prev + 1))}
                            disabled={currentExpensesPage === totalExpensesPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}