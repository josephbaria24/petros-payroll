// Redesigned WeeklyTimesheet with modern dashboard aesthetic
"use client"

import { useEffect, useState } from "react"
import { startOfWeek, endOfWeek, addDays, format } from "date-fns"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { CheckCircle, XCircle, Clock, Plane, CalendarClock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function WeeklyTimesheet() {
  type TimeLog = {
    id: string
    date: string
    time_in: string | null
    time_out: string | null
    status: string | null
  }

  function renderStatusBadge(status: string | null) {
    switch (status) {
      case "Present":
        return <Badge className="bg-green-100 text-green-700">Present</Badge>
      case "Absent":
        return <Badge className="bg-red-100 text-red-700">Absent</Badge>
      case "Late":
        return <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>
      case "On Leave":
        return <Badge className="bg-blue-100 text-blue-800">On Leave</Badge>
      default:
        return <span className="text-muted-foreground">-</span>
    }
  }

  function getTotalHours(time_in: string | null, time_out: string | null): string {
    if (!time_in || !time_out) return "-"

    const [inHour, inMinute] = time_in.split(":").map(Number)
    const [outHour, outMinute] = time_out.split(":").map(Number)

    const inDate = new Date(0, 0, 0, inHour, inMinute)
    const outDate = new Date(0, 0, 0, outHour, outMinute)

    const diffMs = outDate.getTime() - inDate.getTime()
    if (diffMs <= 0) return "0h"

    const diffHours = Math.floor(diffMs / 1000 / 60 / 60)
    const diffMinutes = Math.floor((diffMs / 1000 / 60) % 60)

    return `${diffHours}h ${diffMinutes}m`
  }

  const [weekOffset, setWeekOffset] = useState(0)
  const [logs, setLogs] = useState<TimeLog[]>([])
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const [userId, setUserId] = useState("")
  const [attendanceLogUserId, setAttendanceLogUserId] = useState("")
  const [editLog, setEditLog] = useState<TimeLog | null>(null)
  const supabase = createClientComponentClient()

  const currentWeekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })
  const currentWeekEnd = endOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })

  useEffect(() => {
    const fetchUserAndLogs = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: employee } = await supabase
        .from("employees")
        .select("id, attendance_log_userid")
        .eq("email", user.email)
        .single()

      if (!employee) return

      setUserId(employee.id)
      setAttendanceLogUserId(employee.attendance_log_userid)

      // Get date range for the week in Philippines timezone
      const weekStartUTC = new Date(`${format(currentWeekStart, "yyyy-MM-dd")}T00:00:00+08:00`).toISOString()
      const weekEndUTC = new Date(`${format(currentWeekEnd, "yyyy-MM-dd")}T23:59:59+08:00`).toISOString()

      // Fetch attendance logs for the week
      const { data: attendanceLogs } = await supabase
        .from("attendance_logs")
        .select("timestamp")
        .eq("user_id", employee.attendance_log_userid)
        .gte("timestamp", weekStartUTC)
        .lte("timestamp", weekEndUTC)
        .order("timestamp", { ascending: true })

      // Fetch time_logs for time_out data
      const { data: timeLogs } = await supabase
        .from("time_logs")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("date", format(currentWeekEnd, "yyyy-MM-dd"))

      if (attendanceLogs && timeLogs) {
        // Group attendance logs by date and get first entry (time in) for each day
        const groupedLogs: { [key: string]: TimeLog } = {}
        
        // Process attendance logs (time in)
        attendanceLogs.forEach((log) => {
          const logDate = format(new Date(log.timestamp), "yyyy-MM-dd")
          const timeIn = log.timestamp.split('T')[1].split('+')[0] // Extract time part
          
          if (!groupedLogs[logDate]) {
            groupedLogs[logDate] = {
              id: `attendance_${logDate}`,
              date: logDate,
              time_in: timeIn,
              time_out: null,
              status: "Present"
            }
          }
        })

        // Add time_out data from time_logs
        timeLogs.forEach((timeLog) => {
          if (groupedLogs[timeLog.date]) {
            groupedLogs[timeLog.date].time_out = timeLog.time_out
            if (timeLog.status) {
              groupedLogs[timeLog.date].status = timeLog.status
            }
          } else if (timeLog.time_out) {
            // If there's a time_out without attendance log, create entry
            groupedLogs[timeLog.date] = {
              id: timeLog.id,
              date: timeLog.date,
              time_in: timeLog.time_in,
              time_out: timeLog.time_out,
              status: timeLog.status || "Present"
            }
          }
        })

        setLogs(Object.values(groupedLogs))
      }
    }

    fetchUserAndLogs()
  }, [weekOffset])

  const getLogByDate = (date: string): TimeLog | undefined => logs.find((log) => log.date === date)

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLog) return

    const { id, time_in, time_out, status, date } = editLog
    
    // Check if there's an existing time_log record for this date
    const existingTimeLog = await supabase
      .from("time_logs")
      .select("*")
      .eq("employee_id", userId)
      .eq("date", date)
      .single()

    let result
    if (existingTimeLog.data) {
      // Update existing time_log
      result = await supabase
        .from("time_logs")
        .update({ time_in, time_out, status })
        .eq("id", existingTimeLog.data.id)
    } else {
      // Create new time_log
      result = await supabase
        .from("time_logs")
        .insert([{ employee_id: userId, date, time_in, time_out, status }])
        .select()
    }

    if (!result.error) {
      // Refresh the logs
      const updatedLog = { ...editLog, time_in, time_out, status }
      const updatedLogs = logs.map((log) => (log.date === date ? updatedLog : log))
      
      // If this is a new log, add it to the list
      if (!logs.find((log) => log.date === date)) {
        updatedLogs.push(updatedLog)
      }
      
      setLogs(updatedLogs)
      setEditLog(null)
    }
  }

  // Format time for display (convert to 12-hour format)
  const formatTime = (time: string | null) => {
    if (!time) return "-"
    
    const [hours, minutes] = time.split(":").map(Number)
    const meridiem = hours >= 12 ? "PM" : "AM"
    const hour12 = hours % 12 || 12
    
    return `${hour12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${meridiem}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">My Weekly Attendance</h1>
          <p className="text-lg text-gray-600">Track your daily logs and time records</p>
        </div>

        <Card className="bg-white/70 shadow-xl backdrop-blur-sm border-0">
          <CardHeader className="pb-0">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-indigo-600" /> Weekly Timesheet: {format(currentWeekStart, "MMM d")} - {format(currentWeekEnd, "MMM d, yyyy")}
            </CardTitle>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="transition-all hover:scale-105" onClick={() => setWeekOffset((prev) => prev - 1)}>Previous</Button>
              <Button variant="outline" className="transition-all hover:scale-105" onClick={() => setWeekOffset(0)}>This Week</Button>
              <Button variant="outline" className="transition-all hover:scale-105" onClick={() => setWeekOffset((prev) => prev + 1)}>Next</Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekdays.map((day, idx) => {
                  const date = format(addDays(currentWeekStart, idx), "yyyy-MM-dd")
                  const log = getLogByDate(date)

                  return (
                    <TableRow key={day} className="transition-all duration-200 hover:bg-indigo-50/50">
                      <TableCell className="font-semibold">{day}</TableCell>
                      <TableCell>{date}</TableCell>
                      <TableCell>{formatTime(log?.time_in ?? null)}</TableCell>
                      <TableCell>{formatTime(log?.time_out ?? null)}</TableCell>
                      <TableCell>{getTotalHours(log?.time_in ?? null, log?.time_out ?? null)}</TableCell>
                      <TableCell>{renderStatusBadge(log?.status || null)}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="hover:scale-105" onClick={() =>
                              setEditLog(log || { id: "", date, time_in: "", time_out: "", status: "" })
                            }>
                              {log ? "Edit" : "Add"}
                            </Button>
                          </DialogTrigger>

                          {editLog && editLog.date === date && (
                            <DialogContent className="lg:w-[22vw] md:w-[50vw] sm:w-[90vw]">
                              <DialogTitle>{log ? "Edit Log" : "Add Log"}</DialogTitle>
                              <form onSubmit={handleUpdateLog} className="space-y-4">
                                <div>
                                  <Label htmlFor="time_in">Time In</Label>
                                  <Input id="time_in" type="time" value={editLog.time_in || ""} onChange={(e) => setEditLog({ ...editLog, time_in: e.target.value })} />
                                </div>

                                <div>
                                  <Label htmlFor="time_out">Time Out</Label>
                                  <Input id="time_out" type="time" value={editLog.time_out || ""} onChange={(e) => setEditLog({ ...editLog, time_out: e.target.value })} />
                                </div>

                                <div>
                                  <Label htmlFor="status">Status</Label>
                                  <Select value={editLog.status || ""} onValueChange={(value) => setEditLog({ ...editLog, status: value })}>
                                    <SelectTrigger id="status">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Present">Present</SelectItem>
                                      <SelectItem value="Absent">Absent</SelectItem>
                                      <SelectItem value="Late">Late</SelectItem>
                                      <SelectItem value="On Leave">On Leave</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <Button type="submit" className="transition-all bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:scale-105">
                                  Save
                                </Button>
                              </form>
                            </DialogContent>
                          )}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}