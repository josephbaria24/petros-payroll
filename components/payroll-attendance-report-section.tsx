"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/lib/toast"
import {
  compilePayrollAttendanceReport,
  loadPayrollReportPayload,
  fetchReportEmployeeList,
  filterPayloadToEmployeeIds,
  generatePayrollAttendancePdf,
  buildChartBundle,
  DEFAULT_CHART_SELECTION,
  DEFAULT_CHART_STYLES,
  type PayrollFrequency,
  type ReportEmployeeOption,
  type ChartSelection,
  type ChartStyleSelection,
  type EmployeeSeriesChartKind,
  type AttendanceChartKind,
  type OvertimeChartKind,
  type DeductionChartKind,
} from "@/lib/payroll-report"
import { FileJson, FileDown, Loader2, Users, BarChart3 } from "lucide-react"

function orgKey(org: string | null): "petrosphere" | "pdn" {
  return org === "pdn" ? "pdn" : "petrosphere"
}

export function PayrollAttendanceReportSection() {
  const { activeOrganization } = useOrganization()
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [frequency, setFrequency] = useState<PayrollFrequency>("monthly")
  const [extraHolidays, setExtraHolidays] = useState("")
  const [loading, setLoading] = useState(false)
  const [lastJson, setLastJson] = useState<string | null>(null)

  const [employeeList, setEmployeeList] = useState<ReportEmployeeOption[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [chartSelection, setChartSelection] = useState<ChartSelection>(() => ({ ...DEFAULT_CHART_SELECTION }))
  const [chartStyles, setChartStyles] = useState<ChartStyleSelection>(() => ({ ...DEFAULT_CHART_STYLES }))

  const chartRows: {
    key: keyof ChartSelection
    label: string
    styleKey: keyof ChartStyleSelection
    kind: "employeeSeries" | "attendance" | "overtime" | "deduction"
  }[] = [
    { key: "hoursBar", label: "Total working hours", styleKey: "hours", kind: "employeeSeries" },
    { key: "netPayBar", label: "Net pay", styleKey: "netPay", kind: "employeeSeries" },
    { key: "attendanceDonut", label: "Attendance mix", styleKey: "attendance", kind: "attendance" },
    { key: "overtimeGrouped", label: "Overtime hours vs OT pay", styleKey: "overtime", kind: "overtime" },
    { key: "deductionsBar", label: "Deductions", styleKey: "deductions", kind: "deduction" },
    { key: "tardinessBars", label: "Tardiness (minutes)", styleKey: "tardiness", kind: "employeeSeries" },
  ]

  const setChartFlag = useCallback((key: keyof ChartSelection, checked: boolean) => {
    setChartSelection((prev) => ({ ...prev, [key]: checked }))
  }, [])

  const setStyle = useCallback(<K extends keyof ChartStyleSelection>(k: K, v: ChartStyleSelection[K]) => {
    setChartStyles((prev) => ({ ...prev, [k]: v }))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      const rows = await fetchReportEmployeeList(supabase, orgKey(activeOrganization))
      if (cancelled) return
      setEmployeeList(rows)
      setSelectedIds(new Set(rows.map((r) => r.id)))
      setListLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrganization])

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return employeeList
    return employeeList.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.employee_code && e.employee_code.toLowerCase().includes(q))
    )
  }, [employeeList, employeeSearch])

  const selectedCount = selectedIds.size
  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const selectAllInList = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredEmployees.forEach((e) => next.add(e.id))
      return next
    })
  }, [filteredEmployees])

  const deselectAllInList = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredEmployees.forEach((e) => next.delete(e.id))
      return next
    })
  }, [filteredEmployees])

  const selectAllEmployees = useCallback(() => {
    setSelectedIds(new Set(employeeList.map((e) => e.id)))
  }, [employeeList])

  const clearAllEmployees = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const runReport = async () => {
    const ps = new Date(periodStart + "T12:00:00")
    const pe = new Date(periodEnd + "T12:00:00")
    if (pe < ps) {
      toast.error("End date must be on or after start date.")
      return
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one employee to include in the report.")
      return
    }
    if (!Object.values(chartSelection).some(Boolean)) {
      toast.error("Select at least one chart to include in the PDF.")
      return
    }
    setLoading(true)
    try {
      const loaded = await loadPayrollReportPayload({
        supabase,
        organization: orgKey(activeOrganization),
        periodStart: ps,
        periodEnd: pe,
        extraHolidayRaw: extraHolidays,
      })
      const filtered = filterPayloadToEmployeeIds(loaded, Array.from(selectedIds))
      if (filtered.employees.length === 0) {
        toast.error("No matching employees in the current data. Adjust your selection.")
        return
      }
      const report = compilePayrollAttendanceReport(filtered, ps, pe, frequency)
      setLastJson(JSON.stringify(report, null, 2))
      const org = orgKey(activeOrganization)
      const charts = buildChartBundle(report, org, chartSelection, chartStyles)
      generatePayrollAttendancePdf(report, charts, chartSelection)
      toast.success("PDF report generated.")
    } catch (e: unknown) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to build report.")
    } finally {
      setLoading(false)
    }
  }

  const downloadJson = () => {
    if (!lastJson) {
      toast.error("Generate a report first.")
      return
    }
    const blob = new Blob([lastJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll_attendance_${periodStart}_${periodEnd}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="border border-border shadow-sm bg-card overflow-hidden">
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Payroll &amp; attendance PDF</h3>
            <p className="text-[10px] text-muted-foreground max-w-xl">
              Builds a cutoff-aligned summary from payroll records, attendance logs, time sheets, approved overtime
              requests, and holiday calendars. Weekends and holidays are excluded from working-day counts.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Period start</Label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Period end</Label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payroll frequency (labels)</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as PayrollFrequency)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="semi-monthly">Semi-monthly (15-day)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              className="h-9 flex-1 text-xs"
              disabled={loading || listLoading}
              onClick={runReport}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
              Generate PDF
            </Button>
            <Button type="button" variant="outline" className="h-9 text-xs" disabled={!lastJson} onClick={downloadJson}>
              <FileJson className="h-3.5 w-3.5 mr-1" />
              JSON
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-semibold">Charts to include in PDF</Label>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Petrosphere uses navy (#00044a) and gold (#ffb800); Palawan Daily News uses navy (#0f1c43) and orange (#f15822).
            Choose bar, line, or area (where available). Uncheck to omit a chart.
          </p>
          <div className="space-y-1.5">
            {chartRows.map((co) => (
              <div
                key={co.key}
                className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-background px-2 py-1.5 hover:bg-muted/40"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={chartSelection[co.key]}
                    onCheckedChange={(c) => setChartFlag(co.key, c === true)}
                  />
                  <span className="text-[11px] leading-snug text-foreground">{co.label}</span>
                </label>
                {co.kind === "employeeSeries" && (
                  <Select
                    value={chartStyles[co.styleKey] as EmployeeSeriesChartKind}
                    onValueChange={(v) => setStyle(co.styleKey, v as EmployeeSeriesChartKind)}
                  >
                    <SelectTrigger className="h-7 w-[108px] shrink-0 text-[10px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {co.kind === "attendance" && (
                  <Select
                    value={chartStyles[co.styleKey] as AttendanceChartKind}
                    onValueChange={(v) => setStyle(co.styleKey, v as AttendanceChartKind)}
                  >
                    <SelectTrigger className="h-7 w-[118px] shrink-0 text-[10px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rings">Activity rings</SelectItem>
                      <SelectItem value="donut">Donut</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {co.kind === "overtime" && (
                  <Select
                    value={chartStyles[co.styleKey] as OvertimeChartKind}
                    onValueChange={(v) => setStyle(co.styleKey, v as OvertimeChartKind)}
                  >
                    <SelectTrigger className="h-7 w-[128px] shrink-0 text-[10px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="groupedBar">Grouped bars</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {co.kind === "deduction" && (
                  <Select
                    value={chartStyles[co.styleKey] as DeductionChartKind}
                    onValueChange={(v) => setStyle(co.styleKey, v as DeductionChartKind)}
                  >
                    <SelectTrigger className="h-7 w-[138px] shrink-0 text-[10px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stackedBar">Stacked (Late/Abs/Other)</SelectItem>
                      <SelectItem value="bar">Total bar</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-semibold">Employees to include</Label>
              <span className="text-[10px] text-muted-foreground">
                ({selectedCount} of {employeeList.length} selected)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px]" onClick={selectAllEmployees}>
                Select all
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px]" onClick={clearAllEmployees}>
                Clear all
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={selectAllInList}>
                Add filtered
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={deselectAllInList}>
                Remove filtered
              </Button>
            </div>
          </div>
          <Input
            className="h-8 text-xs"
            placeholder="Search by name or employee code…"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
          {listLoading ? (
            <p className="text-[10px] text-muted-foreground py-4 text-center">Loading employees…</p>
          ) : employeeList.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-2">No active employees found.</p>
          ) : (
            <div className="max-h-[220px] overflow-y-auto rounded border border-border/60 bg-background p-2 space-y-1.5 pr-1">
              {filteredEmployees.map((emp) => (
                <label
                  key={emp.id}
                  className="flex items-start gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedIds.has(emp.id)}
                    onCheckedChange={(c) => toggleOne(emp.id, c === true)}
                  />
                  <span className="text-xs leading-snug">
                    <span className="font-medium text-foreground">{emp.full_name}</span>
                    {emp.employee_code ? (
                      <span className="text-muted-foreground"> · {emp.employee_code}</span>
                    ) : null}
                  </span>
                </label>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">No names match your search.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Extra holidays (optional, yyyy-MM-dd, one per line)</Label>
          <Textarea
            className="min-h-[56px] text-xs font-mono"
            placeholder={"2026-12-25\n2026-12-30"}
            value={extraHolidays}
            onChange={(e) => setExtraHolidays(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
