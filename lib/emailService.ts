import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const fromName = process.env.SMTP_FROM_NAME || 'PSI Payroll'
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@petrosphere.com.ph' // Fallback to common domain

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    })
    console.log('Message sent: %s', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

export type PayrollBreakdown = {
  period_start?: string
  period_end?: string
  basic_salary: number
  overtime_pay: number
  holiday_pay: number
  night_diff: number
  allowances: number
  unpaid_salary: number
  reimbursement: number
  bonuses: number
  commission: number
  gross_pay: number
  sss: number
  philhealth: number
  pagibig: number
  withholding_tax: number
  loans: number
  cash_advance: number
  uniform: number
  tardiness: number
  absences: number
  total_deductions: number
  net_pay: number
  status?: string
}

function moneyCell(value: number): string {
  const v = Number(value) || 0
  return `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function rowLine(label: string, value: number): string {
  return `
    <tr>
      <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${label}</td>
      <td style="padding: 8px 0; text-align: right; color: #0f172a; font-size: 14px;">
        ${moneyCell(value)}
      </td>
    </tr>
  `
}

export function generatePayrollEmailHtml(employeeName: string, breakdown: PayrollBreakdown) {
  const periodEnd = breakdown.period_end || ''
  const periodStart = breakdown.period_start
  const periodLine =
    periodStart && periodEnd
      ? `${periodStart} – ${periodEnd}`
      : periodEnd
        ? `Period ending ${periodEnd}`
        : 'Current period'

  const statusBadge = breakdown.status ? `
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background-color: ${breakdown.status.toLowerCase().includes('released') ? '#ecfdf5' : '#fff7ed'
    }; color: ${breakdown.status.toLowerCase().includes('released') ? '#059669' : '#d97706'
    }; border: 1px solid ${breakdown.status.toLowerCase().includes('released') ? '#d1fae5' : '#ffedd5'
    }; margin-bottom: 16px;">
      ${breakdown.status}
    </div>
  ` : '';

  return `
    <div style="font-family: 'Inter', sans-serif, system-ui; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Payslip Notification</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 8px;">${periodLine}</p>
      </div>

      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #f8fafc;">
        ${statusBadge}
        <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Employee</p>
        <p style="margin: 4px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${employeeName}</p>
      </div>

      <div style="margin-top: 32px;">
        <h3 style="color: #0f172a; font-size: 12px; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 0.05em;">Earnings</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${rowLine('Basic Salary', breakdown.basic_salary)}
          ${rowLine('Overtime Pay', breakdown.overtime_pay)}
          ${rowLine('Holiday Pay', breakdown.holiday_pay)}
          ${rowLine('Night Differential', breakdown.night_diff)}
          ${rowLine('Allowances', breakdown.allowances)}
          ${rowLine('Unpaid Salary', breakdown.unpaid_salary)}
          ${rowLine('Reimbursement', breakdown.reimbursement)}
          ${rowLine('Bonuses', breakdown.bonuses)}
          ${rowLine('Commission', breakdown.commission)}
          <tr style="border-top: 1px dashed #e2e8f0;">
            <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 700;">Gross Pay</td>
            <td style="padding: 12px 0; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700;">
              ${moneyCell(breakdown.gross_pay)}
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 32px;">
        <h3 style="color: #0f172a; font-size: 12px; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 0.05em;">Deductions</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${rowLine('SSS', breakdown.sss)}
          ${rowLine('PhilHealth', breakdown.philhealth)}
          ${rowLine('Pag-IBIG', breakdown.pagibig)}
          ${rowLine('Withholding Tax', breakdown.withholding_tax)}
          ${rowLine('Loans', breakdown.loans)}
          ${rowLine('Cash Advance', breakdown.cash_advance)}
          ${rowLine('Uniform', breakdown.uniform)}
          ${rowLine('Tardiness', breakdown.tardiness)}
          ${rowLine('Absences', breakdown.absences)}
          <tr style="border-top: 1px dashed #e2e8f0;">
            <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 700;">Total Deductions</td>
            <td style="padding: 12px 0; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700;">
              ${moneyCell(breakdown.total_deductions)}
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 40px; padding: 24px; background-color: #0f172a; border-radius: 12px; color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 500; color: #94a3b8;">Take-home Pay</span>
          <span style="font-size: 24px; font-weight: 800; text-align: right; display: block; width: 100%; color: #ffffff;">
            ${moneyCell(breakdown.net_pay)}
          </span>
        </div>
      </div>

      <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is an automated payroll notification from Petrosphere Inc.</p>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">&copy; ${new Date().getFullYear()} Petrosphere Inc. All rights reserved.</p>
      </div>
    </div>
  `;
}
