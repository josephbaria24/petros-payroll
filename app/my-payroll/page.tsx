"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient" // Changed: Imported supabase client
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { toast } from "@/lib/toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Eye, PhilippinePeso, Trash2, Search, Info, TrendingUp, Calendar, ChevronRight, ChevronLeft } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { QRCodeSVG } from "qrcode.react"

export default function MyPayrollPage() {
  const { activeOrganization } = useOrganization()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [employeeDetails, setEmployeeDetails] = useState<any | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const totalPages = Math.ceil(records.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRecords = records.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()

      if (sessionError || !user) {
        router.push("/login")
        return
      }

      setUserEmail(user.email || "")

      if (activeOrganization === "pdn") {
        // Fetch PDN employee data from Supabase
        const { data: pdnEmp, error: pdnEmpErr } = await supabase
          .from("pdn_employees")
          .select("id, employee_code, full_name, department, position")
          .ilike("email", user.email || "")
          .maybeSingle()

        if (pdnEmpErr || !pdnEmp) {
          setError("No employee record found for Palawan Daily News.")
          setLoading(false)
          return
        }

        setEmployeeDetails(pdnEmp)

        // Fetch payroll records from Supabase
        const { data: pdnPayroll, error: pdnPayErr } = await supabase
          .from("pdn_payroll_records")
          .select(`
            id, period_start, period_end, status, net_pay, gross_pay,
            basic_salary, overtime_pay, holiday_pay, night_diff, allowances,
            bonuses, commission, sss, philhealth, pagibig, withholding_tax,
            absences, tardiness, loans, uniform, total_deductions
          `)
          .eq("employee_id", pdnEmp.id)
          .order("period_end", { ascending: false })

        if (pdnPayErr) {
          setError("Error fetching PDN payroll records.")
          setLoading(false)
          return
        }

        const merged = (pdnPayroll || []).map((rec: any) => ({
          ...rec,
          additional_deductions: 0,
          calculated_total_deductions: rec.total_deductions || 0,
          gross_pay: rec.gross_pay || 0,
          calculated_net_pay: rec.net_pay || 0,
        }))

        setRecords(merged || [])
        setLoading(false)
        return
      }

      if (!user.email) {
        setError("User email not found in session.")
        setLoading(false)
        return
      }

      const cleanEmail = user.email.trim()
      console.log(`[MyPayroll] Searching for employee with email: "${cleanEmail}" (Length: ${cleanEmail.length})`)

      const { data: employee, error: empDbError } = await supabase
        .from("employees")
        .select("id, employee_code, full_name, department, position")
        .ilike("email", cleanEmail)
        .maybeSingle()

      if (empDbError) {
        console.error("[MyPayroll] Database error fetching employee:", empDbError)
      }

      if (!employee) {
        // Check user role for better messaging
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()

        const isStaff = profile?.role === 'admin' || profile?.role === 'hr'
        const message = isStaff
          ? `No employee record found for your staff account (${cleanEmail}). If you are an admin, you may not have an employee record linked to this email.`
          : `No employee record found for ${cleanEmail}. Please contact HR to ensure your email is correctly registered in the system.`

        setError(message)
        setLoading(false)
        return
      }
      setEmployeeDetails(employee)

      const { data: payroll, error: payrollError } = await supabase
        .from("payroll_records")
        .select(`
          id,
          period_start,
          period_end,
          status,
          net_pay,
          gross_pay,
          basic_salary,
          overtime_pay,
          holiday_pay,
          night_diff,
          allowances,
          bonuses,
          commission,
          sss,
          philhealth,
          pagibig,
          withholding_tax,
          absences,
          tardiness,
          loans,
          uniform,
          total_deductions
        `)
        .eq("employee_id", employee.id)
        .order("period_end", { ascending: false })

      if (payrollError) {
        setError("Error fetching payroll records.")
        setLoading(false)
        return
      }

      const { data: deductions, error: dedError } = await supabase
        .from("deductions")
        .select("employee_id, amount, created_at")
        .eq("employee_id", employee.id)

      if (dedError) {
        console.error(dedError)
      }

      const merged = payroll.map((rec: any) => {
        const additionalDeductions =
          deductions
            ?.filter(
              (d) =>
                d.created_at >= rec.period_start &&
                d.created_at <= rec.period_end
            )
            .reduce((sum, d) => sum + d.amount, 0) || 0

        const totalEarnings =
          (rec.basic_salary || 0) +
          (rec.overtime_pay || 0) +
          (rec.holiday_pay || 0) +
          (rec.night_diff || 0) +
          (rec.allowances || 0) +
          (rec.bonuses || 0) +
          (rec.commission || 0)

        const allDeductions =
          (rec.sss || 0) +
          (rec.philhealth || 0) +
          (rec.pagibig || 0) +
          (rec.withholding_tax || 0) +
          (rec.absences || 0) +
          (rec.tardiness || 0) +
          (rec.loans || 0) +
          (rec.uniform || 0) +
          additionalDeductions

        return {
          ...rec,
          additional_deductions: additionalDeductions,
          calculated_total_deductions: allDeductions,
          gross_pay: totalEarnings,
          calculated_net_pay: totalEarnings - allDeductions,
        }
      })

      setRecords(merged || [])
      setLoading(false)
    }

    fetchData()
  }, [activeOrganization])

  const downloadPaySlip = async (id = "payslip-content") => {
    if (!selectedRecord) return

    try {
      const html2canvas = (await import('html2canvas')).default

      const element = document.getElementById(id)
      if (!element) {
        toast.error("Pay slip content not found")
        return
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      })

      const link = document.createElement('a')
      link.download = `payslip_${selectedRecord.period_start}_to_${selectedRecord.period_end}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.9)
      link.click()
    } catch (error) {
      console.error('Error generating pay slip image:', error)
      toast.error('Error downloading pay slip. Please try again.')
    }
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      "Paid": "bg-primary text-primary-foreground border-transparent",
      "Payment Success": "bg-primary text-primary-foreground border-transparent",
      "Pending Payment": "bg-muted text-muted-foreground border-border",
      "Cancelled": "bg-muted/50 text-muted-foreground border-border",
    }

    return (
      <Badge variant="outline" className={`${variants[status] || "bg-muted text-muted-foreground border-border"} font-medium`}>
        {status}
      </Badge>
    )
  }

  const formatCurrency = (amount: number | null | undefined) => {
    return amount
      ? `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
      : "₱0.00"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const totalEarnings = records.reduce((sum, rec) => sum + (rec.calculated_net_pay || 0), 0)
  const avgEarnings = records.length > 0 ? totalEarnings / records.length : 0
  const latestPay = records.length > 0 ? records[0].calculated_net_pay || 0 : 0

  return (
    <div className="min-h-screen bg-background p-6 space-y-8 text-foreground">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>Dashboard</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">My Payroll</span>
        </div>

        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground">My Payroll</h1>
          <p className="mt-1 text-muted-foreground">View your earnings history and download pay slips</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-primary rounded-full animate-pulse"></div>
              <span className="text-muted-foreground">Loading payroll records...</span>
            </div>
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        ) : records.length === 0 ? (
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No payroll records found</h3>
              <p className="text-muted-foreground">Your pay slips will appear here once they're processed.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Metrics Chips */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 shadow-sm">
                <PhilippinePeso className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">Latest Pay</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(latestPay)}</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Average Pay</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(avgEarnings)}</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Total Records</span>
                <span className="text-sm font-bold text-foreground">{records.length}</span>
              </div>
            </div>

            {/* Latest Payroll Big Preview */}
            {records.length > 0 && (
              <Card className="border-2 border-primary/10 shadow-xl bg-card overflow-hidden relative group transition-all hover:border-primary/20">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <PhilippinePeso className="h-32 w-32" />
                </div>
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Latest Payout</span>
                        <h2 className="text-5xl font-black text-foreground tracking-tight">
                          {formatCurrency(records[0].calculated_net_pay)}
                        </h2>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 pt-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase leading-none mb-1">Period</span>
                            <span className="text-xs font-semibold">{formatPeriod(records[0].period_start, records[0].period_end)}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase leading-none">Status</span>
                          {statusBadge(records[0].status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full md:w-auto">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="w-full md:w-48 h-12 text-base font-bold shadow-lg shadow-primary/20 group-hover:scale-[1.02] transition-transform"
                            onClick={() => setSelectedRecord(records[0])}
                          >
                            <Eye className="mr-2 h-5 w-5" />
                            View Full Slip
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="lg:w-[50vw] max-h-[90vh] overflow-y-auto">
                          <DialogHeader className="flex flex-row items-center justify-between pb-4">
                            <DialogTitle className="text-xl font-semibold text-foreground">Pay Slip Details</DialogTitle>
                            <Button
                              onClick={() => downloadPaySlip("payslip-content-latest")}
                              className="mr-8"
                              size="sm"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </DialogHeader>

                          {selectedRecord && (
                            <div id="payslip-content-latest" style={{ backgroundColor: '#ffffff', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', color: '#000000', fontFamily: 'Arial, sans-serif' }}>
                              {/* Header */}
                              <div style={{ textAlign: 'center', borderBottom: '2px solid #1f2937', paddingBottom: '16px' }}>
                                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>PETROSPHERE INCORPORATED.</h1>
                                <p style={{ fontSize: '14px', color: '#4b5563' }}>3rd Floor Trigold Business Park, Brgy San Pedro, Puerto Princesa City</p>
                                <p style={{ fontSize: '14px', color: '#4b5563' }}>Phone: 0917-708-7994 | Email: hrad@petrosphere.com.ph</p>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '12px', color: '#1f2937' }}>PAYROLL STATEMENT</h2>
                              </div>

                              {/* Employee Info & Pay Period */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>EMPLOYEE INFORMATION</h3>
                                  <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <p style={{ color: '#000000' }}>
                                      <span style={{ fontWeight: '500' }}>Employee ID:</span> {employeeDetails?.employee_code || '—'}
                                    </p>
                                    <p style={{ color: '#000000' }}>
                                      <span style={{ fontWeight: '500' }}>Name:</span> {employeeDetails?.full_name || '—'}
                                    </p>
                                    <p style={{ color: '#000000' }}>
                                      <span style={{ fontWeight: '500' }}>Department:</span> {employeeDetails?.department || '—'}
                                    </p>
                                    <p style={{ color: '#000000' }}>
                                      <span style={{ fontWeight: '500' }}>Position:</span> {employeeDetails?.position || '—'}
                                    </p>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>PAY PERIOD</h3>
                                  <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>From:</span> {formatDate(selectedRecord.period_start)}</p>
                                    <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>To:</span> {formatDate(selectedRecord.period_end)}</p>
                                    <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>Pay Date:</span> {formatDate(selectedRecord.period_end)}</p>
                                    <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>Status:</span> {selectedRecord.status}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Earnings & Deductions */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                {/* Earnings */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>EARNINGS</h3>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Basic Salary:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.basic_salary)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Overtime Pay:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.overtime_pay)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Holiday Pay:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.holiday_pay)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Allowances:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.allowances)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                                      <span style={{ color: '#000000' }}>GROSS PAY:</span>
                                      <span style={{ color: '#000000' }}>{formatCurrency(selectedRecord.gross_pay)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Deductions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>DEDUCTIONS</h3>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>SSS:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.sss)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>PhilHealth:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.philhealth)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Pag-IBIG:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.pagibig)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Withholding Tax:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.withholding_tax)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#000000' }}>Absences:</span>
                                      <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.absences)}</span>
                                    </div>
                                    {selectedRecord.additional_deductions > 0 && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#000000' }}>Other Deductions:</span>
                                        <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.additional_deductions)}</span>
                                      </div>
                                    )}
                                    <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                                      <span style={{ color: '#000000' }}>TOTAL DEDUCTIONS:</span>
                                      <span style={{ color: '#000000' }}>{formatCurrency(selectedRecord.calculated_total_deductions)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Net Pay & QR Code Verification */}
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'center' }}>
                                <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', border: '2px solid #1f2937' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>NET PAY:</span>
                                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                                      {formatCurrency(selectedRecord.calculated_net_pay)}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                                    <QRCodeSVG
                                      value={`VALIDATION DATA:
Name: ${employeeDetails?.full_name}
Email: ${userEmail}
Reference ID: ${selectedRecord.id}
Period: ${formatPeriod(selectedRecord.period_start, selectedRecord.period_end)}
Net Amount: ${formatCurrency(selectedRecord.calculated_net_pay)}
Company: PETROSPHERE INC.`}
                                      size={100}
                                      level="H"
                                      includeMargin={false}
                                    />
                                  </div>
                                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1f2937', textAlign: 'center' }}>VALIDATION QR</span>
                                </div>
                              </div>

                              {/* Footer */}
                              <div style={{ textAlign: 'center', fontSize: '12px', paddingTop: '16px', borderTop: '1px solid #d1d5db', color: '#6b7280' }}>
                                <p>This is a computer-generated pay slip and does not require a signature.</p>
                                <p style={{ marginTop: '4px' }}>Generated on {new Date().toLocaleDateString('en-PH')}</p>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10 pt-8 border-t border-border/50">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Gross Pay</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(records[0].gross_pay)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Deductions</p>
                      <p className="text-lg font-bold text-destructive">{formatCurrency(records[0].calculated_total_deductions)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Basic Salary</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(records[0].basic_salary)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Allowances</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(records[0].allowances)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payroll Records Table */}
            <Card className="border border-border shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold text-foreground">Payroll History</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Complete record of your compensation</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-medium text-foreground">Pay Period</TableHead>
                        <TableHead className="font-medium text-foreground">Gross Pay</TableHead>
                        <TableHead className="font-medium text-foreground">Deductions</TableHead>
                        <TableHead className="font-medium text-foreground">Net Pay</TableHead>
                        <TableHead className="font-medium text-foreground">Status</TableHead>
                        <TableHead className="font-medium text-foreground">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRecords.length > 0 ? (
                        paginatedRecords.map((rec, i) => (
                        <TableRow key={i} className="border-b border-border hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-foreground">{formatPeriod(rec.period_start, rec.period_end)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {formatCurrency(rec.gross_pay)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatCurrency(rec.calculated_total_deductions)}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {formatCurrency(rec.calculated_net_pay)}
                          </TableCell>
                          <TableCell>{statusBadge(rec.status)}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedRecord(rec)}
                                  className="hover:bg-muted/30"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Slip
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="lg:w-[50vw] max-h-[90vh] overflow-y-auto">
                                <DialogHeader className="flex flex-row items-center justify-between pb-4">
                                  <DialogTitle className="text-xl font-semibold text-foreground">Pay Slip Details</DialogTitle>
                                  <Button
                                    onClick={() => downloadPaySlip("payslip-content")}
                                    className="mr-8"
                                    size="sm"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                </DialogHeader>

                                {selectedRecord && (
                                  <div id="payslip-content" style={{ backgroundColor: '#ffffff', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', color: '#000000', fontFamily: 'Arial, sans-serif' }}>
                                    {/* Header */}
                                    <div style={{ textAlign: 'center', borderBottom: '2px solid #1f2937', paddingBottom: '16px' }}>
                                      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>PETROSPHERE INCORPORATED.</h1>
                                      <p style={{ fontSize: '14px', color: '#4b5563' }}>3rd Floor Trigold Business Park, Brgy San Pedro, Puerto Princesa City</p>
                                      <p style={{ fontSize: '14px', color: '#4b5563' }}>Phone: 0917-708-7994 | Email: hrad@petrosphere.com.ph</p>
                                      <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '12px', color: '#1f2937' }}>PAYROLL STATEMENT</h2>
                                    </div>

                                    {/* Employee Info & Pay Period */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>EMPLOYEE INFORMATION</h3>
                                        <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <p style={{ color: '#000000' }}>
                                            <span style={{ fontWeight: '500' }}>Employee ID:</span> {employeeDetails?.employee_code || '—'}
                                          </p>
                                          <p style={{ color: '#000000' }}>
                                            <span style={{ fontWeight: '500' }}>Name:</span> {employeeDetails?.full_name || '—'}
                                          </p>
                                          <p style={{ color: '#000000' }}>
                                            <span style={{ fontWeight: '500' }}>Department:</span> {employeeDetails?.department || '—'}
                                          </p>
                                          <p style={{ color: '#000000' }}>
                                            <span style={{ fontWeight: '500' }}>Position:</span> {employeeDetails?.position || '—'}
                                          </p>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>PAY PERIOD</h3>
                                        <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>From:</span> {formatDate(selectedRecord.period_start)}</p>
                                          <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>To:</span> {formatDate(selectedRecord.period_end)}</p>
                                          <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>Pay Date:</span> {formatDate(selectedRecord.period_end)}</p>
                                          <p style={{ color: '#000000' }}><span style={{ fontWeight: '500' }}>Status:</span> {selectedRecord.status}</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Earnings & Deductions */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                      {/* Earnings */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>EARNINGS</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Basic Salary:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.basic_salary)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Overtime Pay:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.overtime_pay)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Holiday Pay:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.holiday_pay)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Allowances:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.allowances)}</span>
                                          </div>
                                          <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                                            <span style={{ color: '#000000' }}>GROSS PAY:</span>
                                            <span style={{ color: '#000000' }}>{formatCurrency(selectedRecord.gross_pay)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Deductions */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <h3 style={{ fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>DEDUCTIONS</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>SSS:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.sss)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>PhilHealth:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.philhealth)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Pag-IBIG:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.pagibig)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Withholding Tax:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.withholding_tax)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#000000' }}>Absences:</span>
                                            <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.absences)}</span>
                                          </div>
                                          {selectedRecord.additional_deductions > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <span style={{ color: '#000000' }}>Other Deductions:</span>
                                              <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.additional_deductions)}</span>
                                            </div>
                                          )}
                                          <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                                            <span style={{ color: '#000000' }}>TOTAL DEDUCTIONS:</span>
                                            <span style={{ color: '#000000' }}>{formatCurrency(selectedRecord.calculated_total_deductions)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Net Pay & QR Code Verification */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'center' }}>
                                      <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', border: '2px solid #1f2937' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>NET PAY:</span>
                                          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                                            {formatCurrency(selectedRecord.calculated_net_pay)}
                                          </span>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                                          <QRCodeSVG
                                            value={`VALIDATION DATA:
Name: ${employeeDetails?.full_name}
Email: ${userEmail}
Reference ID: ${selectedRecord.id}
Period: ${formatPeriod(selectedRecord.period_start, selectedRecord.period_end)}
Net Amount: ${formatCurrency(selectedRecord.calculated_net_pay)}
Company: PETROSPHERE INC.`}
                                            size={100}
                                            level="H"
                                            includeMargin={false}
                                          />
                                        </div>
                                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1f2937', textAlign: 'center' }}>VALIDATION QR</span>
                                      </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ textAlign: 'center', fontSize: '12px', paddingTop: '16px', borderTop: '1px solid #d1d5db', color: '#6b7280' }}>
                                      <p>This is a computer-generated pay slip and does not require a signature.</p>
                                      <p style={{ marginTop: '4px' }}>Generated on {new Date().toLocaleDateString('en-PH')}</p>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No payroll records found for this page.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* Pagination Controls */}
              {records.length > itemsPerPage && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
                  <p className="text-sm text-muted-foreground font-medium">
                    Showing <span className="text-foreground">{startIndex + 1}</span> to <span className="text-foreground">{Math.min(startIndex + itemsPerPage, records.length)}</span> of <span className="text-foreground">{records.length}</span> records
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 hover:bg-primary/5 hover:text-primary transition-colors border-border"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          className={`h-9 w-9 p-0 font-medium transition-all ${
                            currentPage === page 
                              ? "bg-primary text-primary-foreground shadow-sm scale-105" 
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 hover:bg-primary/5 hover:text-primary transition-colors border-border"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}