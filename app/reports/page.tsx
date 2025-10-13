"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Download, DollarSign, Users, TrendingUp, Calculator, FileText, Calendar, Building2, PieChart, BarChart3 } from "lucide-react"
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
  "Paid": "bg-slate-900 text-white border-slate-200",
  "Pending Payment": "bg-white text-slate-900 border-slate-300",
  "Cancelled": "bg-slate-100 text-slate-600 border-slate-200",
}

export default function ReportsPage() {
  useProtectedPage(["admin", "hr"])
  
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

  useEffect(() => {
    fetchReports()
    loadXLSXLibrary()
  }, [])

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

  // Calculate additional metrics
  const additionalMetrics = {
    totalEmployees: new Set(employeePayrollDetails.map(emp => emp.employee_id)).size,
    totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    totalRecords: employeePayrollDetails.length,
    averageGrossPay: employeePayrollDetails.length > 0 ? payrollSummary.totalGross / employeePayrollDetails.length : 0,
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-600">Comprehensive payroll and financial reporting dashboard</p>
      </div>

      {/* Primary Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Total Gross Payroll</p>
              <DollarSign className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">₱{payrollSummary.totalGross.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Total Allowances</p>
              <TrendingUp className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">₱{payrollSummary.totalAllowances.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Total Deductions</p>
              <Calculator className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">₱{payrollSummary.totalDeductions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Total Net Pay</p>
              <FileText className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">₱{payrollSummary.totalNetPay.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Employees</p>
                <div className="text-lg font-bold text-slate-900">{additionalMetrics.totalEmployees}</div>
              </div>
              <Users className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Expenses</p>
                <div className="text-lg font-bold text-slate-900">₱{additionalMetrics.totalExpenses.toLocaleString()}</div>
              </div>
              <Building2 className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Payroll Records</p>
                <div className="text-lg font-bold text-slate-900">{additionalMetrics.totalRecords}</div>
              </div>
              <BarChart3 className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Avg. Gross Pay</p>
                <div className="text-lg font-bold text-slate-900">₱{additionalMetrics.averageGrossPay.toLocaleString()}</div>
              </div>
              <PieChart className="h-5 w-5 text-slate-500" />
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
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">Employee Payroll Details</h3>
                  <p className="text-slate-600">Detailed breakdown of employee payroll records</p>
                </div>
                <Button 
                  onClick={exportToExcel} 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export to Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {employeePayrollDetails.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No payroll data available</h3>
                  <p className="text-slate-600">Generate payroll records to see detailed reports</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="font-medium text-slate-900">Employee ID</TableHead>
                          <TableHead className="font-medium text-slate-900">Full Name</TableHead>
                          <TableHead className="font-medium text-slate-900">Pay Type</TableHead>
                          <TableHead className="font-medium text-slate-900">Period</TableHead>
                          <TableHead className="font-medium text-slate-900">Basic Salary</TableHead>
                          <TableHead className="font-medium text-slate-900">Allowances</TableHead>
                          <TableHead className="font-medium text-slate-900">Overtime</TableHead>
                          <TableHead className="font-medium text-slate-900">Holiday Pay</TableHead>
                          <TableHead className="font-medium text-slate-900">Gross Pay</TableHead>
                          <TableHead className="font-medium text-slate-900">Absences</TableHead>
                          <TableHead className="font-medium text-slate-900">Cash Advance</TableHead>
                          <TableHead className="font-medium text-slate-900">Total Deductions</TableHead>
                          <TableHead className="font-medium text-slate-900">Net Pay</TableHead>
                          <TableHead className="font-medium text-slate-900">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeePayrollDetails.map((emp) => (
                          <TableRow key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <TableCell className="font-medium text-slate-900">{emp.employee_code}</TableCell>
                            <TableCell className="font-medium text-slate-900">{emp.full_name}</TableCell>
                            <TableCell className="text-slate-600">{emp.pay_type}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(emp.period_start).toLocaleDateString()} - {new Date(emp.period_end).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-slate-900">₱{emp.basic_salary.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.allowances.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.overtime_pay.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.holiday_pay.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{(emp.gross_pay || emp.basic_salary).toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.absences.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.cash_advance.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.total_deductions.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-slate-900">₱{(emp.net_pay + emp.allowances).toLocaleString()}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                statusVariants[emp.status] || "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                {emp.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Payroll Tab */}
        <TabsContent value="monthly-payroll">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div>
                <h3 className="text-lg font-medium text-slate-900">Monthly Payroll Summary</h3>
                <p className="text-slate-600">Payroll breakdown organized by month</p>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyPayrollSummary.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No monthly data available</h3>
                  <p className="text-slate-600">Generate payroll records to see monthly summaries</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="font-medium text-slate-900">Month</TableHead>
                        <TableHead className="font-medium text-slate-900">Total Employees</TableHead>
                        <TableHead className="font-medium text-slate-900">Payroll Records</TableHead>
                        <TableHead className="font-medium text-slate-900">Gross Pay</TableHead>
                        <TableHead className="font-medium text-slate-900">Allowances</TableHead>
                        <TableHead className="font-medium text-slate-900">Deductions</TableHead>
                        <TableHead className="font-medium text-slate-900">Net Pay (incl. Allowances)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyPayrollSummary.map((summary) => (
                        <TableRow key={`${summary.year}-${summary.month}`} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <TableCell className="font-medium text-slate-900">{summary.monthYear}</TableCell>
                          <TableCell className="text-slate-900">{summary.totalEmployees}</TableCell>
                          <TableCell className="text-slate-900">{summary.recordCount}</TableCell>
                          <TableCell className="text-slate-900">₱{summary.totalGrossPay.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-900">₱{summary.totalAllowances.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-900">₱{summary.totalDeductions.toLocaleString()}</TableCell>
                          <TableCell className="font-bold text-slate-900">₱{summary.totalNetPay.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {monthlyPayrollSummary.length > 1 && (
                        <TableRow className="border-t-2 border-slate-300 font-bold bg-slate-50">
                          <TableCell className="text-slate-900">Total</TableCell>
                          <TableCell className="text-slate-500">—</TableCell>
                          <TableCell className="text-slate-900">
                            {monthlyPayrollSummary.reduce((sum, s) => sum + s.recordCount, 0)}
                          </TableCell>
                          <TableCell className="text-slate-900">
                            ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalGrossPay, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-900">
                            ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalAllowances, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-900">
                            ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalDeductions, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-900">
                            ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalNetPay, 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div>
                <h3 className="text-lg font-medium text-slate-900">Employee Deductions (Detailed)</h3>
                <p className="text-slate-600">Breakdown of all deduction types by employee</p>
              </div>
            </CardHeader>
            <CardContent>
              {employeePayrollDetails.length === 0 ? (
                <div className="text-center py-12">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No deduction records found</h3>
                  <p className="text-slate-600">Add employee deductions to see detailed reports</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="font-medium text-slate-900">Employee</TableHead>
                          <TableHead className="font-medium text-slate-900">SSS</TableHead>
                          <TableHead className="font-medium text-slate-900">PhilHealth</TableHead>
                          <TableHead className="font-medium text-slate-900">Pag-IBIG</TableHead>
                          <TableHead className="font-medium text-slate-900">Withholding Tax</TableHead>
                          <TableHead className="font-medium text-slate-900">Loans</TableHead>
                          <TableHead className="font-medium text-slate-900">Uniform</TableHead>
                          <TableHead className="font-medium text-slate-900">Tardiness</TableHead>
                          <TableHead className="font-medium text-slate-900">Cash Advance</TableHead>
                          <TableHead className="font-medium text-slate-900">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeePayrollDetails.map(emp => (
                          <TableRow key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <TableCell className="font-medium text-slate-900">{emp.full_name}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.sss.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.philhealth.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.pagibig.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.withholding_tax.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.loans.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.uniform.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.tardiness.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-900">₱{emp.cash_advance.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-slate-900">
                              ₱{(emp.total_deductions + emp.cash_advance).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div>
                <h3 className="text-lg font-medium text-slate-900">Company Expenses</h3>
                <p className="text-slate-600">Overview of company operational expenses</p>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No expense records found</h3>
                  <p className="text-slate-600">Add company expenses to see financial reports</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="font-medium text-slate-900">Date</TableHead>
                        <TableHead className="font-medium text-slate-900">Name</TableHead>
                        <TableHead className="font-medium text-slate-900">Category</TableHead>
                        <TableHead className="font-medium text-slate-900">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((e) => (
                        <TableRow key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <TableCell className="text-slate-900">{new Date(e.incurred_on).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-slate-900">{e.expense_name}</TableCell>
                          <TableCell className="text-slate-600">{e.category}</TableCell>
                          <TableCell className="font-medium text-slate-900">₱{e.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}