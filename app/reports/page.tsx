"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, PhilippinePeso, Users, TrendingUp, Calculator, FileText, Calendar, Building2, PieChart, BarChart3, Settings2, ChevronLeft, ChevronRight } from "lucide-react"
import { useProtectedPage } from "../hooks/useProtectedPage"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { PayrollAttendanceReportSection } from "@/components/payroll-attendance-report-section"

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
  totalSSS: number
  totalPhilHealth: number
  totalPagIbig: number
  totalWithholdingTax: number
  totalLoans: number
  totalUniform: number
  totalTardiness: number
  totalCashAdvance: number
  totalAbsences: number
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
  night_diff: number
  bonuses: number
  commission: number
}

type Deduction = {
  id: string
  employee_id: string
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

const REPORT_TAB_IDS = new Set([
  "employee-details",
  "monthly-payroll",
  "deductions",
  "expenses",
  "payroll-attendance-pdf",
])

function ReportsContent() {
  useProtectedPage(["admin", "hr"], "reports")
  const { activeOrganization } = useOrganization()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeReportTab = useMemo(() => {
    const t = searchParams.get("tab")
    return t && REPORT_TAB_IDS.has(t) ? t : "employee-details"
  }, [searchParams])

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

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportYear, setExportYear] = useState<string>(currentYear.toString())
  const [exportMonth, setExportMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'))
  const [exportPeriod, setExportPeriod] = useState<string>("all")

  // Reset period when year or month changes
  useEffect(() => {
    setExportPeriod("all")
  }, [exportYear, exportMonth])

  // Function to get available payroll periods based on selected year/month in export dialog
  const getAvailablePeriods = () => {
    const periods = employeePayrollDetails
      .filter(emp => {
        const date = new Date(emp.period_end)
        const yearMatch = exportYear === "all" || date.getFullYear().toString() === exportYear
        const monthMatch = exportMonth === "all" || (date.getMonth() + 1).toString().padStart(2, '0') === exportMonth
        return yearMatch && monthMatch
      })
      .map(emp => `${emp.period_start} to ${emp.period_end}`)

    return Array.from(new Set(periods)).sort().reverse()
  }

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

  const exportToExcel = (targetYear?: string, targetMonth?: string) => {
    if (!window.XLSX) {
      alert('Excel library is still loading. Please try again in a moment.')
      return
    }

    const yearToFilter = targetYear || selectedYear
    const monthToFilter = targetMonth || selectedMonth

    const filteredRecords = employeePayrollDetails.filter(emp => {
      // If a specific period is selected in the dialog
      if (exportPeriod !== "all") {
        const [start, end] = exportPeriod.split(' to ')
        return emp.period_start === start && emp.period_end === end
      }

      if (yearToFilter === "all" && monthToFilter === "all") return true
      const date = new Date(emp.period_end)
      const yearMatch = yearToFilter === "all" || date.getFullYear().toString() === yearToFilter
      const monthMatch = monthToFilter === "all" || (date.getMonth() + 1).toString().padStart(2, '0') === monthToFilter
      return yearMatch && monthMatch
    })

    if (filteredRecords.length === 0) {
      alert('No employee payroll data found for the selected period')
      return
    }

    // Get all unique deduction types for dynamic columns
    const dynamicDeductionTypes = Array.from(new Set(deductions.map(d => d.type)))

    const excelData = filteredRecords.map(emp => {
      const row: any = {
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
        'Night Diff': emp.night_diff || 0,
        'Bonuses': emp.bonuses || 0,
        'Commission': emp.commission || 0,
        'Gross Pay': emp.gross_pay,
        'Absences': emp.absences,
        'SSS': emp.sss,
        'PhilHealth': emp.philhealth,
        'Pag-IBIG': emp.pagibig,
        'Withholding Tax': emp.withholding_tax,
        'Loans': emp.loans,
        'Uniform': emp.uniform,
        'Tardiness': emp.tardiness,
        'Cash Advance': emp.cash_advance,
      }

      // Add dynamic deductions
      dynamicDeductionTypes.forEach(type => {
        // Find if this specific employee has this deduction in this period
        // Note: The 'deductions' state seems to be global, but for export we might need to filter by employee
        // However, the current schema/state doesn't easily link 'deductions' table entries to a specific 'payroll_record'
        // unless we join them. For now, since 'deductions' are fetched separately, we'll try to find any matching
        // employee deductions. A better way would be to have them in EmployeePayrollDetail.
        row[type] = deductions
          .filter(d => d.employee_id === emp.employee_id) // This assumes employee_id is available in Deduction
          .filter(d => {
            const dDate = new Date(d.created_at)
            const pStart = new Date(emp.period_start)
            const pEnd = new Date(emp.period_end)
            return dDate >= pStart && dDate <= pEnd && d.type === type
          })
          .reduce((sum, d) => sum + d.amount, 0)
      })

      row['Total Deductions'] = emp.total_deductions
      row['Net Pay'] = emp.net_pay
      row['Status'] = emp.status
      row['Month/Year'] = emp.month_year
      return row
    })

    const wb = window.XLSX.utils.book_new()
    const ws = window.XLSX.utils.json_to_sheet(excelData)

    ws['!cols'] = Array(excelData.length > 0 ? Object.keys(excelData[0]).length : 24).fill({ width: 15 })

    window.XLSX.utils.book_append_sheet(wb, ws, "Employee Payroll Details")

    const currentDate = new Date().toISOString().split('T')[0]
    let periodLabel = ""
    
    if (exportPeriod !== "all") {
      periodLabel = `_${exportPeriod.replace(/ to /g, '_')}`
    } else if (yearToFilter !== "all" || monthToFilter !== "all") {
      const monthLabel = monthToFilter !== "all" ? months.find(m => m.value === monthToFilter)?.label : ""
      periodLabel = `_${monthLabel}${yearToFilter !== "all" ? "_" + yearToFilter : ""}`
    }

    const filename = `Payroll_Report_${currentDate}${periodLabel}.xlsx`

    window.XLSX.writeFile(wb, filename)
  }

  async function fetchReports() {
    try {
      if (activeOrganization === "pdn") {
        // Load PDN data from Supabase
        const { data: pdnPayroll, error: payErr } = await supabase
          .from("pdn_payroll_records")
          .select(`
            id, employee_id, period_start, period_end, basic_salary,
            allowances, overtime_pay, holiday_pay, gross_pay, absences,
            cash_advance, total_deductions, net_pay, sss, philhealth,
            pagibig, withholding_tax, loans, uniform, tardiness,
            night_diff, bonuses, commission, status,
            pdn_employees(employee_code, full_name, pay_type)
          `)
          .order("period_end", { ascending: false })

        if (payErr) {
          console.error("Error fetching PDN payroll:", payErr)
          return
        }

        const { data: pdnDeductions, error: dedErr } = await supabase
          .from("pdn_deductions")
          .select("id, employee_id, type, amount, created_at, pdn_employees(full_name)")
          .order("created_at", { ascending: false })

        if (dedErr) {
          console.error("Error fetching PDN deductions:", dedErr)
        }

        const enrichedPayroll = (pdnPayroll || []).map((rec: any) => {
          const periodEndDate = new Date(rec.period_end)
          const monthYear = `${periodEndDate.toLocaleDateString('en-US', { month: 'long' })} ${periodEndDate.getFullYear()}`

          return {
            ...rec,
            full_name: rec.pdn_employees?.full_name || 'Unknown',
            employee_code: rec.pdn_employees?.employee_code || 'N/A',
            pay_type: rec.pdn_employees?.pay_type || 'N/A',
            month_year: monthYear,
            withholding_tax: rec.withholding_tax || 0,
            uniform: rec.uniform || 0,
            tardiness: rec.tardiness || 0,
          }
        })

        setEmployeePayrollDetails(enrichedPayroll)
        setDeductions(
          (pdnDeductions || []).map((d: any) => ({
            id: d.id,
            employee_id: d.employee_id,
            employee_name: d.pdn_employees?.full_name || 'Unknown',
            type: d.type,
            amount: d.amount,
            created_at: d.created_at,
          }))
        )

        // Calculate summary
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
          night_diff,
          bonuses,
          commission,
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
          night_diff: record.night_diff || 0,
          bonuses: record.bonuses || 0,
          commission: record.commission || 0,
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
            recordCount: 0,
            totalSSS: 0,
            totalPhilHealth: 0,
            totalPagIbig: 0,
            totalWithholdingTax: 0,
            totalLoans: 0,
            totalUniform: 0,
            totalTardiness: 0,
            totalCashAdvance: 0,
            totalAbsences: 0,
          })
        }

        const monthlyData = monthlyMap.get(monthYearKey)!
        monthlyData.recordCount += 1
        monthlyData.totalGrossPay += record.gross_pay || record.basic_salary || 0
        monthlyData.totalDeductions += record.total_deductions + (record.cash_advance || 0)
        monthlyData.totalNetPay += record.net_pay - (record.cash_advance || 0)
        monthlyData.totalAllowances += record.allowances

        // Individual deductions
        monthlyData.totalSSS += record.sss || 0
        monthlyData.totalPhilHealth += record.philhealth || 0
        monthlyData.totalPagIbig += record.pagibig || 0
        monthlyData.totalWithholdingTax += record.withholding_tax || 0
        monthlyData.totalLoans += record.loans || 0
        monthlyData.totalUniform += record.uniform || 0
        monthlyData.totalTardiness += record.tardiness || 0
        monthlyData.totalCashAdvance += record.cash_advance || 0
        monthlyData.totalAbsences += record.absences || 0

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
          employee_id: d.employee_id,
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

  const filteredDetails = employeePayrollDetails.filter(emp => {
    if (selectedYear === "all" && selectedMonth === "all") return true
    const date = new Date(emp.period_end)
    const yearMatch = selectedYear === "all" || date.getFullYear().toString() === selectedYear
    const monthMatch = selectedMonth === "all" || (date.getMonth() + 1).toString().padStart(2, '0') === selectedMonth
    return yearMatch && monthMatch
  })

  // Pagination Logic
  const totalPages = Math.ceil(filteredDetails.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedDetails = filteredDetails.slice(startIndex, startIndex + pageSize)

  // Calculate additional metrics
  const additionalMetrics = {
    totalEmployees: new Set(employeePayrollDetails.map(emp => emp.employee_id)).size,
    totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    totalRecords: employeePayrollDetails.length,
    averageGrossPay: employeePayrollDetails.length > 0 ? payrollSummary.totalGross / employeePayrollDetails.length : 0,
  }

  return (
    <div className="space-y-4 p-4 min-h-screen bg-background text-foreground">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-xs text-muted-foreground">Comprehensive payroll and financial reporting dashboard</p>
        </div>

        <div className="flex items-center gap-2 p-2 bg-card rounded-md border border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">Filter:</span>
            <div className="flex items-center gap-1.5">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Gross Payroll</p>
              <PhilippinePeso className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="text-lg font-bold text-foreground">₱{payrollSummary.totalGross.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Allowances</p>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="text-lg font-bold text-foreground">₱{payrollSummary.totalAllowances.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Deductions</p>
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="text-lg font-bold text-foreground">₱{payrollSummary.totalDeductions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Net Pay</p>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="text-lg font-bold text-foreground">₱{payrollSummary.totalNetPay.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Employees</p>
                <div className="text-base font-bold text-foreground">{additionalMetrics.totalEmployees}</div>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Expenses</p>
                <div className="text-base font-bold text-foreground">₱{additionalMetrics.totalExpenses.toLocaleString()}</div>
              </div>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Payroll Records</p>
                <div className="text-base font-bold text-foreground">{additionalMetrics.totalRecords}</div>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Avg. Gross Pay</p>
                <div className="text-base font-bold text-foreground">₱{additionalMetrics.averageGrossPay.toLocaleString()}</div>
              </div>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs — ?tab=payroll-attendance-pdf opens Payroll PDF (e.g. from Timekeeping) */}
      <Tabs
        value={activeReportTab}
        onValueChange={(v) => {
          router.replace(`${pathname}?tab=${encodeURIComponent(v)}`, { scroll: false })
        }}
        className="space-y-4"
      >
        <TabsList className="flex items-center gap-1 p-1 h-auto bg-muted/50 w-full md:w-max">
          <TabsTrigger value="employee-details" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            Employee Details
          </TabsTrigger>
          <TabsTrigger value="monthly-payroll" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            Monthly Payroll
          </TabsTrigger>
          <TabsTrigger value="deductions" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Calculator className="h-3.5 w-3.5" />
            Deductions
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="payroll-attendance-pdf" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Payroll PDF
          </TabsTrigger>
        </TabsList>

        {/* Employee Details Tab */}
        <TabsContent value="employee-details">
          <Card className="border border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Employee Payroll Details</h3>
                  <p className="text-[10px] text-muted-foreground">Detailed breakdown of employee payroll records</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Column Visibility Toggle */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
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
                    onClick={() => setIsExportDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
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
                        <TableRow className="border-b border-slate-200 bg-slate-50/50">
                          {visibleColumns.employee_id && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Employee ID</TableHead>}
                          {visibleColumns.full_name && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Full Name</TableHead>}
                          {visibleColumns.pay_type && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Type</TableHead>}
                          {visibleColumns.period && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Period</TableHead>}
                          {visibleColumns.basic_salary && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Salary</TableHead>}
                          {visibleColumns.allowances && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Allow</TableHead>}
                          {visibleColumns.overtime && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">OT</TableHead>}
                          {visibleColumns.holiday_pay && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Holiday</TableHead>}
                          {visibleColumns.gross_pay && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Gross</TableHead>}
                          {visibleColumns.absences && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Abs</TableHead>}
                          {visibleColumns.cash_advance && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">C.A.</TableHead>}
                          {visibleColumns.total_deductions && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Deduct</TableHead>}
                          {visibleColumns.net_pay && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Net Pay</TableHead>}
                          {visibleColumns.status && <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Status</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDetails.map((emp) => (
                          <TableRow key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            {visibleColumns.employee_id && <TableCell className="py-2 text-center text-xs font-medium text-slate-900">{emp.employee_code}</TableCell>}
                            {visibleColumns.full_name && <TableCell className="py-2 text-center text-xs font-medium text-slate-900">{emp.full_name}</TableCell>}
                            {visibleColumns.pay_type && <TableCell className="py-2 text-center text-xs text-slate-600">{emp.pay_type}</TableCell>}
                            {visibleColumns.period && (
                              <TableCell className="py-2 text-center text-[11px] text-slate-600">
                                {new Date(emp.period_start).toLocaleDateString()} - {new Date(emp.period_end).toLocaleDateString()}
                              </TableCell>
                            )}
                            {visibleColumns.basic_salary && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.basic_salary.toLocaleString()}</TableCell>}
                            {visibleColumns.allowances && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.allowances.toLocaleString()}</TableCell>}
                            {visibleColumns.overtime && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.overtime_pay.toLocaleString()}</TableCell>}
                            {visibleColumns.holiday_pay && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.holiday_pay.toLocaleString()}</TableCell>}
                            {visibleColumns.gross_pay && <TableCell className="py-2 text-center text-xs text-slate-900">₱{(emp.gross_pay || emp.basic_salary).toLocaleString()}</TableCell>}
                            {visibleColumns.absences && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.absences.toLocaleString()}</TableCell>}
                            {visibleColumns.cash_advance && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.cash_advance.toLocaleString()}</TableCell>}
                            {visibleColumns.total_deductions && <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.total_deductions.toLocaleString()}</TableCell>}
                            {visibleColumns.net_pay && <TableCell className="py-2 text-center text-xs font-bold text-slate-900">₱{(emp.net_pay + emp.allowances).toLocaleString()}</TableCell>}
                            {visibleColumns.status && (
                              <TableCell className="py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${statusVariants[emp.status] || "bg-slate-100 text-slate-600 border-slate-200"
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
                    <div className="flex items-center justify-between p-2 px-4 border-t border-slate-100 bg-slate-50/50">
                      <p className="text-[10px] text-slate-500">
                        Showing <span className="font-medium text-slate-700">{startIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startIndex + pageSize, employeePayrollDetails.length)}</span> of <span className="font-medium text-slate-700">{employeePayrollDetails.length}</span>
                      </p>
                      <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
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
                                  className={`h-7 w-7 p-0 text-[10px] ${currentPage === pageNum ? "bg-slate-900" : ""}`}
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
                          className="h-7 w-7 p-0"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
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
            <CardHeader className="p-4 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monthly Payroll Summary</h3>
                <p className="text-[10px] text-muted-foreground">Payroll breakdown organized by month</p>
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
                          <TableRow className="border-b border-slate-200 bg-slate-50/50">
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Month</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Emps</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Gross</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Allow</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">SSS</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">PhilH</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">PagIBIG</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">W.Tax</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Loans</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">C.Adv</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Ded</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Net Pay</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedMonthlySummary.map((summary) => (
                            <TableRow key={`${summary.year}-${summary.month}`} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <TableCell className="py-2 text-center text-xs font-semibold text-slate-900">{summary.monthYear}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">{summary.totalEmployees}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalGrossPay.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalAllowances.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalSSS.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalPhilHealth.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalPagIbig.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalWithholdingTax.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalLoans.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalCashAdvance.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{summary.totalDeductions.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs font-bold text-slate-900">₱{summary.totalNetPay.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                          {monthlyPayrollSummary.length > 1 && currentMonthlyPage === totalMonthlyPages && (
                            <TableRow className="border-t-2 border-slate-300 font-bold bg-slate-50">
                              <TableCell className="py-4 text-center text-slate-900">Total</TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                {monthlyPayrollSummary.reduce((sum, s) => sum + s.totalEmployees, 0)}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalGrossPay, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalAllowances, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalSSS, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalPhilHealth, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalPagIbig, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalWithholdingTax, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalLoans, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 text-center text-slate-900">
                                ₱{monthlyPayrollSummary.reduce((sum, s) => sum + s.totalCashAdvance, 0).toLocaleString()}
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
                      <div className="flex items-center justify-between p-2 px-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-[10px] text-slate-500">
                          Showing <span className="font-medium text-slate-700">{startMonthlyIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startMonthlyIndex + pageSize, monthlyPayrollSummary.length)}</span> of <span className="font-medium text-slate-700">{monthlyPayrollSummary.length}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentMonthlyPage(prev => Math.max(1, prev - 1))}
                            disabled={currentMonthlyPage === 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
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
                                  className={`h-7 w-7 p-0 text-[10px] ${currentMonthlyPage === pageNum ? "bg-slate-900 text-white" : ""}`}
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
                            className="h-7 w-7 p-0"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
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
            <CardHeader className="p-4 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Employee Deductions (Detailed)</h3>
                <p className="text-[10px] text-muted-foreground">Breakdown of all deduction types by employee</p>
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
                          <TableRow className="border-b border-slate-200 bg-slate-50/50">
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Employee</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">SSS</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">PhilH</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">PagIBIG</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">W.Tax</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Loans</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Unif</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Tard</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">C.Adv</TableHead>
                            <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedDeductionsDetails.map(emp => (
                            <TableRow key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <TableCell className="py-2 text-center text-xs font-semibold text-slate-900">{emp.full_name}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.sss.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.philhealth.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.pagibig.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.withholding_tax.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.loans.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.uniform.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.tardiness.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs text-slate-900">₱{emp.cash_advance.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center text-xs font-bold text-slate-900">
                                ₱{(emp.total_deductions + emp.cash_advance).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalDeductionsPages > 1 && (
                      <div className="flex items-center justify-between p-2 px-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-[10px] text-slate-500">
                          Showing <span className="font-medium text-slate-700">{startDeductionsIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startDeductionsIndex + pageSize, employeePayrollDetails.length)}</span> of <span className="font-medium text-slate-700">{employeePayrollDetails.length}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDeductionsPage(prev => Math.max(1, prev - 1))}
                            disabled={currentDeductionsPage === 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
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
                                  className={`h-7 w-7 p-0 text-[10px] ${currentDeductionsPage === pageNum ? "bg-slate-900 text-white" : ""}`}
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
                            className="h-7 w-7 p-0"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
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

        <TabsContent value="payroll-attendance-pdf" className="space-y-4">
          <PayrollAttendanceReportSection />
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card className="border border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Company Expenses</h3>
                <p className="text-[10px] text-muted-foreground">Overview of company operational expenses</p>
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
                        <TableRow className="border-b border-slate-200 bg-slate-50/50">
                          <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Date</TableHead>
                          <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Name</TableHead>
                          <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Category</TableHead>
                          <TableHead className="text-center h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedExpenses.map((e) => (
                          <TableRow key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <TableCell className="py-2 text-center text-[11px] text-slate-900">{new Date(e.incurred_on).toLocaleDateString()}</TableCell>
                            <TableCell className="py-2 text-center text-xs font-semibold text-slate-900">{e.expense_name}</TableCell>
                            <TableCell className="py-2 text-center text-xs text-slate-600">{e.category}</TableCell>
                            <TableCell className="py-2 text-center text-xs font-bold text-slate-900">₱{e.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination Controls */}
                    {totalExpensesPages > 1 && (
                      <div className="flex items-center justify-between p-2 px-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-[10px] text-slate-500">
                          Showing <span className="font-medium text-slate-700">{startExpensesIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startExpensesIndex + pageSize, expenses.length)}</span> of <span className="font-medium text-slate-700">{expenses.length}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentExpensesPage(prev => Math.max(1, prev - 1))}
                            disabled={currentExpensesPage === 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
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
                                  className={`h-7 w-7 p-0 text-[10px] ${currentExpensesPage === pageNum ? "bg-slate-900 text-white" : ""}`}
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
                            className="h-7 w-7 p-0"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
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
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="lg:w-[30%] w-[90%]">
          <DialogHeader>
            <DialogTitle>Export Payroll Report</DialogTitle>
            <DialogDescription>
              Select the period you want to export to Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="year" className="text-right">
                Year
              </Label>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="month" className="text-right">
                Month
              </Label>
              <Select value={exportMonth} onValueChange={setExportMonth}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="period" className="text-right font-medium">
                Period
              </Label>
              <Select value={exportPeriod} onValueChange={setExportPeriod}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select payroll period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Available Periods</SelectItem>
                  {getAvailablePeriods().map((period) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                exportToExcel(exportYear, exportMonth)
                setIsExportDialogOpen(false)
                setExportPeriod("all") // Reset after export
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-muted-foreground">
          Loading reports…
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  )
}