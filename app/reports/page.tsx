"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"

// Note: You'll need to install xlsx: npm install xlsx
// For now, we'll use a browser-compatible approach
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

  // Load XLSX library dynamically
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

    // Prepare data for Excel export
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
      'Total Deductions': emp.total_deductions,
      'Net Pay': emp.net_pay,
      'Status': emp.status,
      'Month/Year': emp.month_year
    }))

    // Create workbook and worksheet
    const wb = window.XLSX.utils.book_new()
    const ws = window.XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    ws['!cols'] = [
      { width: 15 }, // Employee ID
      { width: 15 }, // Employee Code
      { width: 25 }, // Full Name
      { width: 12 }, // Pay Type
      { width: 15 }, // Period Start
      { width: 15 }, // Period End
      { width: 18 }, // Basic Salary
      { width: 15 }, // Allowances
      { width: 15 }, // Overtime Pay
      { width: 15 }, // Holiday Pay
      { width: 15 }, // Gross Pay
      { width: 12 }, // Absences
      { width: 18 }, // Total Deductions
      { width: 15 }, // Net Pay
      { width: 12 }, // Status
      { width: 15 }  // Month/Year
    ]

    // Add worksheet to workbook
    window.XLSX.utils.book_append_sheet(wb, ws, "Employee Payroll Details")

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]
    const filename = `Employee_Payroll_Report_${currentDate}.xlsx`

    // Write file
    window.XLSX.writeFile(wb, filename)
  }

  async function fetchReports() {
    try {
      // Fetch payroll records with employee details
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
          total_deductions,
          net_pay,
          status,
          employees(id, employee_code, full_name, pay_type)
        `)
        .order("period_end", { ascending: false })

      if (payrollError) {
        console.error("Error fetching payroll records:", payrollError)
        return
      }

      // Fetch deductions separately
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

      // Process employee payroll details
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
          status: record.status || 'Unknown'
        }
      })

      setEmployeePayrollDetails(employeeDetails)

      // Process monthly payroll summary
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
        monthlyData.totalDeductions += record.total_deductions
        monthlyData.totalNetPay += record.net_pay
        monthlyData.totalAllowances += record.allowances

        // Count unique employees for this month
        const uniqueEmployees = new Set<string>()
        employeeDetails.forEach((emp) => {
          const empEndDate = new Date(emp.period_end)
          if (empEndDate.getFullYear() === year && empEndDate.getMonth() === periodEndDate.getMonth()) {
            uniqueEmployees.add(emp.employee_id)
          }
        })
        monthlyData.totalEmployees = uniqueEmployees.size
      })

      // Convert to array and sort by year and month (most recent first)
      const monthlySummary = Array.from(monthlyMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month.localeCompare(a.month)
      })

      setMonthlyPayrollSummary(monthlySummary)

      // Compute overall payroll summary
      const totalGross = employeeDetails.reduce((sum, record) => sum + (record.gross_pay || record.basic_salary || 0), 0)
      const totalDeductions = employeeDetails.reduce((sum, record) => sum + record.total_deductions, 0)
      const totalAllowances = employeeDetails.reduce((sum, record) => sum + record.allowances, 0)
      const totalNetPay = employeeDetails.reduce((sum, record) => sum + record.net_pay, 0)
      const netAfterDeductions = totalGross - totalDeductions

      setPayrollSummary({ 
        totalGross, 
        totalDeductions, 
        netAfterDeductions,
        totalAllowances,
        totalNetPay
      })

      // Process deductions
      setDeductions(
        (deductionRecords || []).map((d: any) => ({
          id: d.id,
          employee_name: d.employees?.full_name || 'Unknown',
          type: d.type,
          amount: d.amount,
          created_at: d.created_at,
        }))
      )

      // Fetch expenses
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Gross Payroll</p>
            <h2 className="text-xl font-bold">₱ {payrollSummary.totalGross.toLocaleString()}</h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Allowances</p>
            <h2 className="text-xl font-bold">₱ {payrollSummary.totalAllowances.toLocaleString()}</h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Deductions</p>
            <h2 className="text-xl font-bold">₱ {payrollSummary.totalDeductions.toLocaleString()}</h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Net Pay</p>
            <h2 className="text-xl font-bold">₱ {payrollSummary.totalNetPay.toLocaleString()}</h2>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for details */}
      <Tabs defaultValue="employee-details">
        <TabsList>
          <TabsTrigger value="employee-details">Employee Details</TabsTrigger>
          <TabsTrigger value="monthly-payroll">Monthly Payroll</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Employee Details Tab */}
        <TabsContent value="employee-details">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Employee Payroll Details</h3>
                <Button onClick={exportToExcel} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export to Excel
                </Button>
              </div>
              {employeePayrollDetails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No employee payroll data available.</p>
                  <p className="text-sm">Generate some payroll records to see reports.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Pay Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Basic Salary</TableHead>
                        <TableHead>Allowances</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Holiday Pay</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Absences</TableHead>
                        <TableHead>Total Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeePayrollDetails.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.employee_id}</TableCell>
                          <TableCell>{emp.full_name}</TableCell>
                          <TableCell>{emp.pay_type}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(emp.period_start).toLocaleDateString()} - {new Date(emp.period_end).toLocaleDateString()}
                          </TableCell>
                          <TableCell>₱ {emp.basic_salary.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.allowances.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.overtime_pay.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.holiday_pay.toLocaleString()}</TableCell>
                          <TableCell>₱ {(emp.gross_pay || emp.basic_salary).toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.absences.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.total_deductions.toLocaleString()}</TableCell>
                          <TableCell className="font-bold">₱ {emp.net_pay.toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              emp.status === 'Paid' 
                                ? 'bg-green-100 text-green-800' 
                                : emp.status === 'Pending Payment'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {emp.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Payroll Tab */}
        <TabsContent value="monthly-payroll">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payroll Summary by Month</h3>
              {monthlyPayrollSummary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No payroll data available.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Total Employees</TableHead>
                      <TableHead>Payroll Records</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyPayrollSummary.map((summary) => (
                      <TableRow key={`${summary.year}-${summary.month}`}>
                        <TableCell className="font-medium">{summary.monthYear}</TableCell>
                        <TableCell>{summary.totalEmployees}</TableCell>
                        <TableCell>{summary.recordCount}</TableCell>
                        <TableCell>₱ {summary.totalGrossPay.toLocaleString()}</TableCell>
                        <TableCell>₱ {summary.totalAllowances.toLocaleString()}</TableCell>
                        <TableCell>₱ {summary.totalDeductions.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">₱ {summary.totalNetPay.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {monthlyPayrollSummary.length > 1 && (
                      <TableRow className="border-t-2 font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          {monthlyPayrollSummary.reduce((sum, s) => sum + s.recordCount, 0)}
                        </TableCell>
                        <TableCell>
                          ₱ {monthlyPayrollSummary.reduce((sum, s) => sum + s.totalGrossPay, 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          ₱ {monthlyPayrollSummary.reduce((sum, s) => sum + s.totalAllowances, 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          ₱ {monthlyPayrollSummary.reduce((sum, s) => sum + s.totalDeductions, 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          ₱ {monthlyPayrollSummary.reduce((sum, s) => sum + s.totalNetPay, 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Employee Deductions</h3>
              {deductions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No deduction records found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductions.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{d.employee_name}</TableCell>
                        <TableCell>{d.type}</TableCell>
                        <TableCell>₱ {d.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Company Expenses</h3>
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No expense records found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.incurred_on).toLocaleDateString()}</TableCell>
                        <TableCell>{e.expense_name}</TableCell>
                        <TableCell>{e.category}</TableCell>
                        <TableCell>₱ {e.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}