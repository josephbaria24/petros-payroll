"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Clock, LogIn, LogOut, CheckCircle2 } from "lucide-react";

export default function MyTimeLogsPage() {
  const [loading, setLoading] = useState(false);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error("User not found.");
        return;
      }

      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .single();

      if (empErr || !employee?.id) {
        toast.error("Employee record not found.");
        return;
      }

      setEmployeeId(employee.id);
      fetchTodayLog(employee.id);
    };

    init();
  }, []);

  const fetchTodayLog = async (empId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("time_logs")
      .select("*")
      .eq("employee_id", empId)
      .eq("date", today)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Fetch error:", error);
    }

    setTodayLog(data || null);
  };

  // Normalize time we store: "HH:MM:SS" 24h (local time)
  const nowHms24 = () =>
    new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  // Display helper – handles "HH:MM:SS" or "HH:MM:SS AM/PM"
  const format12h = (t?: string | null) => {
    if (!t) return "-";
    const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!m) return t; // fallback if unexpected
    let [, hh, mm, ss = "00", ap] = m;
    let h = parseInt(hh, 10);

    // If input already has AM/PM, normalize to 24h first
    if (ap) {
      const isPM = ap.toUpperCase() === "PM";
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
    }

    const meridiem = h >= 12 ? "PM" : "AM";
    const hour12 = (h % 12) || 12;
    return `${hour12.toString().padStart(2, "0")}:${mm}:${ss} ${meridiem}`;
  };

  const handleTimeIn = async () => {
    if (!employeeId) return;
    setLoading(true);

    const date = new Date().toISOString().split("T")[0];
    const time = nowHms24(); // store normalized 24h

    const { error } = await supabase.from("time_logs").insert({
      employee_id: employeeId,
      date,
      time_in: time,
    });

    if (error) toast.error("Failed to time in.");
    else {
      toast.success("Time in recorded.");
      fetchTodayLog(employeeId);
    }

    setLoading(false);
  };

  const handleTimeOut = async () => {
    if (!todayLog) return;
    setLoading(true);

    const time = nowHms24(); // store normalized 24h

    const { error } = await supabase
      .from("time_logs")
      .update({ time_out: time })
      .eq("id", todayLog.id);

    if (error) toast.error("Failed to time out.");
    else {
      toast.success("Time out recorded.");
      fetchTodayLog(employeeId!);
    }

    setLoading(false);
  };

  return (
    <div className="p-4 md:p-6">
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
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">Time In:</span>
              <span
                className={todayLog?.time_in ? "text-green-600" : "text-muted-foreground"}
              >
                {format12h(todayLog?.time_in)}
              </span>
            </p>

            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">Time Out:</span>
              <span
                className={todayLog?.time_out ? "text-green-600" : "text-muted-foreground"}
              >
                {format12h(todayLog?.time_out)}
              </span>
            </p>
          </div>

          <div>
            {!todayLog?.time_in ? (
              <Button onClick={handleTimeIn} disabled={loading} className="w-50">
                {loading ? "Timing in..." : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Time In
                  </>
                )}
              </Button>
            ) : !todayLog?.time_out ? (
              <Button onClick={handleTimeOut} disabled={loading} className="w-50">
                {loading ? "Timing out..." : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Time Out
                  </>
                )}
              </Button>
            ) : (
              <p className="flex items-center justify-center gap-2 text-green-600 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Attendance completed today.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
