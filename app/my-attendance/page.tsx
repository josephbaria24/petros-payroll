"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"

export default function MyTimeLogsPage() {
  const [loading, setLoading] = useState(false)
  const [todayLog, setTodayLog] = useState<any>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  const supabase = createClientComponentClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user || !user.email) {
        toast.error("User not found.")
        return
      }

      // Use email to find matching employee record
      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .single()

      if (empErr || !employee?.id) {
        toast.error("Employee record not found.")
        return
      }

      setEmployeeId(employee.id)
      fetchTodayLog(employee.id)
    }

    init()
  }, [])

  const fetchTodayLog = async (empId: string) => {
    const today = new Date().toISOString().split("T")[0]
    const { data, error } = await supabase
      .from("time_logs")
      .select("*")
      .eq("employee_id", empId)
      .eq("date", today)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Fetch error:", error)
    }

    setTodayLog(data || null)
  }

  const handleTimeIn = async () => {
    if (!employeeId) return
    setLoading(true)

    const now = new Date()
    const date = now.toISOString().split("T")[0]
    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      

    const { error } = await supabase.from("time_logs").insert({
      employee_id: employeeId,
      date,
      time_in: time,
    })

    if (error) toast.error("Failed to time in.")
    else {
      toast.success("Time in recorded.")
      fetchTodayLog(employeeId)
    }

    setLoading(false)
  }

  const handleTimeOut = async () => {
    if (!todayLog) return
    setLoading(true)

    const now = new Date()
    const time = now.toTimeString().split(" ")[0]

    const { error } = await supabase
      .from("time_logs")
      .update({ time_out: time })
      .eq("id", todayLog.id)

    if (error) toast.error("Failed to time out.")
    else {
      toast.success("Time out recorded.")
      fetchTodayLog(employeeId!)
    }

    setLoading(false)
  }
// helper – converts "HH:MM:SS" -> "hh:MM:SS AM/PM"
const to12h = (t?: string | null) => {
    if (!t) return "-";
    const [hStr, m = "00", s = "00"] = t.split(":");
    const h = parseInt(hStr, 10);
    const meridiem = h >= 12 ? "PM" : "AM";
    const hour12 = (h % 12) || 12;
    return `${hour12.toString().padStart(2, "0")}:${m}:${s} ${meridiem}`;
  };
  return (
    <div className="p-4 md:p-6 ">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">My Attendance</CardTitle>
          <CardDescription>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-6 text-sm md:text-base">
          <div className="space-y-2">
          <p>
            <strong>🕘 Time In:</strong>{" "}
            <span className={todayLog?.time_in ? "text-green-600" : "text-muted-foreground"}>
                {to12h(todayLog?.time_in)}
            </span>
            </p>
            <p>
            <strong>🕔 Time Out:</strong>{" "}
            <span className={todayLog?.time_out ? "text-green-600" : "text-muted-foreground"}>
                {to12h(todayLog?.time_out)}
            </span>
            </p>
          </div>

          <div>
            {!todayLog?.time_in ? (
              <Button onClick={handleTimeIn} disabled={loading} className="w-50">
                {loading ? "Timing in..." : "🟢 Time In"}
              </Button>
            ) : !todayLog?.time_out ? (
              <Button onClick={handleTimeOut} disabled={loading} className="w-50">
                {loading ? "Timing out..." : "🔴 Time Out"}
              </Button>
            ) : (
              <p className="text-green-600 font-semibold text-center">
                ✅ Attendance completed today.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
