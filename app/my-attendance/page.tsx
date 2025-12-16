//app\my-attendance\page.tsx

"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Clock, LogIn, LogOut, CheckCircle2, Calendar, User, Timer, ChevronRight } from "lucide-react";

export default function MyTimeLogsPage() {
  const [loading, setLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const [todayLog, setTodayLog] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [attendanceLogUserId, setAttendanceLogUserId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const supabase = createClientComponentClient();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error("User not found.");
        return;
      }

      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select("id, attendance_log_userid")
        .eq("email", user.email)
        .single();

      if (empErr || !employee?.id) {
        toast.error("Employee record not found.");
        return;
      }

      setEmployeeId(employee.id);
      setAttendanceLogUserId(employee.attendance_log_userid);
      fetchTodayLog(employee.id);
    };

    init();
  }, []);

  const fetchTodayLog = async (empId: string) => {
    const now = new Date();
    const philippinesNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const todayPhilippines = philippinesNow.toISOString().split('T')[0];
    
    const startOfDayUTC = new Date(`${todayPhilippines}T00:00:00+08:00`).toISOString();
    const endOfDayUTC = new Date(`${todayPhilippines}T23:59:59+08:00`).toISOString();
  
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("attendance_log_userid")
      .eq("id", empId)
      .single();
  
    if (empError || !employee?.attendance_log_userid) {
      console.error("Employee attendance_log_userid not found", empError);
      return;
    }
  
    const logUserId = employee.attendance_log_userid;
  
    const { data: attendanceLog, error: attErr } = await supabase
      .from("attendance_logs")
      .select("id, timestamp")
      .eq("user_id", logUserId)
      .gte("timestamp", startOfDayUTC)
      .lte("timestamp", endOfDayUTC)
      .order("timestamp", { ascending: true })
      .limit(1)
      .single();
  
    if (attErr && attErr.code !== "PGRST116") {
      console.error("Error fetching attendance log:", attErr);
    }
  
    const { data: timeLog, error: timeLogErr } = await supabase
      .from("time_logs")
      .select("id, time_out")
      .eq("employee_id", empId)
      .eq("date", todayPhilippines)
      .single();
  
    if (timeLogErr && timeLogErr.code !== "PGRST116") {
      console.error("Error fetching time log:", timeLogErr);
    }
  
    setTodayLog({
      id: timeLog?.id,
      attendance_log_id: attendanceLog?.id || null,
      time_in: attendanceLog?.timestamp
        ? attendanceLog.timestamp.split('T')[1].split('+')[0]
        : null,
      time_out: timeLog?.time_out || null,
    });
  };

  const nowHms24 = () => {
    return new Date().toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const format12h = (t?: string | null) => {
    if (!t) return "-";
    const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!m) return t;
    let [, hh, mm, ss = "00", ap] = m;
    let h = parseInt(hh, 10);

    if (ap) {
      const isPM = ap.toUpperCase() === "PM";
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
    }

    const meridiem = h >= 12 ? "PM" : "AM";
    const hour12 = (h % 12) || 12;
    return `${hour12.toString().padStart(2, "0")}:${mm}:${ss} ${meridiem}`;
  };

  const getWorkDuration = () => {
    if (!todayLog?.time_in) return null;
    
    const timeIn = todayLog.time_in;
    const timeOut = todayLog.time_out || nowHms24();
    
    const parseTime = (timeStr: string) => {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);
      return hours * 60 + minutes + (seconds || 0) / 60;
    };
    
    const timeInMinutes = parseTime(timeIn);
    const timeOutMinutes = parseTime(timeOut);
    
    if (timeOutMinutes <= timeInMinutes) return null;
    
    const lunchStart = 12 * 60;
    const lunchEnd = 13 * 60;
    
    let totalWorkMinutes = timeOutMinutes - timeInMinutes;
    
    if (timeInMinutes < lunchEnd && timeOutMinutes > lunchStart) {
      const overlapStart = Math.max(timeInMinutes, lunchStart);
      const overlapEnd = Math.min(timeOutMinutes, lunchEnd);
      const lunchOverlap = overlapEnd - overlapStart;
      
      totalWorkMinutes -= lunchOverlap;
    }
    
    if (totalWorkMinutes < 0) return null;
    
    const hours = Math.floor(totalWorkMinutes / 60);
    const minutes = Math.floor(totalWorkMinutes % 60);
    
    return `${hours}h ${minutes}m`;
  };

  const handleTimeIn = async () => {
    if (!employeeId || !attendanceLogUserId) {
      toast.error("Employee information not found. Please refresh the page.");
      return;
    }
    
    setLoading(true);

    try {
      const now = new Date();
      const philippineTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      
      const timestamp = new Date(philippineTime.getTime() - philippineTime.getTimezoneOffset() * 60000).toISOString();
      const workDate = philippineTime.toISOString().split('T')[0];
      
      const timeString = philippineTime.toLocaleTimeString("en-PH", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance_logs")
        .insert({
          user_id: attendanceLogUserId,
          timestamp,
          work_date: workDate,
          status: 'time_in',
        })
        .select()
        .single();

      if (attendanceError) {
        console.error("Attendance log insertion error:", attendanceError);
        toast.error(`Failed to record attendance: ${attendanceError.message}`);
        setLoading(false);
        return;
      }

      const { error: timeLogError } = await supabase
        .from("time_logs")
        .insert({
          employee_id: employeeId,
          date: workDate,
          time_in: timeString,
        });

      if (timeLogError) {
        console.error("Time log insertion error:", timeLogError);
        toast.warning("Time recorded but there was an issue with time log.");
      } else {
        toast.success("Time in recorded successfully.");
      }

      await fetchTodayLog(employeeId);

    } catch (err) {
      console.error("Unexpected error during time in:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeOut = async () => {
    if (!todayLog?.id || !employeeId) return;
    setLoading(true);

    try {
      const time = nowHms24();

      const { error } = await supabase
        .from("time_logs")
        .update({ time_out: time })
        .eq("id", todayLog.id);

      if (error) {
        console.error("Time out error:", error);
        toast.error(`Failed to time out: ${error.message}`);
      } else {
        toast.success("Time out recorded.");
        await fetchTodayLog(employeeId);
      }
    } catch (err) {
      console.error("Unexpected error during time out:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = () => {
    if (!todayLog?.time_in) return "Ready to start";
    if (!todayLog?.time_out) return "Currently working";
    return "Completed";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 space-y-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <span>Dashboard</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-slate-900 font-medium">Time & Attendance</span>
        </div>

        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Time & Attendance</h1>
          <p className="mt-1 text-slate-600">Record your daily work hours</p>
        </div>

        {/* Current Time Display */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-2">
            <div className="text-center">
              <div className="text-4xl md:text-4xl font-mono font-bold text-slate-900 tracking-wider">
                {hasMounted
                  ? new Date().toLocaleTimeString("en-PH", {
                      timeZone: "Asia/Manila",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })
                  : "Loading..."}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-lg text-slate-600">
                <Calendar className="h-5 w-5" />
                {hasMounted
                  ? new Date().toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Attendance Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Today's Attendance
                </CardTitle>
                <CardDescription className="text-slate-600 mt-1">
                  {getStatusText()}
                </CardDescription>
              </div>
              {todayLog?.time_in && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Timer className="h-4 w-4" />
                  <span className="font-medium">{getWorkDuration() || "Calculating..."}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Time Display Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time In Card */}
              <div className="rounded-lg p-6 border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-full bg-slate-200">
                    <LogIn className="h-5 w-5 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-900">Time In</span>
                </div>
                <div className={`text-2xl font-mono font-bold ${
                  todayLog?.time_in ? "text-slate-900" : "text-slate-400"
                }`}>
                  {format12h(todayLog?.time_in)}
                </div>
              </div>

              {/* Time Out Card */}
              <div className="rounded-lg p-6 border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-full bg-slate-200">
                    <LogOut className="h-5 w-5 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-900">Time Out</span>
                </div>
                <div className={`text-2xl font-mono font-bold ${
                  todayLog?.time_out ? "text-slate-900" : "text-slate-400"
                }`}>
                  {format12h(todayLog?.time_out)}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-center pt-2">
              {!todayLog?.time_in ? (
                <Button 
                  onClick={handleTimeIn} 
                  disabled={loading} 
                  className="px-8 py-6 text-base font-medium bg-slate-900 hover:bg-slate-800"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Recording...
                    </div>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      Clock In
                    </>
                  )}
                </Button>
              ) : !todayLog?.time_out ? (
                <Button 
                  onClick={handleTimeOut} 
                  disabled={loading} 
                  variant="outline"
                  className="px-8 py-6 text-base font-medium border-slate-900 text-slate-900 hover:bg-slate-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full" />
                      Recording...
                    </div>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-5 w-5" />
                      Clock Out
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-lg">
                    <CheckCircle2 className="h-6 w-6" />
                    Work day completed
                  </div>
                  <p className="text-slate-600">
                    Total hours: <span className="font-semibold text-slate-900">{getWorkDuration()}</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {todayLog?.time_in && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Started</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-2xl font-bold text-slate-900">
                  {format12h(todayLog.time_in).split(' ')[0]}
                </p>
                <p className="text-xs text-slate-500 mt-1">{format12h(todayLog.time_in).split(' ')[1]}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Duration</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-2xl font-bold text-slate-900">
                  {getWorkDuration() || "0h 0m"}
                </p>
                <p className="text-xs text-slate-500 mt-1">Excluding lunch break</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Status</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-2xl font-bold text-slate-900">
                  {todayLog.time_out ? format12h(todayLog.time_out).split(' ')[0] : "Active"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {todayLog.time_out ? format12h(todayLog.time_out).split(' ')[1] : "Currently working"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}