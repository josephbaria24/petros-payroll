"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
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

export default function TimekeepingPage() {
  useProtectedPage(["admin", "hr"])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    employee_id: "",
    date: "",
    time_in: "",
    time_out: "",
    status: "Present",
  })
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

  useEffect(() => {
    fetchLogs()
    fetchEmployees()
  }, [])

  async function fetchLogs() {
    const { data, error } = await supabase
      .from("time_logs")
      .select("id, date, time_in, time_out, total_hours, overtime_hours, status, employees(full_name)")
      .order("date", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setLogs(
      data.map((l: any) => ({
        id: l.id,
        employee_id: l.employees?.id,
        employee_name: l.employees?.full_name,
        date: l.date,
        time_in: l.time_in,
        time_out: l.time_out,
        total_hours: l.total_hours,
        overtime_hours: l.overtime_hours,
        status: l.status,
      }))
    )
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
      setForm({ employee_id: "", date: "", time_in: "", time_out: "", status: "Present" })
      fetchLogs()
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Timekeeping</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Time Log</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Time Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Employee</Label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Time In</Label>
                <Input
                  type="time"
                  value={form.time_in}
                  onChange={(e) => setForm({ ...form, time_in: e.target.value })}
                />
              </div>
              <div>
                <Label>Time Out</Label>
                <Input
                  type="time"
                  value={form.time_out}
                  onChange={(e) => setForm({ ...form, time_out: e.target.value })}
                />
              </div>

              <div>
                <Label>Status</Label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>

              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.employee_name}</TableCell>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>{log.time_in || "-"}</TableCell>
                  <TableCell>{log.time_out || "-"}</TableCell>
                  <TableCell>{log.total_hours}</TableCell>
                  <TableCell>{log.overtime_hours}</TableCell>
                  <TableCell>{log.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
