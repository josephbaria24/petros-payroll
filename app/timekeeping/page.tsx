"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useHoliday } from "@/contexts/HolidayContext"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CalendarIcon,
  Clock,
  Users,
  TrendingUp,
  Plus,
  Timer,
  PanelRightOpen,
  PanelRightClose,
  ChevronRight,
  Activity,
  BarChart3,
  MoreVertical,
  Trash2
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useProtectedPage } from "../hooks/useProtectedPage"
import confetti from "canvas-confetti"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"

type TimeLog = {
  id: string
  employee_id: string
  employee_name?: string
  date: string
  time_in: string | null
  time_out: string | null
  time_in_display?: string
  time_out_display?: string
  total_hours: number
  overtime_hours: number
  status: string
  in_id?: string
  out_id?: string
}

// Helper function to extract Philippine time from ZKT timestamp
// Uses literal string parsing to avoid shifts for 'fake UTC' biometric data
function extractPhilippineTime(timestamp: string): string {
  if (!timestamp || !timestamp.includes('T')) return "";
  // Taking the HH:mm part literally from the timestamp string
  return timestamp.split('T')[1].substring(0, 5);
}

// Helper function to extract Philippine date from ZKT timestamp
function extractPhilippineDate(timestamp: string): string {
  if (!timestamp) return "";
  return timestamp.split('T')[0];
}

// Helper function to format HH:mm to 12-hour AM/PM for display
function formatTo12Hour(timeStr: string | null): string {
  if (!timeStr || timeStr === "-" || timeStr === "") return "-";
  try {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]);
    const m = parts[1].substring(0, 2);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    return `${displayHours}:${m} ${ampm}`;
  } catch (e) {
    return "-";
  }
}

// Helper to convert HH:mm (24h) to 12h parts
function splitTo12HourParts(timeStr: string | null) {
  if (!timeStr || timeStr === "-" || timeStr === "") return { hour: "08", minute: "00", period: "AM" };
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const m = minutes.substring(0, 2);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHours = (h % 12 || 12).toString().padStart(2, '0');
    return { hour: displayHours, minute: m, period };
  } catch (e) {
    return { hour: "08", minute: "00", period: "AM" };
  }
}

