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
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    // Payroll records
    const { data: payroll, error: pError } = await supabase
      .from("payroll_records")
      .select("id, employee_id, net_pay, period_start, period_end, employees(full_name, pay_type)")
    if (pError) console.error(pError)

    // Deductions
    const { data: deds, error: dError } = await supabase
      .from("deductions")
      .select("id, employee_id, type, amount, employees(full_name)")
    if (dError) console.error(dError)

    // Expenses
    const { data: exps, error: eError } = await supabase
      .from("company_expenses")
      .select("*")
      .order("incurred_on", { ascending: false })
    if (eError) console.error(eError)

    // Compute totals
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
      <Tabs defaultValue="deductions">
        <TabsList>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

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
