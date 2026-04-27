import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendEmail, generatePayrollEmailHtml, type PayrollBreakdown } from '@/lib/emailService'

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { periodEnd, recordIds, organization = 'petrosphere' } = body as {
      periodEnd?: string
      recordIds?: string[]
      organization?: string
    }

    if (!periodEnd && (!recordIds || recordIds.length === 0)) {
      return NextResponse.json({ error: 'Missing periodEnd or recordIds' }, { status: 400 })
    }

    const isPdn = organization === 'pdn'
    const payrollTable = isPdn ? 'pdn_payroll_records' : 'payroll_records'
    const employeeRelation = isPdn
      ? 'pdn_employees ( full_name, email )'
      : 'employees ( full_name, email )'

    let query = supabaseServer.from(payrollTable).select(`
        id,
        period_start,
        period_end,
        basic_salary,
        overtime_pay,
        holiday_pay,
        night_diff,
        allowances,
        bonuses,
        commission,
        gross_pay,
        sss,
        philhealth,
        pagibig,
        withholding_tax,
        loans,
        cash_advance,
        uniform,
        tardiness,
        absences,
        total_deductions,
        net_pay,
        status,
        ${employeeRelation}
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
      records.map(async (rec: Record<string, unknown>) => {
        const employee = (isPdn ? rec.pdn_employees : rec.employees) as
          | { full_name: string; email: string | null }
          | null
          | undefined

        const targetEmail = employee?.email

        if (!targetEmail) {
          return { id: rec.id, success: false, error: 'No email found for employee' }
        }

        const basicSalary = num(rec.basic_salary)
        const overtimePay = num(rec.overtime_pay)
        const holidayPay = num(rec.holiday_pay)
        const nightDiff = num(rec.night_diff)
        const allowances = num(rec.allowances)
        const bonuses = num(rec.bonuses)
        const commission = num(rec.commission)

        const earningsSum =
          basicSalary +
          overtimePay +
          holidayPay +
          nightDiff +
          allowances +
          bonuses +
          commission
        const grossPay = rec.gross_pay != null && rec.gross_pay !== '' ? num(rec.gross_pay) : earningsSum

        const sss = num(rec.sss)
        const philhealth = num(rec.philhealth)
        const pagibig = num(rec.pagibig)
        const withholdingTax = num(rec.withholding_tax)
        const loans = num(rec.loans)
        const cashAdvance = num(rec.cash_advance)
        const uniform = num(rec.uniform)
        const tardiness = num(rec.tardiness)
        const absences = num(rec.absences)

        const deductionsSum =
          sss + philhealth + pagibig + withholdingTax + loans + cashAdvance + uniform + tardiness + absences
        const totalDeductions =
          rec.total_deductions != null && rec.total_deductions !== ''
            ? num(rec.total_deductions)
            : deductionsSum

        const netPay =
          rec.net_pay != null && rec.net_pay !== '' ? num(rec.net_pay) : grossPay - totalDeductions

        const breakdown: PayrollBreakdown = {
          period_start: rec.period_start as string | undefined,
          period_end: (rec.period_end as string) || '',
          basic_salary: basicSalary,
          overtime_pay: overtimePay,
          holiday_pay: holidayPay,
          night_diff: nightDiff,
          allowances,
          bonuses,
          commission,
          gross_pay: grossPay,
          sss,
          philhealth,
          pagibig,
          withholding_tax: withholdingTax,
          loans,
          cash_advance: cashAdvance,
          uniform,
          tardiness,
          absences,
          total_deductions: totalDeductions,
          net_pay: netPay,
          status: rec.status as string | undefined,
        }

        const periodLabel =
          breakdown.period_start && breakdown.period_end
            ? `${breakdown.period_start} – ${breakdown.period_end}`
            : breakdown.period_end

        const html = generatePayrollEmailHtml(employee.full_name, breakdown)

        const emailResult = await sendEmail({
          to: targetEmail,
          subject: `Payslip - ${employee.full_name} (${periodLabel})`,
          html,
        })

        return { id: rec.id, email: targetEmail, originalEmployee: employee.full_name, ...emailResult }
      })
    )

    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    return NextResponse.json({
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
      details: results,
    })
  } catch (error: unknown) {
    console.error('Notification API Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
