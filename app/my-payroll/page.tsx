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
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download } from "lucide-react"

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
        const totalDeductions =
          deductions
            ?.filter(
              (d) =>
                d.created_at >= rec.period_start &&
                d.created_at <= rec.period_end
            )
            .reduce((sum, d) => sum + d.amount, 0) || 0
  
        return {
          ...rec,
          total_deductions: totalDeductions,
          net_after_deductions: rec.net_pay - totalDeductions,
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
        return <Badge className="bg-green-100 text-green-600">● {status}</Badge>
      case "Pending Payment":
        return <Badge className="bg-orange-100 text-orange-600">● {status}</Badge>
      case "Cancelled":
        return <Badge className="bg-gray-100 text-gray-600">● {status}</Badge>
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

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">My Payroll</h2>

      {loading ? (
        <p>Loading payroll records...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : records.length === 0 ? (
        <p>No payroll records found.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross Net Pay</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Net After Deductions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>

              </TableRow>
            </TableHeader>
            <TableBody>
            {records.map((rec, i) => (
              <TableRow key={i}>
                <TableCell>
                  {rec.period_start} – {rec.period_end}
                </TableCell>
                <TableCell>₱ {rec.net_pay.toLocaleString()}</TableCell>
                <TableCell>₱ {(rec.total_deductions || 0).toLocaleString()}</TableCell>
                <TableCell className="font-semibold">
                  ₱ {(rec.net_after_deductions || rec.net_pay).toLocaleString()}
                </TableCell>
                <TableCell>{statusBadge(rec.status)}</TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRecord(rec)}
                      >
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="lg:w-[40vw] max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle>Pay Slip</DialogTitle>
                        <Button
                          onClick={downloadPaySlip}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
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
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: '#000000' }}>Other Deductions:</span>
                                  <span style={{ fontWeight: '500', color: '#000000' }}>{formatCurrency(selectedRecord.total_deductions)}</span>
                                </div>
                                <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                                  <span style={{ color: '#000000' }}>TOTAL DEDUCTIONS:</span>
                                  <span style={{ color: '#000000' }}>{formatCurrency(
                                    (selectedRecord.sss || 0) + 
                                    (selectedRecord.philhealth || 0) + 
                                    (selectedRecord.pagibig || 0) + 
                                    (selectedRecord.withholding_tax || 0) + 
                                    (selectedRecord.absences || 0) + 
                                    (selectedRecord.total_deductions || 0)
                                  )}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Net Pay */}
                          <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', border: '2px solid #1f2937' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>NET PAY:</span>
                              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{formatCurrency(selectedRecord.net_pay)}</span>
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

          </CardContent>
        </Card>
      )}
    </div>
  )
}