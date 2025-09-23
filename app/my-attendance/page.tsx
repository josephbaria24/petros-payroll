"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Clock, LogIn, LogOut, CheckCircle2, Calendar, User, Timer } from "lucide-react";

export default function MyTimeLogsPage() {
  const [loading, setLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const [todayLog, setTodayLog] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
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
      console.log("Initializing component...");
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user?.email);
      
      if (!user?.email) {
        toast.error("User not found.");
        return;
      }

      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .single();

      console.log("Employee lookup result:", { employee, error: empErr });

      if (empErr || !employee?.id) {
        toast.error("Employee record not found.");
        console.error("Employee error:", empErr);
        return;
      }

      console.log("Setting employee ID:", employee.id);
      setEmployeeId(employee.id);
      fetchTodayLog(employee.id);
    };

    init();
  }, []);

  const fetchTodayLog = async (empId: string) => {
    console.log("Fetching today's log for employee:", empId);
    
    // Get today's date in Philippines timezone
    const now = new Date();
    const philippinesNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const todayPhilippines = philippinesNow.toISOString().split('T')[0];
    
    console.log("Today's date (Philippines):", todayPhilippines);
    
    // Get today's time_log record
    const { data: timeLog, error: timeLogErr } = await supabase
      .from("time_logs")
      .select("id, time_in, time_out")
      .eq("employee_id", empId)
      .eq("date", todayPhilippines)
      .single();

    console.log("Time log query result:", { timeLog, error: timeLogErr });
  
    if (timeLogErr && timeLogErr.code !== "PGRST116") {
      console.error("Error fetching time log:", timeLogErr);
      setTodayLog(null);
      return;
    }
  
    // Set the log data
    const logData = {
      id: timeLog?.id || null,
      time_in: timeLog?.time_in || null,
      time_out: timeLog?.time_out || null,
    };
    
    console.log("Setting today log:", logData);
    setTodayLog(logData);
  };

  // Get current time in Philippines timezone as "HH:MM:SS" 24h format
  const nowHms24 = () => {
    return new Date().toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

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

  // Calculate work duration
// Calculate work duration (excluding 12:00 PM - 1:00 PM lunch break)
const getWorkDuration = () => {
  if (!todayLog?.time_in) return null;
  
  const timeIn = todayLog.time_in;
  const timeOut = todayLog.time_out || nowHms24();
  
  // Convert time string to minutes from midnight
  const parseTime = (timeStr: string) => {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 60 + minutes + (seconds || 0) / 60;
  };
  
  const timeInMinutes = parseTime(timeIn);
  const timeOutMinutes = parseTime(timeOut);
  
  if (timeOutMinutes <= timeInMinutes) return null;
  
  // Define lunch break (12:00 PM to 1:00 PM = 720 to 780 minutes from midnight)
  const lunchStart = 12 * 60; // 720 minutes (12:00 PM)
  const lunchEnd = 13 * 60;   // 780 minutes (1:00 PM)
  
  let totalWorkMinutes = timeOutMinutes - timeInMinutes;
  
  // Check if lunch break overlaps with work time and subtract it
  if (timeInMinutes < lunchEnd && timeOutMinutes > lunchStart) {
    // Calculate the overlap between work time and lunch break
    const overlapStart = Math.max(timeInMinutes, lunchStart);
    const overlapEnd = Math.min(timeOutMinutes, lunchEnd);
    const lunchOverlap = overlapEnd - overlapStart;
    
    // Subtract the lunch break overlap from total work time
    totalWorkMinutes -= lunchOverlap;
  }
  
  // Ensure we don't have negative time
  if (totalWorkMinutes < 0) return null;
  
  const hours = Math.floor(totalWorkMinutes / 60);
  const minutes = Math.floor(totalWorkMinutes % 60);
  
  return `${hours}h ${minutes}m`;
};

  const handleTimeIn = async () => {
    if (!employeeId) {
      toast.error("Employee ID not found. Please refresh the page.");
      return;
    }
    
    setLoading(true);

    try {
      // Get current date in Philippines timezone
      const date = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Manila'
      });
      const time = nowHms24(); // Get current Philippines time

      console.log("Attempting to insert time log:", {
        employee_id: employeeId,
        date,
        time_in: time,
      });

      const { data, error } = await supabase.from("time_logs").insert({
        employee_id: employeeId,
        date,
        time_in: time,
      }).select();

      if (error) {
        console.error("Time in error:", error);
        toast.error(`Failed to time in: ${error.message}`);
      } else {
        console.log("Time in successful:", data);
        toast.success("Time in recorded.");
        await fetchTodayLog(employeeId);
      }
    } catch (err) {
      console.error("Unexpected error during time in:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeOut = async () => {
    if (!todayLog?.id) return;
    setLoading(true);

    const time = nowHms24(); // Get current Philippines time

    const { error } = await supabase
      .from("time_logs")
      .update({ time_out: time })
      .eq("id", todayLog.id);

    if (error) {
      console.error("Time out error:", error);
      toast.error("Failed to time out.");
    } else {
      toast.success("Time out recorded.");
      fetchTodayLog(employeeId!);
    }

    setLoading(false);
  };

  const getStatusColor = () => {
    if (!todayLog?.time_in) return "border-gray-200 bg-gray-50";
    if (!todayLog?.time_out) return "border-blue-200 bg-blue-50";
    return "border-green-200 bg-green-50";
  };

  const getStatusText = () => {
    if (!todayLog?.time_in) return "Not started";
    if (!todayLog?.time_out) return "Currently working";
    return "Work completed";
  };

  return (
    <div className="min-h-screen from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-700 to-yellow-700 bg-clip-text ">
            Time & Attendance
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Track your work hours with ease
          </p>
        </div>

        {/* Current Time Display */}
        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-mono font-bold text-gray-800 tracking-wider">
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
              <div className="mt-2 flex items-center justify-center gap-2 text-xl text-gray-600">
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
        <Card className={`border-2 shadow-xl transition-all duration-300 ${getStatusColor()}`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <User className="h-6 w-6" />
                  Today's Attendance
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  {getStatusText()}
                </CardDescription>
              </div>
              <div className="text-right">
                {todayLog?.time_in && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Timer className="h-4 w-4" />
                    Duration: {getWorkDuration() || "Calculating..."}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <Separator className="mx-6" />

          <CardContent className="pt-6 space-y-8">
            {/* Time Display Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time In Card */}
              <div className={`rounded-xl p-6 border-2 transition-all duration-300 ${
                todayLog?.time_in 
                  ? "border-green-200 bg-green-50" 
                  : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full ${
                    todayLog?.time_in ? "bg-green-100" : "bg-gray-100"
                  }`}>
                    <LogIn className={`h-5 w-5 ${
                      todayLog?.time_in ? "text-green-600" : "text-gray-400"
                    }`} />
                  </div>
                  <span className="font-semibold text-gray-700">Time In</span>
                </div>
                <div className={`text-2xl font-mono font-bold ${
                  todayLog?.time_in ? "text-green-600" : "text-gray-400"
                }`}>
                  {format12h(todayLog?.time_in)}
                </div>
              </div>

              {/* Time Out Card */}
              <div className={`rounded-xl p-6 border-2 transition-all duration-300 ${
                todayLog?.time_out 
                  ? "border-green-200 bg-green-50" 
                  : todayLog?.time_in 
                    ? "border-orange-200 bg-orange-50"
                    : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full ${
                    todayLog?.time_out 
                      ? "bg-green-100" 
                      : todayLog?.time_in 
                        ? "bg-orange-100"
                        : "bg-gray-100"
                  }`}>
                    <LogOut className={`h-5 w-5 ${
                      todayLog?.time_out 
                        ? "text-green-600" 
                        : todayLog?.time_in 
                          ? "text-orange-500"
                          : "text-gray-400"
                    }`} />
                  </div>
                  <span className="font-semibold text-gray-700">Time Out</span>
                </div>
                <div className={`text-2xl font-mono font-bold ${
                  todayLog?.time_out 
                    ? "text-green-600" 
                    : todayLog?.time_in 
                      ? "text-orange-500"
                      : "text-gray-400"
                }`}>
                  {format12h(todayLog?.time_out)}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-center">
              {!todayLog?.time_in ? (
                <Button 
                  onClick={handleTimeIn} 
                  disabled={loading} 
                  className="px-12 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      Timing in...
                    </div>
                  ) : (
                    <>
                      <LogIn className="mr-3 h-5 w-5" />
                      Start Work Day
                    </>
                  )}
                </Button>
              ) : !todayLog?.time_out ? (
                <Button 
                  onClick={handleTimeOut} 
                  disabled={loading} 
                  className="px-12 py-6 text-lg font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      Timing out...
                    </div>
                  ) : (
                    <>
                      <LogOut className="mr-3 h-5 w-5" />
                      End Work Day
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex items-center gap-3 text-green-600 font-bold text-lg">
                    <CheckCircle2 className="h-6 w-6" />
                    Work day completed!
                  </div>
                  <div className="text-center text-gray-600">
                    <p>You worked for <span className="font-semibold text-gray-800">{getWorkDuration()}</span> today</p>
                    <p className="text-sm mt-1">Great job! 🎉</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        {todayLog?.time_in && (
          <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-blue-600">
                    {format12h(todayLog.time_in).split(' ')[0]}
                  </div>
                  <div className="text-sm text-gray-600">Started at</div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-600">
                    {getWorkDuration() || "0h 0m"}
                  </div>
                  <div className="text-sm text-gray-600">Total worked</div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-purple-600">
                    {todayLog.time_out ? format12h(todayLog.time_out).split(' ')[0] : "Active"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {todayLog.time_out ? "Ended at" : "Currently working"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}