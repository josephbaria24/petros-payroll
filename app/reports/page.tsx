"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useProtectedPage } from "../hooks/useProtectedPage"

type PayrollSummary = {
  totalGross: number
  totalDeductions: number
  netAfterDeductions: number
}

type MonthlyPayrollSummary = {
  month: string
  year: number
  monthYear: string
  totalEmployees: number
  totalGrossPay: number
  totalDeductions: number
  totalNetPay: number
  recordCount: number
}
type EmployeePayrollDetail = {
  employee_id: string
  full_name: string
  basic_monthly_salary: number
  monthly_allowance: number
  overtime_total: number
  sss_deduction: number
  philhealth_deduction: number
  hdmf_deduction: number
  other_deductions: number
  total_deductions: number
  net_pay: number
  month_year: string
}


type Deduction = {
  id: string
  employee_name: string
  type: string
  amount: number
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
  })
  const [monthlyPayrollSummary, setMonthlyPayrollSummary] = useState<MonthlyPayrollSummary[]>([])
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [employeePayrollDetails, setEmployeePayrollDetails] = useState<EmployeePayrollDetail[]>([])

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    // Employee Payroll Details
const { data: employeeRecords, error: empError } = await supabase
.from("payroll_records")
.select(`
  id,
  employee_id,
  basic_salary,
  allowances,
  overtime_pay,
  sss,
  philhealth,
  pagibig,
  loans,
  uniform,
  tardiness,
  absences,
  total_deductions,
  net_pay,
  period_end,
  employees(full_name)
`)

if (empError) {
console.error("Error fetching employee payroll details:", empError)
} else {
const details: EmployeePayrollDetail[] = (employeeRecords || []).map((rec: any) => {
  const periodDate = new Date(rec.period_end)
  const monthYear = `${periodDate.toLocaleString("default", { month: "long" })} ${periodDate.getFullYear()}`

  return {
    employee_id: rec.employee_id,
    full_name: rec.employees?.full_name || "Unknown",
    basic_monthly_salary: rec.basic_salary || 0,
    monthly_allowance: rec.allowances || 0,
    overtime_total: rec.overtime_pay || 0,
    sss_deduction: rec.sss || 0,
    philhealth_deduction: rec.philhealth || 0,
    hdmf_deduction: rec.pagibig || 0,
    other_deductions: (rec.loans || 0) + (rec.uniform || 0) + (rec.tardiness || 0) + (rec.absences || 0),
    total_deductions: rec.total_deductions || 0,
    net_pay: rec.net_pay || 0,
    month_year: monthYear,
  }
})

setEmployeePayrollDetails(details)
}

    // Payroll records
    const { data: payroll, error: pError } = await supabase
      .from("payroll_records")
      .select("id, employee_id, net_pay, period_start, period_end, employees(full_name, pay_type)")
    if (pError) console.error(pError)

    // Deductions
    const { data: deds, error: dError } = await supabase
      .from("deductions")
      .select("id, employee_id, type, amount, created_at, employees(full_name)")
    if (dError) console.error(dError)

    // Expenses
    const { data: exps, error: eError } = await supabase
      .from("company_expenses")
      .select("*")
      .order("incurred_on", { ascending: false })
    if (eError) console.error(eError)

    // Process monthly payroll summary
    if (payroll) {
      const monthlyMap = new Map<string, MonthlyPayrollSummary>()

      // Process each payroll record
      payroll.forEach((record: any) => {
        const periodEndDate = new Date(record.period_end)
        const month = periodEndDate.toLocaleDateString('en-US', { month: 'long' })
        const year = periodEndDate.getFullYear()
        const monthYearKey = `${year}-${String(periodEndDate.getMonth() + 1).padStart(2, '0')}`
        const monthYear = `${month} ${year}`

        // Calculate deductions for this employee in this period
        const employeeDeductions = deds?.filter((d: any) => 
          d.employee_id === record.employee_id &&
          d.created_at >= record.period_start &&
          d.created_at <= record.period_end
        ).reduce((sum, d) => sum + d.amount, 0) || 0

        if (!monthlyMap.has(monthYearKey)) {
          monthlyMap.set(monthYearKey, {
            month,
            year,
            monthYear,
            totalEmployees: 0,
            totalGrossPay: 0,
            totalDeductions: 0,
            totalNetPay: 0,
            recordCount: 0
          })
        }

        const monthlyData = monthlyMap.get(monthYearKey)!
        monthlyData.recordCount += 1
        monthlyData.totalGrossPay += record.net_pay
        monthlyData.totalDeductions += employeeDeductions
        monthlyData.totalNetPay += (record.net_pay - employeeDeductions)
        
        // Count unique employees
        const uniqueEmployees = new Set()
        payroll.forEach((p: any) => {
          const pEndDate = new Date(p.period_end)
          if (pEndDate.getFullYear() === year && pEndDate.getMonth() === periodEndDate.getMonth()) {
            uniqueEmployees.add(p.employee_id)
          }
        })
        monthlyData.totalEmployees = uniqueEmployees.size
      })

      // Convert to array and sort by year and month (most recent first)
      const monthlySummary = Array.from(monthlyMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth()
      })

      setMonthlyPayrollSummary(monthlySummary)
    }

    // Compute overall totals
    const totalGross = payroll?.reduce((sum, p) => sum + p.net_pay, 0) || 0
    const totalDeductions = deds?.reduce((sum, d) => sum + d.amount, 0) || 0
    const netAfterDeductions = totalGross - totalDeductions

    setPayrollSummary({ totalGross, totalDeductions, netAfterDeductions })

    setDeductions(
      deds?.map((d: any) => ({
        id: d.id,
        employee_name: d.employees?.full_name,
        type: d.type,
        amount: d.amount,
      })) || []
    )

    setExpenses(
      exps?.map((e: any) => ({
        id: e.id,
        expense_name: e.expense_name,
        category: e.category,
        amount: e.amount,
        incurred_on: e.incurred_on,
      })) || []
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Gross Payroll</p>
            <h2 className="text-xl font-bold">₱ {payrollSummary.totalGross.toLocaleString()}</h2>
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
            <p className="text-sm text-muted-foreground">Net After Deductions</p>
            <h2 className="text-xl font-bold">₱ {payrollSummary.netAfterDeductions.toLocaleString()}</h2>
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
              <h3 className="text-lg font-semibold mb-4">Employee Payroll Details</h3>
              {employeePayrollDetails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No employee payroll data available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Basic Monthly Salary</TableHead>
                        <TableHead>Monthly Allowance</TableHead>
                        <TableHead>OT Total</TableHead>
                        <TableHead>SSS</TableHead>
                        <TableHead>PhilHealth</TableHead>
                        <TableHead>HDMF</TableHead>
                        <TableHead>Other Deductions</TableHead>
                        <TableHead>Total Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Month/Year</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeePayrollDetails.map((emp, index) => (
                        <TableRow key={`${emp.employee_id}-${emp.month_year}-${index}`}>
                          <TableCell className="font-medium">{emp.employee_id}</TableCell>
                          <TableCell>{emp.full_name}</TableCell>
                          <TableCell>₱ {emp.basic_monthly_salary.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.monthly_allowance.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.overtime_total.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.sss_deduction.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.philhealth_deduction.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.hdmf_deduction.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.other_deductions.toLocaleString()}</TableCell>
                          <TableCell>₱ {emp.total_deductions.toLocaleString()}</TableCell>
                          <TableCell className="font-bold">₱ {emp.net_pay.toLocaleString()}</TableCell>
                          <TableCell>{emp.month_year}</TableCell>
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
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.employee_name}</TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell>₱ {d.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}