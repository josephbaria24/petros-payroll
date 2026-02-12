import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendEmail, generatePayrollEmailHtml } from '@/lib/emailService'

export async function POST(req: Request) {
    try {
        const { periodEnd, recordIds } = await req.json()

        if (!periodEnd && (!recordIds || recordIds.length === 0)) {
            return NextResponse.json({ error: 'Missing periodEnd or recordIds' }, { status: 400 })
        }

        let query = supabaseServer
            .from('payroll_records')
            .select(`
        id,
        period_end,
        basic_salary,
        overtime_pay,
        holiday_pay,
        night_diff,
        allowances,
        gross_pay,
        sss,
        philhealth,
        pagibig,
        withholding_tax,
        loans,
        cash_advance,
        absences,
        total_deductions,
        net_pay,
        status,
        employees (
          full_name,
          email
        )
      `)

        if (recordIds && recordIds.length > 0) {
            query = query.in('id', recordIds)
        } else {
            query = query.eq('period_end', periodEnd)
        }

        const { data: records, error } = await query

        if (error) throw error
        if (!records || records.length === 0) {
            return NextResponse.json({ message: 'No records found to notify' }, { status: 404 })
        }

        const results = await Promise.all(
            records.map(async (rec: any) => {
                const employee = rec.employees
                const targetEmail = employee?.email

                if (!targetEmail) {
                    return { id: rec.id, success: false, error: 'No email found for employee' }
                }

                const basicSalary = rec.basic_salary || 0
                const overtimePay = rec.overtime_pay || 0
                const holidayPay = rec.holiday_pay || 0
                const nightDiff = rec.night_diff || 0
                const allowances = rec.allowances || 0
                const absences = rec.absences || 0

                // Sum all deductions manually for safety
                const totalDeductions = (rec.sss || 0) +
                    (rec.philhealth || 0) +
                    (rec.pagibig || 0) +
                    (rec.withholding_tax || 0) +
                    (rec.loans || 0) +
                    (rec.cash_advance || 0) +
                    absences

                const grossPay = basicSalary + overtimePay + holidayPay + nightDiff + allowances
                const netPay = grossPay - totalDeductions

                const breakdown: any = {
                    basic_salary: basicSalary,
                    overtime_pay: overtimePay,
                    holiday_pay: holidayPay,
                    night_diff: nightDiff,
                    allowances: allowances,
                    gross_pay: grossPay,
                    sss: rec.sss || 0,
                    philhealth: rec.philhealth || 0,
                    pagibig: rec.pagibig || 0,
                    withholding_tax: rec.withholding_tax || 0,
                    loans: rec.loans || 0,
                    cash_advance: rec.cash_advance || 0,
                    absences: absences,
                    total_deductions: totalDeductions,
                    net_pay: netPay,
                    status: rec.status,
                }

                const html = generatePayrollEmailHtml(
                    employee.full_name,
                    rec.period_end,
                    breakdown
                )

                const emailResult = await sendEmail({
                    to: targetEmail,
                    subject: `Payslip - ${employee.full_name} (${rec.period_end})`,
                    html,
                })

                return { id: rec.id, email: targetEmail, originalEmployee: employee.full_name, ...emailResult }
            })
        )

        const successCount = results.filter(r => r.success).length
        const failCount = results.length - successCount

        return NextResponse.json({
            summary: {
                total: results.length,
                success: successCount,
                failed: failCount,
            },
            details: results,
        })
    } catch (error: any) {
        console.error('Notification API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
