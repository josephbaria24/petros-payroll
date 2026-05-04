"use client"

import type { CSSProperties } from "react"
import { QRCodeSVG } from "qrcode.react"
import { PetrosphereBrandBanner } from "@/components/petrosphere-payslip-header"

function Watermark() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "url(/logo.png)",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
        opacity: 0.09,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  )
}

const theadStyle: CSSProperties = {
  backgroundColor: "#e5e7eb",
  color: "#111827",
  fontWeight: 600,
  fontSize: "13px",
}

const cellBorder: CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px 12px",
  fontSize: "13px",
}

export type PayrollReceiptEmployeeFields = {
  employee_name?: string | null
  employee_code?: string | null
  department?: string | null
  position?: string | null
  pay_type?: string | null
}

export type PayrollReceiptAmountFields = {
  period_start: string
  period_end: string
  basic_salary: number
  overtime_pay: number
  holiday_pay?: number
  night_diff?: number
  allowances?: number
  bonuses?: number
  commission?: number
  unpaid_salary?: number
  reimbursement?: number
  sss?: number
  philhealth?: number
  pagibig?: number
  withholding_tax?: number
  loans?: number
  uniform?: number
  absences?: number
  tardiness?: number
  cash_advance?: number
  total_deductions?: number
  status: string
}

export type PayrollEarningsReceiptProps = {
  exportRootId: string
  organization: "petrosphere" | "pdn"
  record: PayrollReceiptEmployeeFields & PayrollReceiptAmountFields
}

function formatCurrency(amount: number | null | undefined) {
  const n = Number(amount) || 0
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
}

