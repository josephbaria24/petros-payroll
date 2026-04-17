"use client"

import { useEffect, useState, useMemo } from "react"
import { format, startOfWeek, endOfWeek, addDays, isSameDay, differenceInWeeks, isBefore, startOfDay } from "date-fns"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useHoliday } from "@/contexts/HolidayContext"
import { cn } from "@/lib/utils"
import { 
  Clock, 
  Play, 
  Pause, 
  LogOut, 
  Calendar as CalendarIcon, 
  Timer, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  PhilippinePeso,
  History,
  LayoutDashboard,
  Filter,
  MoreVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "@/lib/toast"
import { sileo } from "sileo"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"

type TimeLog = {
  id: string
  date: string
  time_in: string | null
  time_out: string | null
  total_hours: number | null
  overtime_hours: number | null
  status: string | null
  break_duration?: number // in minutes
}

export default function TimeSheetPage() {
  const { activeOrganization } = useOrganization()
  const { holidayMap } = useHoliday()
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<any>(null)
  const [todayLog, setTodayLog] = useState<any>(null)
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [allLogs, setAllLogs] = useState<TimeLog[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weekOffset, setWeekOffset] = useState(0)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [currentBreakStart, setCurrentBreakStart] = useState<string | null>(null)

  const currentWeekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })
  const currentWeekEnd = endOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })

  // 🕒 Update Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 🔄 Initial Load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch Employee Details
      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("*")
        .ilike("email", user.email || "")
        .maybeSingle()

      if (empErr || !emp) {
        toast.error("Employee profile not found")
        setLoading(false)
        return
      }

      setEmployee(emp)
      await fetchLogs(emp)
      setLoading(false)
    }

    init()
  }, [activeOrganization, weekOffset])

  const fetchLogs = async (emp: any) => {
    if (!emp) return

    const now = new Date()
    const phDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayStr = phDate.toISOString().split('T')[0]

    // 1. Fetch Today's Specific Log
    const { data: todayRecords } = await supabase
      .from("time_logs")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("date", todayStr)
      .maybeSingle()

    // 2. Fetch Attendance Events (Break tracking)
    const { data: events } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", emp.attendance_log_userid)
      .eq("work_date", todayStr)
      .order("timestamp", { ascending: true })

    // Calculate breaks from events
    let totalBreakMins = 0
    let lastBreakIn: any = null
    let activeBreakStart: any = null

    if (events) {
      events.forEach(event => {
        if (event.status === 'break_in') {
          lastBreakIn = new Date(event.timestamp)
          activeBreakStart = event.timestamp
        } else if (event.status === 'break_out' && lastBreakIn) {
          const breakOut = new Date(event.timestamp)
          const diff = (breakOut.getTime() - lastBreakIn.getTime()) / (1000 * 60)
          totalBreakMins += diff
          lastBreakIn = null
          activeBreakStart = null
        }
      })
    }

    setTodayLog({
      ...todayRecords,
      total_break_mins: totalBreakMins
    })

    setIsOnBreak(!!activeBreakStart)
    setCurrentBreakStart(activeBreakStart)

    // 3. Fetch Weekly History
    const weekStartStr = format(currentWeekStart, "yyyy-MM-dd")
    const weekEndStr = format(currentWeekEnd, "yyyy-MM-dd")

    const { data: weeklyData } = await supabase
      .from("time_logs")
      .select("*")
      .eq("employee_id", emp.id)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr)
      .order("date", { ascending: false })

    setLogs(weeklyData || [])

    // 4. Fetch broader history for Calendar Indicators (last 180 days)
    const historyStart = format(addDays(new Date(), -180), "yyyy-MM-dd")
    const { data: historyData } = await supabase
      .from("time_logs")
      .select("*")
      .eq("employee_id", emp.id)
      .gte("date", historyStart)
      .order("date", { ascending: false })
    
    setAllLogs(historyData || [])
  }

  // 🚀 Action Handlers
  const handleClockIn = async () => {
    sileo.info({ 
      title: "Action Disabled", 
      description: "Please use the biometrics device to clock in.",
      fill: "black",
      styles: {
        title: "text-white!",
        description: "text-white/75!",
      }
    })
  }

  const handleToggleBreak = async () => {
    sileo.info({ 
      title: "Action Disabled", 
      description: "Please log your breaks through the biometrics device.",
      fill: "black",
      styles: {
        title: "text-white!",
        description: "text-white/75!",
      }
    })
  }

  const handleClockOut = async () => {
    sileo.info({ 
      title: "Action Disabled", 
      description: "Please use the biometrics device to clock out.",
      fill: "black",
      styles: {
        title: "text-white!",
        description: "text-white/75!",
      }
    })
  }

  // 📊 Helpers & Metrics
  const formatTime = (time: string | null) => {
    if (!time) return "--:--"
    const [h, m] = time.split(':')
    const date = new Date()
    date.setHours(parseInt(h), parseInt(m))
    return format(date, "h:mm aa")
  }

  const computeWorkingHours = (log: any) => {
    if (log.total_hours) return Number(log.total_hours)
    if (!log.time_in || !log.time_out) return 0

    const [inH, inM] = log.time_in.split(':').map(Number)
    const [outH, outM] = log.time_out.split(':').map(Number)

    let inMins = inH * 60 + inM
    let outMins = outH * 60 + outM

    if (outMins < inMins) outMins += 24 * 60 // cross midnight

    let diffMins = outMins - inMins
    // Deduct standard 1-hour break if shift > 5 hours
    if (diffMins > 300) diffMins -= 60
    
    return Math.max(0, diffMins / 60)
  }

  const calculateWages = (hours: number) => {
    if (!employee || !employee.base_salary) return 0
    let hourlyRate = 0
    if (employee.pay_type === "hourly") hourlyRate = employee.base_salary
    else if (employee.pay_type === "daily") hourlyRate = employee.base_salary / 8
    else hourlyRate = employee.base_salary / 160 // default monthly conversion

    return hours * hourlyRate
  }

  const stats = useMemo(() => {
    const totalHrs = logs.reduce((acc, log) => acc + computeWorkingHours(log), 0)
    const totalWages = calculateWages(totalHrs)
    
    // Real Weekly Insights
    const daysWithLogs = logs.length
    const attendanceRate = Math.min(Math.round((daysWithLogs / 5) * 100), 100)
    const lateArrivals = logs.filter(l => l.status === 'Late').length
    const avgHours = daysWithLogs > 0 ? (totalHrs / daysWithLogs).toFixed(1) : "0.0"

    return {
      totalHours: totalHrs.toFixed(2),
      wages: totalWages,
      periodHours: totalHrs.toFixed(2), // Simplification for now
      attendanceRate: `${attendanceRate}%`,
      lateArrivals: `${lateArrivals} day${lateArrivals !== 1 ? 's' : ''}`,
      avgHours: `${avgHours}h`
    }
  }, [logs, employee])

  if (loading && !employee) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-medium animate-pulse text-muted-foreground">Initializing TimeSheet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <LayoutDashboard className="h-7 w-7 text-primary" />
              </div>
              TimeSheet
            </h1>
            <p className="text-muted-foreground font-medium">Manage your attendance and work logs</p>
          </div>

          <Tabs defaultValue="tracking" className="w-full md:w-[400px]">
            <TabsList className="grid grid-cols-3 bg-card border border-border shadow-sm p-1 h-11 rounded-xl">
              <TabsTrigger value="tracking" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-semibold">Tracking</TabsTrigger>
              <TabsTrigger value="management" className="rounded-lg font-semibold">Management</TabsTrigger>
              <TabsTrigger value="payroll" className="rounded-lg font-semibold">Payroll</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Controls - Clock Area */}
          <div className="lg:col-span-8 space-y-8">
            <Card className="border border-border shadow-lg overflow-hidden bg-card/50 backdrop-blur-xl rounded-3xl">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-12">
                  
                  {/* Date Badge */}
                  <div className="md:col-span-2 bg-red-500 p-6 flex flex-col items-center justify-center text-white space-y-1 md:rounded-l-3xl">
                    <span className="text-sm font-bold uppercase tracking-widest opacity-80">{format(currentTime, "MMM")}</span>
                    <span className="text-5xl font-black">{format(currentTime, "dd")}</span>
                  </div>

                  {/* Clock Controls */}
                  <div className="md:col-span-10 p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex gap-4">
                      {todayLog?.time_in && !todayLog?.time_out ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="lg"
                            onClick={handleToggleBreak}
                            className={`h-16 px-8 rounded-2xl border-2 transition-all font-bold text-lg flex gap-3 ${
                              isOnBreak 
                                ? "border-amber-500 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20" 
                                : "border-primary text-primary bg-primary/5 hover:bg-primary/10"
                            }`}
                          >
                            {isOnBreak ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
                            {isOnBreak ? "End Break" : "Start Break"}
                          </Button>

                          <Button 
                            variant="destructive" 
                            size="lg"
                            onClick={handleClockOut}
                            className="h-16 px-10 rounded-2xl font-bold text-lg bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-red-900/20 transition-all flex gap-3"
                          >
                            <LogOut className="h-6 w-6" />
                            Clock Out
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="lg"
                          disabled={loading || !!todayLog?.time_out}
                          onClick={handleClockIn}
                          className="h-16 px-12 rounded-2xl font-bold text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 dark:shadow-primary/10 transition-all flex gap-3 disabled:opacity-50"
                        >
                          <Play className="h-6 w-6" />
                          {todayLog?.time_out ? "Logs Completed" : "Clock In"}
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-12 text-center md:text-left">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center md:justify-start gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          Clock In
                        </p>
                        <p className="text-3xl font-black text-foreground">{formatTime(todayLog?.time_in)}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center md:justify-start gap-2">
                          <History className="h-4 w-4" />
                          Breaks
                        </p>
                        <p className="text-3xl font-black text-foreground">
                          {todayLog?.total_break_mins ? `${Math.floor(todayLog.total_break_mins / 60)}:${(todayLog.total_break_mins % 60).toString().padStart(2, '0')} mins` : "0:00 mins"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "This Pay Period", value: stats.periodHours, unit: "hrs", icon: Timer },
                { label: "Total Hours", value: stats.totalHours, unit: "hrs", icon: Clock },
                { label: "Total Hours Paid", value: stats.totalHours, unit: "hrs", icon: CheckCircle2 },
                { label: "Total Wages", value: stats.wages.toLocaleString(), unit: "₱", icon: PhilippinePeso, isCurrency: true },
              ].map((metric, i) => (
                <Card key={i} className="border border-border shadow-md bg-card hover:shadow-lg transition-all rounded-2xl overflow-hidden group">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{metric.label}</p>
                      <metric.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      {metric.isCurrency && <span className="text-muted-foreground font-bold">{metric.unit}</span>}
                      <span className="text-2xl font-black text-foreground tracking-tight">{metric.value}</span>
                      {!metric.isCurrency && <span className="text-muted-foreground font-bold text-sm tracking-tight">{metric.unit}</span>}
                    </div>
                    <div className="h-1 w-12 bg-muted rounded-full group-hover:bg-primary/30 transition-all" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Attendance Table Card */}
            <Card className="shadow-xl bg-card border border-border rounded-3xl overflow-hidden">
              <CardHeader className="p-8 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <CardTitle className="text-xl font-bold flex items-center justify-center md:justify-start gap-3 text-foreground">
                    <CalendarIcon className="h-6 w-6 text-primary" />
                    Attendance History
                  </CardTitle>
                  <CardDescription>Review your past logs and working hours</CardDescription>
                </div>
                
                <div className="flex flex-wrap justify-center gap-3">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10 rounded-xl"
                      onClick={() => setWeekOffset(prev => prev - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-10 font-bold px-4 hover:bg-primary/5 rounded-xl border border-transparent hover:border-primary/20"
                        >
                          <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                          {weekOffset === 0 ? "This Week" : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <TooltipProvider>
                          <Calendar
                            mode="single"
                            selected={currentWeekStart}
                            onSelect={(date) => {
                              if (date) {
                                const now = new Date()
                                const diff = differenceInWeeks(startOfWeek(date, { weekStartsOn: 1 }), startOfWeek(now, { weekStartsOn: 1 }))
                                setWeekOffset(diff)
                              }
                            }}
                            modifiers={{
                              fullDay: (date) => {
                                const log = allLogs.find(l => isSameDay(new Date(l.date), date))
                                return !!(log && computeWorkingHours(log) >= 8)
                              },
                              emptyDay: (date) => {
                                if (date.getDay() === 0 || date.getDay() === 6) return false
                                if (!isBefore(date, startOfDay(new Date()))) return false
                                const log = allLogs.find(l => isSameDay(new Date(l.date), date))
                                return !log
                              }
                            }}
                            modifiersClassNames={{
                              fullDay: "bg-amber-400 text-amber-950 hover:bg-amber-500 font-bold dark:bg-amber-500 dark:text-amber-950",
                              emptyDay: "opacity-30 grayscale"
                            }}
                            components={{
                              DayButton: (props) => {
                                const { day, modifiers, ...rest } = props
                                const date = day.date
                                const log = allLogs.find(l => isSameDay(new Date(l.date), date))
                                
                                let tooltipContent = "No attendance recorded"
                                if (log) {
                                  const hrs = computeWorkingHours(log).toFixed(1)
                                  tooltipContent = `${hrs} Hours - ${computeWorkingHours(log) >= 8 ? "Full Day Completed" : "Partial Day"}`
                                } else if (date.getDay() === 0 || date.getDay() === 6) {
                                  tooltipContent = "Weekend"
                                }

                                const hName = holidayMap[format(date, "yyyy-MM-dd")]
                                if (hName) {
                                  tooltipContent = log ? `${hName} (${tooltipContent})` : hName
                                }

                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CalendarDayButton 
                                        day={day} 
                                        modifiers={modifiers} 
                                        className={cn(
                                          modifiers.fullDay && "bg-amber-400 text-amber-950 hover:bg-amber-500 font-bold dark:bg-amber-500 dark:text-amber-950",
                                          modifiers.emptyDay && "opacity-30 grayscale"
                                        )}
                                        {...rest} 
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="font-semibold">
                                      {tooltipContent}
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              }
                            }}
                            initialFocus
                          />
                        </TooltipProvider>
                      </PopoverContent>
                    </Popover>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10 rounded-xl"
                      onClick={() => setWeekOffset(prev => prev + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Select defaultValue="all">
                    <SelectTrigger className="w-[130px] h-10 border-border rounded-xl font-semibold bg-background">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Present">Present</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest pl-8">Date</TableHead>
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Check In</TableHead>
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Check Out</TableHead>
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Meal Break</TableHead>
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Working Hours</TableHead>
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                        <TableHead className="py-5 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right pr-8">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length > 0 ? (
                        logs.map((log) => (
                          <TableRow key={log.id} className="border-b border-border hover:bg-muted/20 transition-all cursor-default group">
                            <TableCell className="py-6 font-bold text-foreground pl-8">
                              {format(new Date(log.date), "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell className="py-6 font-medium text-muted-foreground">{formatTime(log.time_in)}</TableCell>
                            <TableCell className="py-6 font-medium text-muted-foreground">{formatTime(log.time_out)}</TableCell>
                            <TableCell className="py-6 font-medium text-muted-foreground">1:00 hr</TableCell>
                            <TableCell className="py-6 font-bold text-foreground">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-primary/20" />
                                {computeWorkingHours(log).toFixed(2)} hrs
                              </div>
                            </TableCell>
                            <TableCell className="py-6">
                              <Badge variant="outline" className={`rounded-full font-bold px-3 py-1 text-[10px] uppercase tracking-wider ${
                                log.status === 'Present' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                              }`}>
                                {log.status || 'Present'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-6 text-right pr-8">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-20 text-center space-y-4">
                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                              <CalendarIcon className="h-10 w-10 opacity-20" />
                              <p className="font-semibold tracking-tight">No time logs found for this period</p>
                              <p className="text-sm">Start by clocking in above!</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area - Insights/Profile */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="border-0 shadow-lg rounded-3xl bg-muted/50 border border-border text-foreground overflow-hidden">
              <CardContent className="p-0">
                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-black text-primary">
                      {employee?.full_name?.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black tracking-tight leading-tight">{employee?.full_name}</p>
                      <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">{employee?.position || "Staff Member"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background/50 rounded-2xl p-4 space-y-1 border border-border transition-colors">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Department</p>
                      <p className="font-bold text-sm tracking-tight">{employee?.department || "Unassigned"}</p>
                    </div>
                    <div className="bg-background/50 rounded-2xl p-4 space-y-1 border border-border transition-colors">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Shift</p>
                      <p className="font-bold text-sm tracking-tight">{employee?.shift || "Regular Day"}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-muted p-4 text-center border-t border-border">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground hover:bg-background/50 font-bold text-xs gap-2">
                    View Full Profile
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-3xl bg-card border border-border overflow-hidden">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-lg font-bold flex items-center gap-3 text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Weekly Insights
                </CardTitle>
                <CardDescription>Based on logs in current view</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                {[
                  { label: "Attendance Rate", value: stats.attendanceRate, color: "bg-emerald-500" },
                  { label: "Late Arrivals", value: stats.lateArrivals, color: "bg-amber-500" },
                  { label: "Average Hours", value: stats.avgHours, color: "bg-primary" },
                ].map((insight, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{insight.label}</span>
                      <span className="text-sm font-black text-foreground">{insight.value}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${insight.color} rounded-full transition-all duration-700 ease-out`} 
                        style={{ 
                          width: insight.label === "Attendance Rate" 
                            ? insight.value 
                            : insight.label === "Late Arrivals" 
                              ? `${Math.max(0, 100 - (parseInt(insight.value) * 20))}%` 
                              : `${Math.min(100, (parseFloat(insight.value) / 8) * 100)}%`
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}