"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
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
  BarChart3
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
function extractPhilippineTime(timestamp: string): string {
  return timestamp.split('T')[1].split('+')[0].substring(0, 5)
}

// Helper function to extract Philippine date from ZKT timestamp
function extractPhilippineDate(timestamp: string): string {
  return timestamp.split('T')[0]
}

// Helper function to format HH:MM to 12-hour AM/PM
function formatTo12Hour(timeStr: string | null): string {
  if (!timeStr || timeStr === "-") return "-";
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1']

export default function TimekeepingPage() {
  useProtectedPage(["admin", "hr"])
  const { activeOrganization } = useOrganization()
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchLogs(selectedDate),
        fetchEmployees()
      ])
      setLoading(false)
    }
    loadData()
  }, [selectedDate, activeOrganization])

  async function fetchLogs(date: Date = new Date()) {
    if (activeOrganization === "pdn") {
      const selectedDateStr = format(date, "yyyy-MM-dd")

      const { data: logsData, error: logsError } = await supabase
        .from("pdn_attendance_logs")
        .select("id, employee_id, timestamp, status, work_date")
        .eq("work_date", selectedDateStr)
        .order("timestamp", { ascending: true })

      if (logsError) {
        console.error("Error fetching PDN logs:", logsError)
        return
      }

      const { data: employeesData, error: empError } = await supabase
        .from("pdn_employees")
        .select("id, full_name")

      if (empError) {
        console.error("Error fetching PDN employees:", empError)
        return
      }

      // Simple mapping for PDN logs
      const enrichedLogs: TimeLog[] = (logsData || []).map((log: any) => {
        const emp = employeesData?.find((e: any) => e.id === log.employee_id)
        const timeIn = log.timestamp ? extractPhilippineTime(log.timestamp) : null
        const timeOut = log.timeout ? extractPhilippineTime(log.timeout) : null
        const timeInUTC = log.timestamp ? new Date(log.timestamp) : null
        const timeOutUTC = log.timeout ? new Date(log.timeout) : null
        const totalHours = timeInUTC && timeOutUTC ? (timeOutUTC.getTime() - timeInUTC.getTime()) / (1000 * 60 * 60) : 0

        return {
          id: log.id.toString(),
          employee_id: log.employee_id || "",
          employee_name: emp?.full_name || log.full_name || "Unknown",
          date: log.work_date || selectedDateStr,
          time_in: timeIn,
          time_out: timeOut,
          time_in_display: formatTo12Hour(timeIn),
          time_out_display: formatTo12Hour(timeOut),
          total_hours: Math.round(totalHours * 100) / 100,
          overtime_hours: totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0,
          status: log.status || "time_in",
          in_id: log.id.toString(),
          out_id: log.id.toString(), // For PDN, both point to same row
        }
      })

      setLogs(enrichedLogs)
      return
    }

    const selectedDateStr = format(date, "yyyy-MM-dd")

    // Use work_date column (plain date, represents the Philippine date) to avoid timezone bleeding
    const { data: logsData, error: logsError } = await supabase
      .from("attendance_logs")
      .select("id, user_id, timestamp, status, work_date")
      .eq("work_date", selectedDateStr)
      .order("timestamp", { ascending: true })

    if (logsError) {
      console.error("Error fetching logs:", logsError)
      return
    }

    const { data: employeesData, error: empError } = await supabase
      .from("employees")
      .select("id, full_name, attendance_log_userid")

    if (empError) {
      console.error("Error fetching employees:", empError)
      return
    }

    // --- Grouping Logic: Pair time_in and time_out ---
    const userGroups: Record<number, any[]> = {}
    logsData.forEach((log) => {
      if (!userGroups[log.user_id]) userGroups[log.user_id] = []
      userGroups[log.user_id].push(log)
    })

    const enrichedLogs: TimeLog[] = []

    for (const userIdStr in userGroups) {
      const userId = parseInt(userIdStr)
      const userLogs = userGroups[userId]
      const matchedEmp = employeesData.find((emp) => emp.attendance_log_userid === userId)
      const empName = matchedEmp?.full_name || "Unknown"
      const empId = matchedEmp?.id || ""

      let currentIn: any = null

      const processSession = (inEvent: any | null, outEvent: any | null) => {
        const timeInUTC = inEvent ? new Date(inEvent.timestamp) : null
        const timeOutUTC = outEvent ? new Date(outEvent.timestamp) : null

        const timeInPH = inEvent ? extractPhilippineTime(inEvent.timestamp) : null
        const timeOutPH = outEvent ? extractPhilippineTime(outEvent.timestamp) : null
        // Use work_date (plain Philippine date) instead of extracting from UTC timestamp
        const datePH = (inEvent || outEvent)?.work_date || selectedDateStr

        const totalHours =
          timeInUTC && timeOutUTC
            ? (timeOutUTC.getTime() - timeInUTC.getTime()) / (1000 * 60 * 60)
            : 0

        enrichedLogs.push({
          id: (inEvent || outEvent).id.toString(),
          employee_id: empId,
          employee_name: empName,
          date: datePH,
          time_in: timeInPH,
          time_out: timeOutPH,
          time_in_display: formatTo12Hour(timeInPH),
          time_out_display: formatTo12Hour(timeOutPH),
          total_hours: Math.round(totalHours * 100) / 100,
          overtime_hours: totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0,
          status: outEvent ? "time_out" : "time_in",
          in_id: inEvent?.id?.toString(),
          out_id: outEvent?.id?.toString(),
        })
      }

      userLogs.forEach((log) => {
        if (log.status === "time_in") {
          if (currentIn) {
            processSession(currentIn, null)
          }
          currentIn = log
        } else if (log.status === "time_out") {
          if (currentIn) {
            processSession(currentIn, log)
            currentIn = null
          } else {
            processSession(null, log)
          }
        }
      })

      if (currentIn) {
        processSession(currentIn, null)
      }
    }

    enrichedLogs.sort((a, b) => {
      const timeA = a.time_in || a.time_out || "00:00"
      const timeB = b.time_in || b.time_out || "00:00"
      return timeB.localeCompare(timeA)
    })

    setLogs(enrichedLogs)
  }

  async function fetchEmployees() {
    if (activeOrganization === "pdn") {
      const { data, error } = await supabase.from("pdn_employees").select("id, full_name")
      if (error) {
        console.error("Error fetching PDN employees:", error)
        return
      }
      setEmployees(data || [])
      return
    }

    const { data, error } = await supabase.from("employees").select("id, full_name, attendance_log_userid")
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
        timestamp: form.time_in ? `${form.date}T${form.time_in}:00+08:00` : new Date().toISOString(),
        timeout: form.time_out ? `${form.date}T${form.time_out}:00+08:00` : null,
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
            timestamp: form.time_in ? `${form.date}T${form.time_in}:00+08:00` : null,
            timeout: form.time_out ? `${form.date}T${form.time_out}:00+08:00` : null,
            work_date: form.date,
            status: form.time_out ? "time_out" : "time_in"
          })
          .eq("id", selectedLog.in_id)

        if (error) throw error
      } else {
        // Petrosphere: Might need to update up to two rows
        if (selectedLog.in_id) {
          const { error: inErr } = await supabase
            .from("attendance_logs")
            .update({
              timestamp: form.time_in ? `${form.date}T${form.time_in}:00+08:00` : null,
              work_date: form.date
            })
            .eq("id", selectedLog.in_id)
          if (inErr) throw inErr
        }

        if (selectedLog.out_id && selectedLog.out_id !== selectedLog.in_id) {
          if (form.time_out) {
            const { error: outErr } = await supabase
              .from("attendance_logs")
              .update({
                timestamp: `${form.date}T${form.time_out}:00+08:00`,
                work_date: form.date
              })
              .eq("id", selectedLog.out_id)
            if (outErr) throw outErr
          } else {
            // User cleared the OUT time, delete the OUT row
            const { error: delErr } = await supabase
              .from("attendance_logs")
              .delete()
              .eq("id", selectedLog.out_id)
            if (delErr) throw delErr
          }
        } else if (form.time_out && !selectedLog.out_id) {
          // If editing a log that only had IN and now has OUT, we need to find the user_id and insert a new OUT row
          const { data: empData } = await supabase.from("employees").select("attendance_log_userid").eq("id", form.employee_id).single()
          if (empData?.attendance_log_userid) {
            const { error: insertErr } = await supabase.from("attendance_logs").insert({
              user_id: empData.attendance_log_userid,
              timestamp: `${form.date}T${form.time_out}:00+08:00`,
              status: "time_out",
              work_date: form.date,
              full_name: employees.find(e => e.id === form.employee_id)?.full_name || ""
            })
            if (insertErr) throw insertErr
          }
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
    const map = new Map<string, number>()
    logs.forEach(log => {
      const name = log.employee_name || "Unknown"
      map.set(name, (map.get(name) || 0) + log.total_hours)
    })
    return Array.from(map)
      .map(([name, hours]) => ({ name: name.split(' ')[0], hours: Math.round(hours * 100) / 100 }))
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
          <div className="relative group bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 mb-6 overflow-hidden transition-all hover:shadow-lg hover:shadow-amber-500/5 border-l-4 border-l-amber-500">
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
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Add Log Dialog */}
            <Dialog open={open} onOpenChange={(v) => {
              setOpen(v)
              if (!v) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Log
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
                    <div className="space-y-2">
                      <Label>Time In</Label>
                      <Input
                        type="time"
                        value={form.time_in}
                        onChange={(e) => setForm({ ...form, time_in: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Time Out</Label>
                      <Input
                        type="time"
                        value={form.time_out}
                        onChange={(e) => setForm({ ...form, time_out: e.target.value })}
                      />
                    </div>
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
                    <div className="space-y-2">
                      <Label>Time In</Label>
                      <Input
                        type="time"
                        value={form.time_in || ""}
                        onChange={(e) => setForm({ ...form, time_in: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Time Out</Label>
                      <Input
                        type="time"
                        value={form.time_out || ""}
                        onChange={(e) => setForm({ ...form, time_out: e.target.value })}
                      />
                    </div>
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
              className="gap-2"
            >
              {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              {panelOpen ? "Close" : "Logs"}
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Card className="lg:col-span-2 border border-border shadow-sm bg-card">
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
          <Card className="border border-border shadow-sm bg-card">
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

        {/* Charts Row 2 */}
        <Card className="border border-border shadow-sm bg-card">
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
        <Card className="border border-border shadow-sm bg-card">
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
          "fixed top-[57px] right-0 bottom-0 w-[420px] bg-card border-l border-border shadow-2xl z-30 transition-transform duration-300 ease-in-out flex flex-col",
          panelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Attendance Logs
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold">
              {logs.length} records
            </Badge>
          </div>

          {/* Panel Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 font-medium text-xs">
                <CalendarIcon className="h-3.5 w-3.5" />
                {selectedDate ? format(selectedDate, "EEEE, MMMM dd, yyyy") : "Pick a date"}
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
        <div className="flex-1 overflow-y-auto">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      <Clock className="h-3 w-3 text-muted-foreground hover:text-primary" />
                    </Button>
                  </div>

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