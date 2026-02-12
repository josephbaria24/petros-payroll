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
  basic_salary: number;
  overtime_pay: number;
  holiday_pay: number;
  night_diff: number;
  allowances: number;
  gross_pay: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  withholding_tax: number;
  loans: number;
  cash_advance: number;
  absences: number;
  total_deductions: number;
  net_pay: number;
  status?: string;
}

export function generatePayrollEmailHtml(employeeName: string, periodEnd: string, breakdown: PayrollBreakdown) {
  const row = (label: string, value: number, isBold = false) => `
    <tr>
      <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${label}</td>
      <td style="padding: 8px 0; text-align: right; color: #0f172a; font-size: 14px; ${isBold ? 'font-weight: bold;' : ''}">
        ₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  `;

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
        <p style="color: #64748b; font-size: 14px; margin-top: 8px;">For the period ending ${periodEnd}</p>
      </div>

      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #f8fafc;">
        ${statusBadge}
        <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Employee</p>
        <p style="margin: 4px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${employeeName}</p>
      </div>

      <div style="margin-top: 32px;">
        <h3 style="color: #0f172a; font-size: 12px; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 0.05em;">Earnings</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Basic Salary', breakdown.basic_salary)}
          ${breakdown.overtime_pay > 0 ? row('Overtime Pay', breakdown.overtime_pay) : ''}
          ${breakdown.holiday_pay > 0 ? row('Holiday Pay', breakdown.holiday_pay) : ''}
          ${breakdown.night_diff > 0 ? row('Night Differential', breakdown.night_diff) : ''}
          ${breakdown.allowances > 0 ? row('Allowances', breakdown.allowances) : ''}
          <tr style="border-top: 1px dashed #e2e8f0;">
            <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 700;">Gross Pay</td>
            <td style="padding: 12px 0; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700;">
              ₱${breakdown.gross_pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 32px;">
        <h3 style="color: #0f172a; font-size: 12px; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 0.05em;">Deductions</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${breakdown.sss > 0 ? row('SSS Contribution', breakdown.sss) : ''}
          ${breakdown.philhealth > 0 ? row('PhilHealth Contribution', breakdown.philhealth) : ''}
          ${breakdown.pagibig > 0 ? row('Pag-IBIG Contribution', breakdown.pagibig) : ''}
          ${breakdown.withholding_tax > 0 ? row('Withholding Tax', breakdown.withholding_tax) : ''}
          ${breakdown.loans > 0 ? row('Loans', breakdown.loans) : ''}
          ${breakdown.cash_advance > 0 ? row('Cash Advance', breakdown.cash_advance) : ''}
          ${breakdown.absences > 0 ? row('Absences', breakdown.absences) : ''}
          <tr style="border-top: 1px dashed #e2e8f0;">
            <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 700;">Total Deductions</td>
            <td style="padding: 12px 0; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700;">
              ₱${breakdown.total_deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 40px; padding: 24px; background-color: #0f172a; border-radius: 12px; color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 500; color: #94a3b8;">Take-home Pay</span>
          <span style="font-size: 24px; font-weight: 800; text-align: right; display: block; width: 100%;">
            ₱${breakdown.net_pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
