"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
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
import { Separator } from "@/components/ui/separator"
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbList, 
  BreadcrumbPage 
} from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  CalendarIcon,
  Clock,
  Users,
  TrendingUp,
  Plus,
  Timer
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useProtectedPage } from "../hooks/useProtectedPage"

type TimeLog = {
  id: string
  employee_id: string
  employee_name?: string
  date: string
  time_in: string | null
  time_out: string | null
  total_hours: number
  overtime_hours: number
  status: string
}

// Helper function to extract Philippine time from ZKT timestamp (stored as UTC but represents PH time)
function extractPhilippineTime(timestamp: string): string {
  // Extract time directly from timestamp (ZKT stores Philippine time as UTC)
  return timestamp.split('T')[1].split('+')[0].substring(0, 5) // Extract HH:MM
}

// Helper function to extract Philippine date from ZKT timestamp
function extractPhilippineDate(timestamp: string): string {
  // Extract date directly from timestamp
  return timestamp.split('T')[0] // Extract YYYY-MM-DD
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    "Present": "bg-slate-900 text-white border-slate-200",
    "Logged": "bg-slate-900 text-white border-slate-200",
    "Late": "bg-white text-slate-900 border-slate-300",
    "Absent": "bg-slate-100 text-slate-600 border-slate-200",
    "On Leave": "bg-slate-100 text-slate-600 border-slate-200",
  }

  const className = variants[status] || "bg-slate-100 text-slate-600 border-slate-200"
  
  return (
    <Badge 
      variant="outline" 
      className={`${className} font-medium`}
    >
      {status}
    </Badge>
  )
}

export default function TimekeepingPage() {
  useProtectedPage(["admin", "hr"])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    employee_id: "",
    date: "",
    time_in: "",
    time_out: "",
    status: "Present",
  })
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

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
  }, [selectedDate])

  async function fetchLogs(date: Date = new Date()) {
    // Use the same logic as WeeklyTimesheet for date range
    const selectedDate = format(date, "yyyy-MM-dd")
    const weekStartUTC = new Date(`${selectedDate}T00:00:00+08:00`).toISOString()
    const weekEndUTC = new Date(`${selectedDate}T23:59:59+08:00`).toISOString()

    const { data: logsData, error: logsError } = await supabase
      .from("attendance_logs")
      .select("id, user_id, timestamp, timeout, status")
      .gte("timestamp", weekStartUTC)
      .lte("timestamp", weekEndUTC)
      .order("timestamp", { ascending: false })

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

    const enrichedLogs = logsData.map((log) => {
      const matchedEmp = employeesData.find(
        (emp) => emp.attendance_log_userid === log.user_id
      )

      // Extract Philippine time directly from ZKT timestamps (same as WeeklyTimesheet)
      const timeInPH = log.timestamp ? extractPhilippineTime(log.timestamp) : null
      const timeOutPH = log.timeout ? extractPhilippineTime(log.timeout) : null
      const datePH = log.timestamp ? extractPhilippineDate(log.timestamp) : null

      // Calculate total hours using the original timestamps for accuracy
      const timeInUTC = log.timestamp ? new Date(log.timestamp) : null
      const timeOutUTC = log.timeout ? new Date(log.timeout) : null
      const totalHours =
        timeInUTC && timeOutUTC
          ? (timeOutUTC.getTime() - timeInUTC.getTime()) / (1000 * 60 * 60)
          : 0

      return {
        id: log.id,
        employee_id: matchedEmp?.id || "",
        employee_name: matchedEmp?.full_name || "Unknown",
        date: datePH || "-",
        time_in: timeInPH || "-",
        time_out: timeOutPH || "-",
        total_hours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        overtime_hours: totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0,
        status: log.status || "Logged",
      }
    })

    setLogs(enrichedLogs)
  }

  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("id, full_name")
    if (error) {
      console.error(error)
      return
    }
    setEmployees(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Saving time log...")

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
      toast.success("Time log saved!", { id: toastId })
      setOpen(false)
      resetForm()
      fetchLogs(selectedDate)
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

  // Calculate metrics
  const totalHours = logs.reduce((sum, log) => sum + log.total_hours, 0)
  const totalOvertime = logs.reduce((sum, log) => sum + log.overtime_hours, 0)
  const presentCount = logs.filter(log => log.time_in && log.time_in !== "-").length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-slate-400 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading timekeeping data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      {/* <div className="bg-white border-b">
        <div className="px-6 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-slate-600">
                  Time & Attendance
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div> */}

      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Timekeeping</h1>
        <p className="text-slate-600">
          Monitor employee attendance and track working hours
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Present Today
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {presentCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Employees checked in
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {totalHours.toFixed(1)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hours worked today
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Overtime Hours
            </CardTitle>
            <Timer className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {totalOvertime.toFixed(1)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Extra hours today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Date Filter */}
            <div className="flex items-center space-x-2">
              <Label className="text-slate-600 font-medium">Date:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3 cursor-pointer justify-start font-normal",
                      !selectedDate && "text-slate-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </div>
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

            {/* Add Time Log Button */}
            <Dialog open={open} onOpenChange={(v) => {
              setOpen(v)
              if (!v) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button className="bg-slate-900 hover:bg-slate-800">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Time Log
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

                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">
                    Save Time Log
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200">
                  <TableHead className="font-medium text-slate-900">Employee</TableHead>
                  <TableHead className="font-medium text-slate-900">Date</TableHead>
                  <TableHead className="font-medium text-slate-900">Time In</TableHead>
                  <TableHead className="font-medium text-slate-900">Time Out</TableHead>
                  <TableHead className="font-medium text-slate-900">Total Hours</TableHead>
                  <TableHead className="font-medium text-slate-900">Overtime</TableHead>
                  <TableHead className="font-medium text-slate-900">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <TableCell>
                      <div className="font-medium text-slate-900">{log.employee_name}</div>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {new Date(log.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {log.time_in || "-"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {log.time_out || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {log.total_hours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {log.overtime_hours > 0 ? `${log.overtime_hours.toFixed(1)}h` : "-"}
                    </TableCell>
                    <TableCell>
                      {statusBadge(log.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-2">
                <Clock className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">No time logs found</h3>
              <p className="text-slate-500">
                {selectedDate 
                  ? `No attendance records for ${format(selectedDate, "PPP")}`
                  : "Select a date to view attendance records"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}