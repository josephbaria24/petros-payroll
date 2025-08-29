"use client"

import { useEffect, useState } from "react"
import { startOfWeek, endOfWeek, addDays, format } from "date-fns"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { CheckCircle, XCircle, Clock, Plane } from "lucide-react"
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
            return (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                Present
              </Badge>
            )
          case "Absent":
            return (
              <Badge className="bg-red-100 text-red-700">
                <XCircle className="w-4 h-4 mr-1" />
                Absent
              </Badge>
            )
          case "Late":
            return (
              <Badge className="bg-yellow-100 text-yellow-800">
                <Clock className="w-4 h-4 mr-1" />
                Late
              </Badge>
            )
          case "On Leave":
            return (
              <Badge className="bg-blue-100 text-blue-800">
                <Plane className="w-4 h-4 mr-1" />
                On Leave
              </Badge>
            )
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
  
      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .single()
  
      if (empErr || !employee) {
        console.error("No matching employee record found.")
        return
      }
  
      setUserId(employee.id)
  
      const { data: logsData, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("date", format(currentWeekEnd, "yyyy-MM-dd"))
  
      if (error) {
        console.error("Error fetching time logs:", error)
      } else {
        setLogs(logsData)
      }
    }
  
    fetchUserAndLogs()
  }, [weekOffset])
  

  const getLogByDate = (date: string): TimeLog | undefined => {
    return logs.find((log) => log.date === date)
  }
  
  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLog) return
  
    const { id, time_in, time_out, status } = editLog
  
    const { error } = await supabase
      .from("time_logs")
      .update({ time_in, time_out, status })
      .eq("id", id)
  
    if (!error) {
      const updated = logs.map((log) => (log.id === id ? { ...log, time_in, time_out, status } : log))
      setLogs(updated)
      setEditLog(null)
    }
  }
  
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Timesheet: {format(currentWeekStart, "MMM d")} - {format(currentWeekEnd, "MMM d, yyyy")}
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setWeekOffset((prev) => prev - 1)}>
              Previous Week
            </Button>
            <Button variant="outline" onClick={() => setWeekOffset(0)}>
              This Week
            </Button>
            <Button variant="outline" onClick={() => setWeekOffset((prev) => prev + 1)}>
              Next Week
            </Button>
          </div>
        </CardHeader>

        <CardContent>
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
                  <TableRow key={day}>
                    <TableCell>{day}</TableCell>
                    <TableCell>{date}</TableCell>
                    <TableCell>{log?.time_in || "-"}</TableCell>
                    <TableCell>{log?.time_out || "-"}</TableCell>
                    <TableCell>{getTotalHours(log?.time_in ?? null, log?.time_out ?? null)}</TableCell>
                    <TableCell>{renderStatusBadge(log?.status || null)}</TableCell>

                    <TableCell>
                      {log ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setEditLog(log)}>Edit</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogTitle>Edit Log</DialogTitle>
                            <form onSubmit={handleUpdateLog} className="space-y-4">

                                <Label htmlFor="time_in">Time In</Label>
                                <Input
                                id="time_in"
                                type="time"
                                value={editLog?.time_in ?? ""}
                                onChange={(e) =>
                                    setEditLog({ ...(editLog as TimeLog), time_in: e.target.value })
                                }
                                />

                                <Label htmlFor="time_out">Time Out</Label>
                                <Input
                                id="time_out"
                                type="time"
                                value={editLog?.time_out ?? ""}
                                onChange={(e) =>
                                    setEditLog({ ...(editLog as TimeLog), time_out: e.target.value })
                                }
                                />

                                <Label htmlFor="status">Status</Label>
                                <Select
                                value={editLog?.status ?? ""}
                                onValueChange={(value) =>
                                    setEditLog({ ...(editLog as TimeLog), status: value })
                                }
                                >
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

                                <Button type="submit">Save</Button>
                            </form>
                            </DialogContent>


                        </Dialog>
                      ) : (
                        <span className="text-muted-foreground">No record</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
