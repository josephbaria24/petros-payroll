import type { OrganizationKey } from "./types"

/**
 * Aligns with app/payroll/generate/page.tsx — merge biometric + manual time_logs.
 */
export function mergeLogsForReport(
  organization: OrganizationKey,
  logsData: any[] | null,
  manualLogs: any[] | null
): any[] {
  let allLogs = logsData || []
  if (organization !== "pdn") {
    const formattedManual: any[] = []
    manualLogs?.forEach((m) => {
      let pushed = false
      if (m.time_in) {
        formattedManual.push({
          id: m.id,
          employee_id: m.employee_id,
          work_date: m.date,
          timestamp: `${m.date}T${m.time_in}:00+00:00`,
          status: "time_in",
          is_manual: true,
          mapped_status: m.status,
        })
        pushed = true
      }
      if (m.time_out) {
        formattedManual.push({
          id: m.id,
          employee_id: m.employee_id,
          work_date: m.date,
          timestamp: `${m.date}T${m.time_out}:00+00:00`,
          status: "time_out",
          is_manual: true,
          mapped_status: m.status,
        })
        pushed = true
      }
      if (!pushed && m.status) {
        formattedManual.push({
          id: m.id,
          employee_id: m.employee_id,
          work_date: m.date,
          timestamp: null,
          status: "manual_override",
          is_manual: true,
          mapped_status: m.status,
        })
      }
    })
    allLogs = [...allLogs, ...formattedManual]
  } else {
    const pdnVirtualLogs: any[] = []
    logsData?.forEach((cl) => {
      let pushed = false
      if (cl.timestamp) {
        pdnVirtualLogs.push({ ...cl, status: "time_in", mapped_status: cl.status })
        pushed = true
      }
      if (cl.timeout) {
        pdnVirtualLogs.push({ ...cl, timestamp: cl.timeout, status: "time_out", mapped_status: cl.status })
        pushed = true
      }
      if (!pushed && cl.status) {
        pdnVirtualLogs.push({ ...cl, mapped_status: cl.status })
      }
    })
    allLogs = pdnVirtualLogs
  }
  return allLogs
}
