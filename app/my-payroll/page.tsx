"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, DollarSign, FileText, TrendingUp, Calendar } from "lucide-react"

export default function MyPayrollPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const supabase = createPagesBrowserClient()
  const router = useRouter()
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [employeeDetails, setEmployeeDetails] = useState<any | null>(null)

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
  
      // Get employee record
      const { data: employee } = await supabase
        .from("employees")
        .select("id, employee_code, full_name, department, position")
        .eq("email", user.email)
        .single()
    
      if (!employee) {
        setError("No employee record found.")
        setLoading(false)
        return
      }
      setEmployeeDetails(employee)
      
  
      // Fetch payroll records
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
  
      // Fetch deductions separately
      const { data: deductions, error: dedError } = await supabase
        .from("deductions")
        .select("employee_id, amount, created_at")
        .eq("employee_id", employee.id)
  
      if (dedError) {
        console.error(dedError)
      }
  
      // Merge: attach deductions into payroll
      const merged = payroll.map((rec: any) => {
        const additionalDeductions =
          deductions
            ?.filter(
              (d) =>
                d.created_at >= rec.period_start &&
                d.created_at <= rec.period_end
            )
            .reduce((sum, d) => sum + d.amount, 0) || 0
      
        // Compute total earnings manually
        const totalEarnings =
          (rec.basic_salary || 0) +
          (rec.overtime_pay || 0) +
          (rec.holiday_pay || 0) +
          (rec.night_diff || 0) +
          (rec.allowances || 0) +
          (rec.bonuses || 0) +
          (rec.commission || 0)
      
        // Compute all deductions (database fields + additional deductions)
        // Note: absences should already be included in the payroll record, not added separately
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
  }, [])

  const downloadPaySlip = async () => {
    if (!selectedRecord) return

    try {
      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default
      
      const element = document.getElementById('payslip-content')
      if (!element) return

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
      alert('Error downloading pay slip. Please try again.')
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return <Badge className="bg-green-100 text-green-600 border-green-200">● {status}</Badge>
      case "Pending Payment":
        return <Badge className="bg-orange-100 text-orange-600 border-orange-200">● {status}</Badge>
      case "Cancelled":
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200">● {status}</Badge>
      default:
        return <Badge className="bg-muted text-muted-foreground">● Unknown</Badge>
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    return amount ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00'
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

  // Calculate summary stats
  const totalEarnings = records.reduce((sum, rec) => sum + (rec.calculated_net_pay || 0), 0)
  const avgEarnings = records.length > 0 ? totalEarnings / records.length : 0
  const latestPay = records.length > 0 ? records[0].calculated_net_pay || 0 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Payroll Dashboard
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Track your earnings and pay slips
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-600">Loading payroll records...</p>
            </div>
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <p className="text-red-600 text-lg">{error}</p>
            </CardContent>
          </Card>
        ) : records.length === 0 ? (
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="p-8 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No payroll records found.</p>
              <p className="text-gray-500 mt-2">Your pay slips will appear here once they're processed.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Latest Pay</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(latestPay)}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Average Pay</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(avgEarnings)}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Records</p>
                      <p className="text-2xl font-bold text-purple-600">{records.length}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <Calendar className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payroll Records Table */}
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Payroll History
                </CardTitle>
                <CardDescription className="text-green-100">
                  View and download your pay slips
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Pay Period</TableHead>
                        <TableHead className="font-semibold text-gray-700">Gross Pay</TableHead>
                        <TableHead className="font-semibold text-gray-700">Deductions</TableHead>
                        <TableHead className="font-semibold text-gray-700">Net Pay</TableHead>
                        <TableHead className="font-semibold text-gray-700">Status</TableHead>
                        <TableHead className="font-semibold text-gray-700">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((rec, i) => (
                        <TableRow key={i} className="hover:bg-green-50/50 transition-colors duration-200">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatPeriod(rec.period_start, rec.period_end)}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(rec.gross_pay)}
                          </TableCell>
                          <TableCell className="text-red-600">
                            -{formatCurrency(rec.calculated_total_deductions)}
                          </TableCell>
                          <TableCell className="font-bold text-lg">
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
                                  className="hover:bg-green-50 hover:border-green-300 transition-colors duration-200"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Slip
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="lg:w-[45vw] max-h-[90vh] overflow-y-auto">
                                <DialogHeader className="flex flex-row items-center justify-between pb-4">
                                  <DialogTitle className="text-xl">Digital Pay Slip</DialogTitle>
                                  <Button
                                    onClick={downloadPaySlip}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2 mr-4 hover:bg-green-50"
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </Button>
                                </DialogHeader>
                                
                                {selectedRecord && (
                                  <div id="payslip-content" style={{ backgroundColor: '#ffffff', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', color: '#000000', fontFamily: 'Arial, sans-serif' }}>
                                    {/* Header */}
                                    <div style={{ textAlign: 'center', borderBottom: '2px solid #1f2937', paddingBottom: '16px' }}>
                                      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>Petrosphere Inc.</h1>
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

                                    {/* Net Pay */}
                                    <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', border: '2px solid #1f2937' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>NET PAY:</span>
                                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                                          {formatCurrency(selectedRecord.calculated_net_pay)}
                                        </span>
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}