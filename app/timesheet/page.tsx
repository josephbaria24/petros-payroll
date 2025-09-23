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
    attendance_log_id?: string | null
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

    let diffMs = outDate.getTime() - inDate.getTime()
    if (diffMs <= 0) return "0h"

    // Convert to total minutes for easier calculation
    let totalMinutes = Math.floor(diffMs / 1000 / 60)

    // Deduct 1 hour (60 minutes) for lunch break if working more than 6 hours
    if (totalMinutes > 6 * 60) {
      totalMinutes -= 60 // Subtract 1 hour for lunch break
    }

    if (totalMinutes <= 0) return "0h"

    const diffHours = Math.floor(totalMinutes / 60)
    const diffMinutesRemainder = totalMinutes % 60

    return `${diffHours}h ${diffMinutesRemainder}m`
  }

  const [weekOffset, setWeekOffset] = useState(0)
  const [logs, setLogs] = useState<TimeLog[]>([])
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const [userId, setUserId] = useState("")
  const [attendanceLogUserId, setAttendanceLogUserId] = useState("")
  const [editLog, setEditLog] = useState<TimeLog | null>(null)
  const supabase = createClientComponentClient()

  // Helper function to create timestamp with validation
  const createTimestamp = (date: string, time: string): string | null => {
    try {
      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error("Invalid date format:", date)
        return null
      }

      // Validate time format (HH:MM or HH:MM:SS)
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        console.error("Invalid time format:", time)
        return null
      }

      // Ensure time has seconds
      const timeWithSeconds = time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time

      // Create timestamp string
      const timestampString = `${date}T${timeWithSeconds}+08:00`
      
      // Test if the date is valid
      const testDate = new Date(timestampString)
      if (isNaN(testDate.getTime())) {
        console.error("Invalid timestamp:", timestampString)
        return null
      }

      return testDate.toISOString()
    } catch (error) {
      console.error("Error creating timestamp:", error)
      return null
    }
  }

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
        .select("id, timestamp, work_date")
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
          const logDate = log.work_date || format(new Date(log.timestamp), "yyyy-MM-dd")
          
          // Convert UTC timestamp to Philippines timezone (UTC+8) and extract time
          const utcDate = new Date(log.timestamp)
          const philippinesDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)) // Add 8 hours
          const timeIn = philippinesDate.toISOString().split('T')[1].substring(0, 8) // Extract HH:MM:SS
          
          if (!groupedLogs[logDate]) {
            groupedLogs[logDate] = {
              id: `attendance_${logDate}`,
              date: logDate,
              time_in: timeIn,
              time_out: null,
              status: "Present",
              attendance_log_id: log.id
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
            // Keep the time_log id for updating time_out
            groupedLogs[timeLog.date].id = timeLog.id
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

    const { time_in, time_out, status, date, attendance_log_id } = editLog
    
    try {
      // Handle time_in update (update attendance_logs)
      if (time_in && attendance_log_id) {
        // Validate and convert time to full timestamp for the date
        const timeInTimestamp = createTimestamp(date, time_in)
        if (!timeInTimestamp) {
          alert("Invalid time format. Please enter a valid time.")
          return
        }
        
        const { error: attendanceError } = await supabase
          .from("attendance_logs")
          .update({ 
            timestamp: timeInTimestamp,
            work_date: date
          })
          .eq("id", attendance_log_id)

        if (attendanceError) {
          console.error("Error updating attendance log:", attendanceError)
          alert("Error updating time in. Please try again.")
          return
        }
      } else if (time_in && !attendance_log_id) {
        // Create new attendance log if doesn't exist
        const timeInTimestamp = createTimestamp(date, time_in)
        if (!timeInTimestamp) {
          alert("Invalid time format. Please enter a valid time.")
          return
        }
        
        const { data: newAttendanceLog, error: attendanceError } = await supabase
          .from("attendance_logs")
          .insert([{
            user_id: attendanceLogUserId,
            timestamp: timeInTimestamp,
            work_date: date,
            status: "in"
          }])
          .select("id")
          .single()

        if (attendanceError) {
          console.error("Error creating attendance log:", attendanceError)
          alert("Error creating time in record. Please try again.")
          return
        } else if (newAttendanceLog) {
          editLog.attendance_log_id = newAttendanceLog.id
        }
      }

      // Handle time_out and status update (update/create time_logs)
      const existingTimeLog = await supabase
        .from("time_logs")
        .select("*")
        .eq("employee_id", userId)
        .eq("date", date)
        .single()

      let timeLogResult
      if (existingTimeLog.data) {
        // Update existing time_log
        timeLogResult = await supabase
          .from("time_logs")
          .update({ time_in, time_out, status })
          .eq("id", existingTimeLog.data.id)
      } else {
        // Create new time_log
        timeLogResult = await supabase
          .from("time_logs")
          .insert([{ employee_id: userId, date, time_in, time_out, status }])
          .select()
      }

      if (!timeLogResult.error) {
        // Refresh the logs by updating state
        const updatedLog = { ...editLog, time_in, time_out, status }
        const updatedLogs = logs.map((log) => (log.date === date ? updatedLog : log))
        
        // If this is a new log, add it to the list
        if (!logs.find((log) => log.date === date)) {
          updatedLogs.push(updatedLog)
        }
        
        setLogs(updatedLogs)
        setEditLog(null)
      } else {
        console.error("Error updating time log:", timeLogResult.error)
      }
    } catch (error) {
      console.error("Error updating log:", error)
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
    <div className="min-h-screen from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text">My Weekly Attendance</h1>
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
                              setEditLog(log || { 
                                id: "", 
                                date, 
                                time_in: "", 
                                time_out: "", 
                                status: "Present",
                                attendance_log_id: null 
                              })
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