function formatDateLong(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function brandMeta(org: "petrosphere" | "pdn") {
  if (org === "pdn") {
    return {
      companyLine: "PALAWAN DAILY NEWS",
      addressLine: "Puerto Princesa City, Palawan, Philippines",
      contactLine: "Palawan Daily News — Payroll",
      qrCompany: "PALAWAN DAILY NEWS",
    }
  }
  return {
    companyLine: "PETROSPHERE INCORPORATED.",
    addressLine: "3rd Floor Trigold Business Park, Brgy San Pedro, Puerto Princesa City",
    contactLine: "Phone: 0917-708-7994 | Email: hrad@petrosphere.com.ph",
    qrCompany: "PETROSPHERE INCORPORATED.",
  }
}

export function PayrollEarningsReceipt({ exportRootId, organization, record }: PayrollEarningsReceiptProps) {
  const brand = brandMeta(organization)
  const grossPay =
    (record.basic_salary || 0) +
    (record.overtime_pay || 0) +
    (record.holiday_pay || 0) +
    (record.night_diff || 0) +
    (record.allowances || 0) +
    (record.bonuses || 0) +
    (record.commission || 0) +
    (record.unpaid_salary || 0) +
    (record.reimbursement || 0)

  const netPay = grossPay - (record.total_deductions || 0)

  const earningsRows: { label: string; amount: number }[] = [
    { label: "Basic Salary", amount: record.basic_salary },
    { label: "Overtime Pay", amount: record.overtime_pay },
    { label: "Holiday Pay", amount: record.holiday_pay || 0 },
    { label: "Allowances", amount: record.allowances || 0 },
    { label: "Commission", amount: record.commission || 0 },
    { label: "Unpaid Salary", amount: record.unpaid_salary || 0 },
    { label: "Reimbursement", amount: record.reimbursement || 0 },
  ]

  const deductionRows: { label: string; amount: number }[] = [
    { label: "SSS", amount: record.sss || 0 },
    { label: "PhilHealth", amount: record.philhealth || 0 },
    { label: "Pag-IBIG", amount: record.pagibig || 0 },
    { label: "Loans & Other Deductions", amount: record.loans || 0 },
    { label: "Absences", amount: record.absences || 0 },
    { label: "Tardiness", amount: record.tardiness || 0 },
    { label: "Cash Advance", amount: record.cash_advance || 0 },
  ]

  const empName = record.employee_name || "—"
  const empCode = record.employee_code || "—"

  return (
    <div
      id={exportRootId}
      style={{
        position: "relative",
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        maxWidth: "720px",
        margin: "0 auto",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <Watermark />

      <div style={{ position: "relative", zIndex: 1 }}>
        {organization === "petrosphere" ? (
          <PetrosphereBrandBanner />
        ) : (
          <div
            style={{
              display: "flex",
              minHeight: "88px",
              backgroundColor: "#171717",
              color: "#fafafa",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <div style={{ fontSize: "12px", lineHeight: 1.5, opacity: 0.95 }}>{brand.addressLine}</div>
              <div style={{ fontSize: "12px", opacity: 0.85 }}>{brand.contactLine}</div>
            </div>
            <div
              style={{
                width: "140px",
                background: "linear-gradient(135deg, #d9f99d 0%, #84cc16 45%, #ecfccb 100%)",
                flexShrink: 0,
              }}
            />
          </div>
        )}

        <div style={{ padding: "28px 28px 32px" }}>
          <h1 style={{ textAlign: "center", fontSize: "26px", fontWeight: 700, margin: "0 0 8px", color: "#111827" }}>
           Payroll Receipt
          </h1>
          <p style={{ textAlign: "center", fontSize: "13px", color: "#4b5563", margin: "0 0 20px" }}>
            Pay Period: {formatDateLong(record.period_start)} — {formatDateLong(record.period_end)}
            <span style={{ margin: "0 8px", color: "#9ca3af" }}>|</span>
            Pay Date: {formatDateLong(record.period_end)}
          </p>

          {organization !== "petrosphere" && (
            <p style={{ textAlign: "center", fontSize: "13px", fontWeight: 600, margin: "0 0 24px", color: "#374151" }}>
              {brand.companyLine}
              <span style={{ fontWeight: 400, color: "#6b7280" }}> · {brand.addressLine}</span>
            </p>
          )}

          <div style={{ marginBottom: "28px", paddingBottom: "20px", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700 }}>
              {empName}
              {record.position ? <span style={{ fontWeight: 500, color: "#6b7280" }}> · {record.position}</span> : null}
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>
              <span style={{ fontWeight: 600 }}>Employee ID:</span> {empCode}
              {record.department ? (
                <>
                  <span style={{ margin: "0 12px", color: "#d1d5db" }}>|</span>
                  <span style={{ fontWeight: 600 }}>Department:</span> {record.department}
                </>
              ) : null}
              {record.pay_type ? (
                <>
                  <span style={{ margin: "0 12px", color: "#d1d5db" }}>|</span>
                  <span style={{ fontWeight: 600 }}>Pay type:</span> {record.pay_type}
                </>
              ) : null}
            </p>
          </div>

          <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px", color: "#111827" }}>Earnings</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
            <thead>
              <tr>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "left" }}>Description</th>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "center", width: "100px" }}>Hours</th>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "right", width: "110px" }}>Pay Rate</th>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "right", width: "130px" }}>Current Pay</th>
              </tr>
            </thead>
            <tbody>
              {earningsRows.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...cellBorder, backgroundColor: "#fafafa" }}>{row.label}</td>
                  <td style={{ ...cellBorder, textAlign: "center", color: "#6b7280" }}>—</td>
                  <td style={{ ...cellBorder, textAlign: "right", color: "#6b7280" }}>—</td>
                  <td style={{ ...cellBorder, textAlign: "right", fontWeight: 500 }}>{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ ...cellBorder, fontWeight: 700, backgroundColor: "#f3f4f6" }}>
                  Gross Pay
                </td>
                <td style={{ ...cellBorder, textAlign: "right", fontWeight: 700, backgroundColor: "#f3f4f6" }}>
                  {formatCurrency(grossPay)}
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px", color: "#111827" }}>Deductions</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
            <thead>
              <tr>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "left" }}>Deductions</th>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "right", width: "140px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {deductionRows.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...cellBorder, backgroundColor: "#fafafa" }}>{row.label}</td>
                  <td style={{ ...cellBorder, textAlign: "right", fontWeight: 500 }}>{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...cellBorder, fontWeight: 700, backgroundColor: "#f3f4f6" }}>Total Deductions</td>
                <td style={{ ...cellBorder, textAlign: "right", fontWeight: 700, backgroundColor: "#f3f4f6" }}>
                  {formatCurrency(record.total_deductions)}
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px", color: "#111827" }}>Net Pay</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px" }}>
            <thead>
              <tr>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "left" }}>Net Pay</th>
                <th style={{ ...theadStyle, ...cellBorder, textAlign: "right", width: "160px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cellBorder, fontWeight: 700, backgroundColor: "#fefce8" }}>Net Pay (take-home)</td>
                <td style={{ ...cellBorder, textAlign: "right", fontWeight: 700, fontSize: "16px", backgroundColor: "#fefce8" }}>
                  {formatCurrency(netPay)}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", color: "#4b5563" }}>
              <span style={{ fontWeight: 600 }}>Payroll status:</span> {record.status}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#ffffff" }}>
                <QRCodeSVG
                  value={`VALIDATION DATA:\nName: ${empName}\nEmployee ID: ${empCode}\nCompany: ${brand.qrCompany}`}
                  size={96}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#374151" }}>VALIDATION QR</span>
            </div>
          </div>

          <div style={{ textAlign: "center", fontSize: "11px", color: "#6b7280", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
            <p style={{ margin: "0 0 4px" }}>This is a computer-generated earnings statement and does not require a signature.</p>
            <p style={{ margin: 0 }}>Generated on {new Date().toLocaleDateString("en-PH")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function downloadPayrollReceiptPng(exportRootId: string, filenameBase: string) {
  const html2canvas = (await import("html2canvas")).default
  const element = document.getElementById(exportRootId)
  if (!element) throw new Error("Receipt not found")

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    logging: false,
    useCORS: true,
    allowTaint: true,
  })

  const link = document.createElement("a")
  link.download = `${filenameBase}.jpg`
  link.href = canvas.toDataURL("image/jpeg", 0.92)
  link.click()
}