// Helper to convert 12h parts back to HH:mm (24h)
function joinTo24Hour(hour: string, minute: string, period: string): string {
  let h = parseInt(hour);
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

const VisualTimePicker = ({
  value,
  onChange,
  label
}: {
  value: string | null;
  onChange: (val: string) => void;
  label: string
}) => {
  const { hour, minute, period } = splitTo12HourParts(value);

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Select value={hour} onValueChange={(h) => onChange(joinTo24Hour(h, minute, period))}>
          <SelectTrigger className="w-full h-10 text-xs font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground font-bold px-0.5">:</span>
        <Select value={minute} onValueChange={(m) => onChange(joinTo24Hour(hour, m, period))}>
          <SelectTrigger className="w-full h-10 text-xs font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(p) => onChange(joinTo24Hour(hour, minute, p))}>
          <SelectTrigger className="w-full h-10 text-xs font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1']

export default function TimekeepingPage() {
  useProtectedPage(["admin", "hr"], "timekeeping")
  const { activeOrganization } = useOrganization()
  const { refreshHolidays } = useHoliday()
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<TimeLog | null>(null)
  const [showTardinessNames, setShowTardinessNames] = useState(false)

  const [form, setForm] = useState({
    employee_id: "",
    date: "",
    time_in: "",
    time_out: "",
    status: "Present",
  })
  const [employees, setEmployees] = useState<{ id: string; full_name: string; attendance_log_userid?: number | null }[]>([])

  const isMobile = useIsMobile()
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchLogs(selectedDate || new Date()),
        fetchEmployees()
      ])
      setLoading(false)
    }
    loadData()
  }, [selectedDate, activeOrganization])

  // Responsive panel: Close logs by default on mobile
  useEffect(() => {
    if (isMobile) {
      setPanelOpen(false)
    } else {
      setPanelOpen(true)
    }
  }, [isMobile])

  // Helper functions for logic reuse (Range Exports & Daily View)
  function processRawLogsForOrg(org: string, logsData: any[], employeesData: any[], fallbackDateStr: string) {
    if (org === "pdn") {
      const enrichedLogs: TimeLog[] = []

      employeesData.forEach(emp => {
        const empLogs = (logsData || []).filter((log: any) => (log.employee_id === emp.id || log.full_name === emp.full_name))

        if (empLogs.length > 0) {
          empLogs.forEach((log: any) => {
            const timeInUTC = log.timestamp ? new Date(log.timestamp) : null
            const timeOutUTC = log.timeout ? new Date(log.timeout) : null
            const timeInPH = log.timestamp ? extractPhilippineTime(log.timestamp) : null
            const timeOutPH = log.timeout ? extractPhilippineTime(log.timeout) : null
            const totalHours = timeInUTC && timeOutUTC ? (timeOutUTC.getTime() - timeInUTC.getTime()) / (1000 * 60 * 60) : 0

            enrichedLogs.push({
              id: log.id.toString(),
              employee_id: emp.id,
              employee_name: emp.full_name,
              date: log.work_date || fallbackDateStr,
              time_in: timeInPH,
              time_out: timeOutPH,
              time_in_display: formatTo12Hour(timeInPH),
              time_out_display: formatTo12Hour(timeOutPH),
              total_hours: Math.round(totalHours * 100) / 100,
              overtime_hours: totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0,
              status: log.status || "Present",
              in_id: log.id.toString(),
              out_id: log.id.toString(),
            })
          })
        } else {
          // No logs for this employee
          // Determine status based on permanent flags, weekend, or current time
          const now = new Date()
          const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
          const phHour = phTime.getHours()
          const isToday = fallbackDateStr === format(phTime, "yyyy-MM-dd")

          // Weekend detection
          const [y, m, d_num] = fallbackDateStr.split("-").map(Number)
          const dateObj = new Date(y, m - 1, d_num)
          const dayOfWeek = dateObj.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

          let defaultStatus = isWeekend ? "Weekend" : "Absent"
          let defaultHours = 0

          // Permanent status only apply to weekdays
          if (!isWeekend) {
            if (emp.is_remote) {
              defaultStatus = "Remote"
              defaultHours = 8
            } else if (emp.is_wfh) {
              defaultStatus = "Work From Home"
              defaultHours = 8
            } else if (isToday && phHour < 11) {
              defaultStatus = "Late"
            }
          }

          enrichedLogs.push({
            id: `missing-${emp.id}`,
            employee_id: emp.id,
            employee_name: emp.full_name,
            date: fallbackDateStr,
            time_in: null,
            time_out: null,
            time_in_display: "-",
            time_out_display: "-",
            total_hours: defaultHours,
            overtime_hours: 0,
            status: defaultStatus,
          })
        }
      })
      return enrichedLogs
    } else {
      const userGroups: Record<number, any[]> = {}
      logsData.forEach((log) => {
        if (!userGroups[log.user_id]) userGroups[log.user_id] = []
        userGroups[log.user_id].push(log)
      })

      const enrichedLogs: TimeLog[] = []

      employeesData.forEach(emp => {
        const userId = emp.attendance_log_userid
        const userLogs = userId ? userGroups[userId] : []
        const empName = emp.full_name
        const empId = emp.id

        if (userLogs && userLogs.length > 0) {
          let currentIn: any = null
          const processSession = (inEv: any | null, outEv: any | null) => {
            const tInUTC = inEv ? new Date(inEv.timestamp) : null
            const tOutUTC = outEv ? new Date(outEv.timestamp) : null
            const tInPH = inEv ? extractPhilippineTime(inEv.timestamp) : null
            const tOutPH = outEv ? extractPhilippineTime(outEv.timestamp) : null
            const dPH = (inEv || outEv)?.work_date || fallbackDateStr
            const tHours = tInUTC && tOutUTC ? (tOutUTC.getTime() - tInUTC.getTime()) / (1000 * 60 * 60) : 0

            enrichedLogs.push({
              id: (inEv || outEv).id.toString(),
              employee_id: empId,
              employee_name: empName,
              date: dPH,
              time_in: tInPH,
              time_out: tOutPH,
              time_in_display: formatTo12Hour(tInPH),
              time_out_display: formatTo12Hour(tOutPH),
              total_hours: Math.round(tHours * 100) / 100,
              overtime_hours: tHours > 8 ? Math.round((tHours - 8) * 100) / 100 : 0,
              status: outEv ? "time_out" : "time_in",
              in_id: inEv?.id?.toString(),
              out_id: outEv?.id?.toString(),
            })
          }

          userLogs.forEach((log) => {
            if (log.status === "time_in") {
              if (currentIn) processSession(currentIn, null)
              currentIn = log
            } else if (log.status === "time_out") {
              if (currentIn) { processSession(currentIn, log); currentIn = null }
              else processSession(null, log)
            }
          })
          if (currentIn) processSession(currentIn, null)
        } else {
          // No biometric logs
          const now = new Date()
          const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
          const phHour = phTime.getHours()
          const isToday = fallbackDateStr === format(phTime, "yyyy-MM-dd")

          // Weekend detection
          const [y, m, d_num] = fallbackDateStr.split("-").map(Number)
          const dateObj = new Date(y, m - 1, d_num)
          const dayOfWeek = dateObj.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

          let defaultStatus = isWeekend ? "Weekend" : "Absent"
          let defaultHours = 0

          // Permanent status only apply to weekdays (Mo-Fr)
          if (!isWeekend) {
            if (emp.is_remote) {
              defaultStatus = "Remote"
              defaultHours = 8
            } else if (emp.is_wfh) {
              defaultStatus = "Work From Home"
              defaultHours = 8
            } else if (isToday && phHour < 11) {
              defaultStatus = "Late"
            }
          }

          enrichedLogs.push({
            id: `missing-${empId}`,
            employee_id: empId,
            employee_name: empName,
            date: fallbackDateStr,
            time_in: null,
            time_out: null,
            time_in_display: "-",
            time_out_display: "-",
            total_hours: defaultHours,
            overtime_hours: 0,
            status: defaultStatus,
          })
        }
      })
      return enrichedLogs
    }
  }

  async function fetchLogsInRange(start: string, end: string) {
    if (activeOrganization === "pdn") {
      const { data: logsData } = await supabase.from("pdn_attendance_logs").select("*").gte("work_date", start).lte("work_date", end).order("timestamp", { ascending: true })
      const { data: empData } = await supabase.from("pdn_employees").select("id, full_name, employment_status, is_remote, is_wfh").neq("employment_status", "Inactive")
      return processRawLogsForOrg("pdn", logsData || [], empData || [], start)
    } else {
      const [{ data: logsData }, { data: empData }, { data: manualLogs }] = await Promise.all([
        supabase.from("attendance_logs").select("*").gte("work_date", start).lte("work_date", end).order("timestamp", { ascending: true }),
        supabase.from("employees").select("id, full_name, attendance_log_userid, employment_status, is_remote, is_wfh").neq("employment_status", "Inactive"),
        supabase.from("time_logs").select("*").gte("date", start).lte("date", end)
      ])

      const rawEnriched = processRawLogsForOrg("petrosphere", logsData || [], empData || [], start)

      // Properly apply manual overrides from time_logs
      const overrideMap = new Map()
      manualLogs?.forEach(mLog => {
        overrideMap.set(mLog.employee_id, mLog)
      })

      const finalLogs: any[] = []
      const processedEmpIds = new Set()

      rawEnriched.forEach(log => {
        const mLog = overrideMap.get(log.employee_id)
        if (mLog) {
          if (!processedEmpIds.has(log.employee_id)) {
            finalLogs.push({
              id: mLog.id.toString(),
              employee_id: mLog.employee_id,
              employee_name: log.employee_name,
              date: mLog.date,
              time_in: mLog.time_in,
              time_out: mLog.time_out,
              time_in_display: formatTo12Hour(mLog.time_in),
              time_out_display: formatTo12Hour(mLog.time_out),
              total_hours: mLog.total_hours || 0,
              overtime_hours: mLog.overtime_hours || 0,
              status: mLog.status || "Present",
            })
            processedEmpIds.add(log.employee_id)
          }
        } else {
          finalLogs.push(log)
        }
      })

      return finalLogs
    }
  }

  async function fetchLogs(date: Date = new Date()) {
    const dateStr = format(date, "yyyy-MM-dd")
    const logsData = await fetchLogsInRange(dateStr, dateStr)
    setLogs(logsData.sort((a, b) => (b.time_in || b.time_out || "00:00").localeCompare(a.time_in || a.time_out || "00:00")))
  }

  async function fetchEmployees() {
    if (activeOrganization === "pdn") {
      const { data, error } = await supabase.from("pdn_employees").select("id, full_name, employment_status, is_remote, is_wfh").neq("employment_status", "Inactive")
      if (error) {
        console.error("Error fetching PDN employees:", error)
        return
      }
      setEmployees(data || [])
      return
    }

    const { data, error } = await supabase.from("employees").select("id, full_name, attendance_log_userid, employment_status, is_remote, is_wfh").neq("employment_status", "Inactive")
    if (error) {
      console.error(error)
      return
    }
    setEmployees(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Saving time log...")

    if (activeOrganization === "pdn") {
      const toastId2 = toast.loading("Saving time log...")
      const { error } = await supabase.from("pdn_attendance_logs").insert({
        employee_id: form.employee_id,
        work_date: form.date,
        // Using +00:00 to match biometric record format and prevent shifts
        timestamp: form.time_in ? `${form.date}T${form.time_in}:00+00:00` : new Date().toISOString(),
        timeout: form.time_out ? `${form.date}T${form.time_out}:00+00:00` : null,
        status: form.status,
        full_name: employees.find(emp => emp.id === form.employee_id)?.full_name || "",
      })

      if (error) {
        toast.error("Error saving log", { id: toastId2 })
      } else {
        toast.success(`Time log saved: ${formatTo12Hour(form.time_in)} - ${formatTo12Hour(form.time_out)}`, { id: toastId2 })
        setOpen(false)
        resetForm()
        fetchLogs(selectedDate)
      }
      return
    }

    const { error } = await supabase.from("time_logs").insert({
      employee_id: form.employee_id,
      date: form.date,
      time_in: form.time_in || null,
      time_out: form.time_out || null,
      status: form.status,
    })

    if (error) {
      toast.error("Error saving log", { id: toastId })
    } else {
      toast.success(`Time log saved: ${formatTo12Hour(form.time_in)} - ${formatTo12Hour(form.time_out)}`, { id: toastId })
      setOpen(false)
      resetForm()
      fetchLogs(selectedDate)
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLog) return

    const toastId = toast.loading("Updating time log...")

    try {
      if (activeOrganization === "pdn") {
        const { error } = await supabase
          .from("pdn_attendance_logs")
          .update({
            // Using +00:00 to match biometric record format and prevent shifts
            timestamp: form.time_in ? `${form.date}T${form.time_in}:00+00:00` : null,
            timeout: form.time_out ? `${form.date}T${form.time_out}:00+00:00` : null,
            work_date: form.date,
            status: form.time_out ? "time_out" : "time_in"
          })
          .eq("id", selectedLog.in_id)

        if (error) throw error
      } else {
        // Petrosphere: Non-PDN regular logs
        // We ALWAYS route edits to time_logs as overrides instead of mutating native biometric logs

        const { data: existingLog } = await supabase
          .from("time_logs")
          .select("id")
          .eq("date", form.date)
          .eq("employee_id", form.employee_id)
          .maybeSingle()

        if (existingLog) {
          const { error: updateErr } = await supabase
            .from("time_logs")
            .update({
              time_in: form.time_in || null,
              time_out: form.time_out || null,
              status: form.status,
              total_hours: ["On Leave", "Work From Home", "Remote"].includes(form.status) ? 8 : 0
            })
            .eq("id", existingLog.id)
          if (updateErr) throw updateErr
        } else {
          const { error: insertErr } = await supabase
            .from("time_logs")
            .insert({
              employee_id: form.employee_id,
              date: form.date,
              time_in: form.time_in || null,
              time_out: form.time_out || null,
              status: form.status,
              total_hours: ["On Leave", "Work From Home", "Remote"].includes(form.status) ? 8 : 0
            })
          if (insertErr) throw insertErr
        }
      }

      toast.success(`Time log updated: ${formatTo12Hour(form.time_in)} - ${formatTo12Hour(form.time_out)}`, { id: toastId })
      setEditOpen(false)
      resetForm()
      fetchLogs(selectedDate)
    } catch (err: any) {
      console.error("Error updating log:", err)
      toast.error(err.message || "Error updating log", { id: toastId })
    }
  }

  async function handleDeleteLog(log: TimeLog) {
    if (log.id.startsWith("missing-")) {
      toast.error("Cannot delete a placeholder log.")
      return
    }

    if (!confirm("Are you sure you want to delete this log?")) return

    const toastId = toast.loading("Deleting log...")

    try {
      if (activeOrganization === "pdn") {
        const { error } = await supabase.from("pdn_attendance_logs").delete().eq("id", log.id)
        if (error) throw error
      } else {
        const deletePromises = []

        // Try deleting from time_logs
        deletePromises.push(supabase.from("time_logs").delete().eq("id", log.id))

        // Try deleting from attendance_logs, ignore type mismatch if id is a uuid
        deletePromises.push(supabase.from("attendance_logs").delete().eq("id", log.id).then(({ error }) => {
          if (error && error.code !== "22P02") throw error; // ignore invalid input syntax
        }))

        if (log.in_id) {
          deletePromises.push(supabase.from("time_logs").delete().eq("id", log.in_id))
          deletePromises.push(supabase.from("attendance_logs").delete().eq("id", log.in_id).then(({ error }) => {
            if (error && error.code !== "22P02") throw error;
          }))
        }

        if (log.out_id && log.out_id !== log.in_id) {
          deletePromises.push(supabase.from("time_logs").delete().eq("id", log.out_id))
          deletePromises.push(supabase.from("attendance_logs").delete().eq("id", log.out_id).then(({ error }) => {
            if (error && error.code !== "22P02") throw error;
          }))
        }

        await Promise.all(deletePromises)
      }

      toast.success("Log deleted successfully", { id: toastId })
      fetchLogs(selectedDate)
    } catch (err: any) {
      console.error("Detailed Error deleting log:", err)
      const errorMessage = err?.message || "Failed to delete log"
      toast.error(errorMessage, { id: toastId })
    }
  }

  async function handleSetStatus(employeeId: string, status: string, mode: 'single' | 'permanent' = 'single') {
    const dateStr = format(selectedDate || new Date(), "yyyy-MM-dd")
    const toastId = toast.loading(`${mode === 'permanent' ? 'Setting permanent' : 'Setting'} status to ${status}...`)

    try {
      const isFullDayStatus = ["On Leave", "Work From Home", "Remote", "Holiday"].includes(status)
      const total_hours = isFullDayStatus ? 8 : 0

      // If permanent, update the employee record
      if (mode === 'permanent') {
        const isRemote = status === "Remote"
        const isWFH = status === "Work From Home"

        if (activeOrganization === "pdn") {
          const { error } = await supabase
            .from("pdn_employees")
            .update({ is_remote: isRemote, is_wfh: isWFH })
            .eq("id", employeeId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("employees")
            .update({ is_remote: isRemote, is_wfh: isWFH })
            .eq("id", employeeId)
          if (error) throw error
        }
      }

      if (activeOrganization === "pdn") {
        // PDN: Check if a log already exists for this date/employee
        const { data: existing } = await supabase
          .from("pdn_attendance_logs")
          .select("id")
          .eq("employee_id", employeeId)
          .eq("work_date", dateStr)
          .maybeSingle()

        if (existing) {
          const { error } = await supabase
            .from("pdn_attendance_logs")
            .update({ status, total_hours })
            .eq("id", existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("pdn_attendance_logs")
            .insert({
              employee_id: employeeId,
              work_date: dateStr,
              status,
              total_hours,
              full_name: employees.find(e => e.id === employeeId)?.full_name || "",
              timestamp: `${dateStr}T00:00:00+00:00` // Placeholder timestamp
            })
          if (error) throw error
        }
      } else {
        // Petrosphere: Use time_logs
        const { data: existing } = await supabase
          .from("time_logs")
          .select("id")
          .eq("employee_id", employeeId)
          .eq("date", dateStr)
          .maybeSingle()

        if (existing) {
          const { error } = await supabase
            .from("time_logs")
            .update({ status, total_hours })
            .eq("id", existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("time_logs")
            .insert({
              employee_id: employeeId,
              date: dateStr,
              status,
              total_hours
            })
          if (error) throw error
        }
      }

      toast.success(`${mode === 'permanent' ? 'Permanent status' : 'Status'} updated to ${status}`, { id: toastId })
      fetchLogs(selectedDate)
      if (mode === 'permanent') fetchEmployees() // Refresh employee flags
    } catch (err: any) {
      console.error("Detailed Error setting status:", {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code,
        error: err
      })
      const errorMessage = err.details || err.message || "Error setting status"
      toast.error(errorMessage, { id: toastId })
    }
  }

  async function handleMarkAllAsHoliday() {
    if (!selectedDate) return
    const dateStr = format(selectedDate, "yyyy-MM-dd")

    if (!window.confirm(`Are you sure you want to mark ALL employees as Holiday for ${format(selectedDate, "MMM dd, yyyy")}? This cannot be undone easily.`)) {
      return
    }

    const toastId = toast.loading("Marking all employees as Holiday...")

    try {
      if (activeOrganization === "pdn") {
        const { data: existingLogs } = await supabase
          .from("pdn_attendance_logs")
          .select("id, employee_id")
          .eq("work_date", dateStr)

        const existingMap = new Map((existingLogs || []).map(l => [l.employee_id, l.id]))

        const toInsert: any[] = []
        const toUpdate: any[] = []

        employees.forEach(emp => {
          const baseLog = {
            employee_id: emp.id,
            work_date: dateStr,
            status: "Holiday",
            total_hours: 8,
            full_name: emp.full_name,
            timestamp: `${dateStr}T00:00:00+00:00`
          }
          if (existingMap.has(emp.id)) {
            toUpdate.push({ ...baseLog, id: existingMap.get(emp.id) })
          } else {
            toInsert.push(baseLog)
          }
        })

        if (toInsert.length > 0) {
          const { error } = await supabase.from("pdn_attendance_logs").insert(toInsert)
          if (error) throw error
        }

        if (toUpdate.length > 0) {
          const updatePromises = toUpdate.map(u =>
            supabase.from("pdn_attendance_logs").update({
              status: u.status,
              total_hours: u.total_hours
            }).eq("id", u.id)
          );
          const results = await Promise.all(updatePromises);
          const err = results.find(r => r.error);
          if (err) throw err.error;
        }

      } else {
        const { data: existingLogs } = await supabase
          .from("time_logs")
          .select("id, employee_id")
          .eq("date", dateStr)

        const existingMap = new Map((existingLogs || []).map(l => [l.employee_id, l.id]))

        const toInsert: any[] = []
        const toUpdate: any[] = []

        employees.forEach(emp => {
          const baseLog = {
            employee_id: emp.id,
            date: dateStr,
            status: "Holiday",
            total_hours: 8,
          }
          if (existingMap.has(emp.id)) {
            toUpdate.push({ ...baseLog, id: existingMap.get(emp.id) })
          } else {
            toInsert.push(baseLog)
          }
        })

        if (toInsert.length > 0) {
          const { error } = await supabase.from("time_logs").insert(toInsert)
          if (error) throw error
        }

        if (toUpdate.length > 0) {
          const updatePromises = toUpdate.map(u =>
            supabase.from("time_logs").update({
              status: u.status,
              total_hours: u.total_hours
            }).eq("id", u.id)
          );
          const results = await Promise.all(updatePromises);
          const err = results.find(r => r.error);
          if (err) throw err.error;
        }
      }

      toast.success("Successfully marked all as Holiday", { id: toastId })
      fetchLogs(selectedDate)
      refreshHolidays()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to mark as Holiday", { id: toastId })
    }
  }

  function resetForm() {
    setForm({
      employee_id: "",
      date: "",
      time_in: "",
      time_out: "",
      status: "Present"
    })
  }

  // ===== Analytics Data =====
  const presentCount = logs.filter(log => log.time_in && log.time_in !== "-").length
  const completedSessions = logs.filter(log => log.time_out && log.time_out !== "-")
  const totalHoursWorked = completedSessions.reduce((sum, log) => sum + log.total_hours, 0)
  const totalOvertime = completedSessions.reduce((sum, log) => sum + log.overtime_hours, 0)
  const avgHours = completedSessions.length > 0 ? totalHoursWorked / completedSessions.length : 0

  // Hours by employee (for bar chart)
  const hoursByEmployee = useMemo(() => {
    const map = new Map<string, { hours: number, status?: string }>()
    logs.forEach(log => {
      const name = log.employee_name || "Unknown"
      const current = map.get(name) || { hours: 0 }
      map.set(name, {
        hours: current.hours + log.total_hours,
        status: ["Remote", "On Leave", "Work From Home"].includes(log.status) ? log.status : current.status
      })
    })
    return Array.from(map)
      .map(([name, data]) => {
        let displayName = name.split(' ')[0]
        if (data.status === "Remote") displayName += " (REM)"
        else if (data.status === "On Leave") displayName += " (LV)"
        else if (data.status === "Work From Home") displayName += " (WFH)"

        return {
          name: displayName,
          hours: Math.round(data.hours * 100) / 100
        }
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
  }, [logs])

  // Status distribution (for pie chart)
  const statusDistribution = useMemo(() => {
    const completed = logs.filter(l => l.time_in && l.time_out && l.time_in !== "-" && l.time_out !== "-").length
    const inProgress = logs.filter(l => l.time_in && l.time_in !== "-" && (!l.time_out || l.time_out === "-")).length
    const result = []
    if (completed > 0) result.push({ name: "Completed", value: completed })
    if (inProgress > 0) result.push({ name: "In Progress", value: inProgress })
    return result
  }, [logs])

  // Hours trend over the day (hourly buckets)
  const hourlyTrend = useMemo(() => {
    const buckets: Record<string, number> = {}
    for (let h = 6; h <= 22; h++) {
      const label = `${h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`
      buckets[label] = 0
    }
    logs.forEach(log => {
      if (log.time_in && log.time_in !== "-") {
        const hour = parseInt(log.time_in.split(':')[0])
        const label = `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`
        if (buckets[label] !== undefined) buckets[label]++
      }
    })
    return Object.entries(buckets).map(([time, count]) => ({ time, count }))
  }, [logs])

  // Average Tardiness by employee (for bar chart)
  const tardinessByEmployee = useMemo(() => {
    const map = new Map<string, { totalLateMinutes: number, count: number }>()
    logs.forEach(log => {
      if (log.time_in && log.time_in !== "-") {
        const [h, m] = log.time_in.split(':').map(Number)
        const totalMinutes = h * 60 + m
        const standardStart = 8 * 60 // 08:00 AM standard start
        if (totalMinutes > standardStart) {
          const lateMinutes = totalMinutes - standardStart
          const name = log.employee_name || "Unknown"
          const current = map.get(name) || { totalLateMinutes: 0, count: 0 }
          map.set(name, {
            totalLateMinutes: current.totalLateMinutes + lateMinutes,
            count: current.count + 1
          })
        }
      }
    })
    return Array.from(map)
      .map(([name, data], idx) => ({
        full_name: name,
        name: name.split(' ')[0],
        mask: `Staff ${idx + 1}`,
        avgMinutes: Math.round(data.totalLateMinutes / data.count)
      }))
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .slice(0, 10)
  }, [logs])

  // Find the earliest log of the day (Earliest Bird)
  const earliestLog = useMemo(() => {
    const presentLogs = logs.filter(log => log.time_in && log.time_in !== "-");
    if (presentLogs.length === 0) return null;
    return presentLogs.reduce((earliest, current) => {
      const timeA = earliest.time_in || "99:99"
      const timeB = current.time_in || "99:99"
      return timeB < timeA ? current : earliest;
    });
  }, [logs]);

  // Trigger confetti when earliest bird is found
  useEffect(() => {
    if (earliestLog) {
      const duration = 2 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#f59e0b', '#fbbf24', '#fcd34d']
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#f59e0b', '#fbbf24', '#fcd34d']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [earliestLog?.id, selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-primary rounded-full animate-pulse"></div>
          <span className="text-muted-foreground">Loading timekeeping data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Main Content */}
      <div className={cn("transition-all duration-300 ease-in-out p-6 space-y-6", panelOpen ? "mr-[420px]" : "mr-0")}>
        {/* Earliest Bird Banner */}
        {earliestLog && (
          <div id="earliest-bird-banner" className="relative group bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 mb-6 overflow-hidden transition-all hover:shadow-lg hover:shadow-amber-500/5 border-l-4 border-l-amber-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Plus className="w-24 h-24 text-amber-500 rotate-12" />
            </div>
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                  <span className="text-3xl">🏆</span>
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-3">
                    Early Bird Achievement!
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/30 font-bold uppercase tracking-widest text-[10px]">
                      TOP PERFORMER
                    </Badge>
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    <span className="font-bold text-foreground">{earliestLog.employee_name}</span> timed in at <span className="font-bold text-amber-600 underline underline-offset-4 decoration-amber-500/30">{earliestLog.time_in_display}</span>. Good job! 🎉
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm border border-border px-4 py-2 rounded-xl">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Active Achievement</span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Timekeeping</h1>
            <p className="text-muted-foreground text-sm">
              Attendance analytics for {selectedDate ? format(selectedDate, "MMMM dd, yyyy") : "today"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 font-semibold">
                  <CalendarIcon className="h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MMM dd, yyyy") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex flex-col">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => setSelectedDate(date)}
                    initialFocus
                  />
                  <div className="p-3 border-t border-border">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs font-bold text-amber-600 bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 shadow-none border-none"
                      onClick={handleMarkAllAsHoliday}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Mark All as Holiday
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 font-semibold border-primary/20 hover:bg-primary/5 px-2 md:px-3"
              onClick={() => router.push("/reports?tab=payroll-attendance-pdf")}
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="hidden md:inline">Export Report</span>
            </Button>

            {/* Add Log Dialog */}
            <Dialog open={open} onOpenChange={(v) => {
              setOpen(v)
              if (!v) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 px-2 md:px-3">
                  <Plus className="w-4 h-4" />
                  <span className="hidden md:inline">Add Log</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Time Log</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(value) => setForm({ ...form, employee_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <VisualTimePicker
                      label="Time In"
                      value={form.time_in}
                      onChange={(val) => setForm({ ...form, time_in: val })}
                    />
                    <VisualTimePicker
                      label="Time Out"
                      value={form.time_out}
                      onChange={(val) => setForm({ ...form, time_out: val })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) => setForm({ ...form, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Present">Present</SelectItem>
                        <SelectItem value="Absent">Absent</SelectItem>
                        <SelectItem value="Late">Late</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Holiday">Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full">
                    Save Time Log
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Log Dialog */}
            <Dialog open={editOpen} onOpenChange={(v) => {
              setEditOpen(v)
              if (!v) {
                resetForm()
                setSelectedLog(null)
              }
            }}>
              <DialogContent className="lg:w-[30vw] w-[90vw]">
                <DialogHeader>
                  <DialogTitle>Edit Time Log</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(value) => setForm({ ...form, employee_id: value })}
                      required
                      disabled
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <VisualTimePicker
                      label="Time In"
                      value={form.time_in}
                      onChange={(val) => setForm({ ...form, time_in: val })}
                    />
                    <VisualTimePicker
                      label="Time Out"
                      value={form.time_out}
                      onChange={(val) => setForm({ ...form, time_out: val })}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Update Time Log
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Panel Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPanelOpen(!panelOpen)}
              className="gap-2 px-2 md:px-3"
            >
              {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              <span className="hidden md:inline">{panelOpen ? "Close" : "Logs"}</span>
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div id="summary-metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Present Today", value: presentCount.toString(), icon: Users, accent: "text-emerald-600", bg: "bg-emerald-500/10" },
            { label: "Total Hours", value: totalHoursWorked.toFixed(1) + "h", icon: Clock, accent: "text-blue-600", bg: "bg-blue-500/10" },
            { label: "Avg Hours", value: avgHours.toFixed(1) + "h", icon: TrendingUp, accent: "text-violet-600", bg: "bg-violet-500/10" },
            { label: "Overtime", value: totalOvertime.toFixed(1) + "h", icon: Timer, accent: "text-amber-600", bg: "bg-amber-500/10" },
          ].map((metric, i) => (
            <Card key={i} className="border border-border shadow-sm bg-card hover:shadow-md transition-all overflow-hidden group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{metric.label}</p>
                  <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center transition-all", metric.bg)}>
                    <metric.icon className={cn("h-4 w-4", metric.accent)} />
                  </div>
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Check-in Activity (Area Chart) */}
          <Card id="activity-chart" className="lg:col-span-2 border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Check-in Activity
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Number of check-ins by hour</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md border border-border">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground">Check-ins</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[240px] w-full">
                {hourlyTrend.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyTrend}>
                      <defs>
                        <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
                        dy={10}
                      />
                      <YAxis hide />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', color: 'var(--foreground)' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                        formatter={(value: any) => [value, 'Check-ins']}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorCheckins)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Activity className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">No activity data for this date</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attendance Status (Pie Chart) */}
          <Card id="status-chart" className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-bold text-foreground">Session Status</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Completed vs In Progress</p>
            </CardHeader>
            <CardContent className="flex flex-col pt-0">
              <div className="h-[180px] w-full mt-4">
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Clock className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">No sessions yet</p>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="space-y-2 mt-auto px-2 pb-2">
                {statusDistribution.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-muted-foreground font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hours by Employee Chart */}
        <Card id="hours-chart" className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Hours by Employee
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Top employees ranked by total hours worked</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {hoursByEmployee.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByEmployee} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                      width={90}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', color: 'var(--foreground)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      formatter={(value: any) => [`${value}h`, 'Hours']}
                    />
                    <Bar dataKey="hours" radius={[0, 6, 6, 0]} barSize={20}>
                      {hoursByEmployee.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <BarChart3 className="h-10 w-10 opacity-20" />
                  <p className="text-sm font-medium">No employee data for this date</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tardiness Analytics */}
        <Card id="tardiness-chart" className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" />
                  Average Tardiness (Minutes)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Average minutes late from 08:00 AM</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-7 font-bold uppercase tracking-tight"
                onClick={() => setShowTardinessNames(!showTardinessNames)}
              >
                {showTardinessNames ? "Hide Names" : "Show Names"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              {tardinessByEmployee.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tardinessByEmployee} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTardiness" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey={showTardinessNames ? "name" : "mask"}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 600 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', color: 'var(--foreground)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      formatter={(value: any) => [`${value}m`, 'Avg Late']}
                      labelFormatter={(label, payload) => {
                        if (showTardinessNames) return label;
                        const item = payload[0]?.payload;
                        return item ? `Late Session (${item.mask})` : label;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgMinutes"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorTardiness)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Activity className="h-10 w-10 opacity-20" />
                  <p className="text-sm font-medium">No tardiness data for this date</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Floating Right Panel ===== */}
      <div
        className={cn(
          "fixed top-[57px] right-0 bottom-0 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl z-40 transition-transform duration-300 ease-in-out flex flex-col",
          panelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2 sm:hidden hover:bg-muted"
                onClick={() => setPanelOpen(false)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Attendance Logs
              </h2>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">
              {logs.length} records
            </Badge>
          </div>

          {/* Panel Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 font-semibold border-primary/20 hover:bg-primary/5 px-2 md:px-3 w-full justify-start">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <span className="hidden md:inline">
                  {selectedDate ? format(selectedDate, "MMMM dd, yyyy") : "Pick a date"}
                </span>
                <span className="md:hidden">
                  {selectedDate ? format(selectedDate, "MMM dd") : "Date"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Scrollable Log List */}
        <div id="attendance-logs-list" className="flex-1 overflow-y-auto">
          {logs.length > 0 ? (
            <div className="divide-y divide-border">
              {logs.map((log, idx) => (
                <div
                  key={log.id}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        log.time_out && log.time_out !== "-" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                      )} />
                      <span className="font-bold text-sm text-foreground truncate max-w-[180px]">
                        {log.employee_name}
                      </span>
                    </div>
                    {log.total_hours > 0 && (
                      <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">
                        {log.total_hours.toFixed(1)}h
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="text-xs font-bold gap-2"
                          onClick={() => {
                            setSelectedLog(log)
                            setForm({
                              employee_id: log.employee_id,
                              date: log.date,
                              time_in: log.time_in || "",
                              time_out: log.time_out || "",
                              status: log.status
                            })
                            setEditOpen(true)
                          }}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Edit Time Log
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="text-xs font-bold gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => handleDeleteLog(log)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Log
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-xs font-bold gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            Set Status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-40">
                            <DropdownMenuItem
                              className="text-xs font-bold"
                              onClick={() => handleSetStatus(log.employee_id, "Absent")}
                            >
                              Absent
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="text-xs font-bold"
                              onClick={() => handleSetStatus(log.employee_id, "On Leave")}
                            >
                              On Leave
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs font-bold">
                                Work From Home
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-40">
                                <DropdownMenuItem onClick={() => handleSetStatus(log.employee_id, "Work From Home", "single")}>
                                  Today Only
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSetStatus(log.employee_id, "Work From Home", "permanent")}>
                                  Every Day
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs font-bold">
                                Remote
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-40">
                                <DropdownMenuItem onClick={() => handleSetStatus(log.employee_id, "Remote", "single")}>
                                  Today Only
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSetStatus(log.employee_id, "Remote", "permanent")}>
                                  Every Day
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSeparator />

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs font-bold text-emerald-600">
                                Present
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-40">
                                <DropdownMenuItem onClick={() => handleSetStatus(log.employee_id, "Present", "single")}>
                                  Today Only
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSetStatus(log.employee_id, "Present", "permanent")}>
                                  Clear Every Day
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {["On Leave", "Absent", "Work From Home", "Remote", "Late", "Weekend"].includes(log.status) && !log.time_in ? (
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md",
                          log.status === "On Leave" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          log.status === "Absent" && "bg-red-500/10 text-red-600 border-red-500/20",
                          log.status === "Work From Home" && "bg-purple-500/10 text-purple-600 border-purple-500/20",
                          log.status === "Remote" && "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
                          log.status === "Late" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          log.status === "Weekend" && "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        )}
                      >
                        {log.status === "Late" ? "Waiting for Login" : log.status}
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-emerald-600">IN</span>
                        <span className="font-medium">{log.time_in_display || "-"}</span>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-red-500">OUT</span>
                        <span className="font-medium">{log.time_out_display || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
              <Clock className="h-12 w-12 opacity-15" />
              <p className="font-bold text-sm">No logs found</p>
              <p className="text-xs text-center">
                {selectedDate
                  ? `No attendance records for ${format(selectedDate, "MMM dd, yyyy")}`
                  : "Select a date to view records"}
              </p>
            </div>
          )}
        </div>

        {/* Panel Footer Summary */}
        {logs.length > 0 && (
          <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Present</p>
                <p className="text-lg font-black text-foreground">{presentCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hours</p>
                <p className="text-lg font-black text-foreground">{totalHoursWorked.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OT</p>
                <p className="text-lg font-black text-foreground">{totalOvertime.toFixed(1)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}