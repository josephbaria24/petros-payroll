"use client"

import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

import { useEffect, useState, useMemo } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Users,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useProtectedPage } from "../hooks/useProtectedPage"

function getStatus(net_pay: number): string {
  if (net_pay > 800000) return "On Hold"
  if (net_pay > 500000) return "Completed"
  return "Pending"
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    "Completed": "bg-slate-900 text-white border-slate-200",
    "Payment Success": "bg-slate-900 text-white border-slate-200",
    "Paid": "bg-slate-900 text-white border-slate-200",
    "Pending": "bg-white text-slate-900 border-slate-300",
    "Pending Payment": "bg-white text-slate-900 border-slate-300",
    "On Hold": "bg-slate-100 text-slate-600 border-slate-200",
    "On Hold Payment": "bg-slate-100 text-slate-600 border-slate-200",
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

type PayrollRecord = {
  id: string
  employee_code: string
  full_name: string
  pay_type: string
  period_end: string
  net_pay: number
  status: string
}

export default function DashboardPage() {
  const { isChecking } = useProtectedPage(["admin", "hr"])
  const { activeOrganization } = useOrganization()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null)
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [filter, setFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [payday, setPayday] = useState<Date | undefined>(undefined)
  const [dataLoading, setDataLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0)

  const [form, setForm] = useState({
    employee_id: "",
    period_start: "",
    period_end: "",
    net_pay: "",
    status: "Pending Payment",
  })

  const [employees, setEmployees] = useState<{ id: string, full_name: string, employee_code: string, base_salary: number }[]>([])
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [periodStart, setPeriodStart] = useState<Date | undefined>(undefined)
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(undefined)

  const selectedEmployee = employees.find(emp => emp.id === form.employee_id)

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchPayroll(),
        fetchEmployees(),
      ])
      setDataLoading(false)
    }
    loadData()
  }, [activeOrganization])

  useEffect(() => {
    const getRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()

      if (!error && profile?.role) {
        setRole(profile.role)
      }
    }
    getRole()
  }, [])

  useEffect(() => {
    setForm(f => ({
      ...f,
      period_start: periodStart ? periodStart.toISOString().split('T')[0] : "",
      period_end: periodEnd ? periodEnd.toISOString().split('T')[0] : "",
    }))
  }, [periodStart, periodEnd])

  async function fetchPayroll() {
    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_payroll_records")
      const palawanRecords = stored ? JSON.parse(stored) : []

      const storedEmployees = localStorage.getItem("palawan_employees")
      const palawanEmployees = storedEmployees ? JSON.parse(storedEmployees) : []

      const transformed = palawanRecords.map((rec: any) => {
        const emp = palawanEmployees.find((e: any) => e.id === rec.employee_id)
        return {
          id: rec.id,
          employee_code: emp?.employee_code || "N/A",
          full_name: emp?.full_name || "Unknown",
          pay_type: emp?.pay_type || "N/A",
          period_end: rec.period_end,
          net_pay: rec.net_pay,
          status: rec.status,
        }
      })

      setRecords(transformed)
      return
    }

    const { data, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_end,
        net_pay,
        status,
        employees ( full_name, employee_code, pay_type )
      `)

    if (error) {
      console.error("Error fetching payroll records:", error)
      return
    }

    const transformed = data.map((rec: any) => ({
      id: rec.id,
      employee_code: rec.employees.employee_code,
      full_name: rec.employees.full_name,
      pay_type: rec.employees.pay_type,
      period_end: rec.period_end,
      net_pay: rec.net_pay,
      status: rec.status,
    }))

    setRecords(transformed)
  }

  async function fetchEmployees() {
    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_employees")
      const palawanEmployees = stored ? JSON.parse(stored) : []
      setEmployees(palawanEmployees)
      return
    }

    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, employee_code, base_salary")

    if (error) {
      console.error("Error fetching employees:", error)
      return
    }
    setEmployees(data)
  }

  async function handleFilterByPayday(date: Date) {
    setPayday(date)
    const formatted = date.toISOString().split("T")[0]

    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_payroll_records")
      const palawanRecords = stored ? JSON.parse(stored) : []

      const storedEmployees = localStorage.getItem("palawan_employees")
      const palawanEmployees = storedEmployees ? JSON.parse(storedEmployees) : []

      const filtered = palawanRecords.filter((rec: any) => rec.period_end === formatted)

      const transformed = filtered.map((rec: any) => {
        const emp = palawanEmployees.find((e: any) => e.id === rec.employee_id)
        return {
          id: rec.id,
          employee_code: emp?.employee_code || "N/A",
          full_name: emp?.full_name || "Unknown",
          pay_type: emp?.pay_type || "N/A",
          period_end: rec.period_end,
          net_pay: rec.net_pay,
          status: rec.status,
        }
      })

      setRecords(transformed)
      return
    }

    const { data, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        employee_id,
        period_end,
        net_pay,
        status,
        employees ( full_name, employee_code, pay_type )
      `)
      .eq("period_end", formatted)

    if (error) {
      console.error("Error filtering by payday:", error)
    } else {
      const transformed = data.map((rec: any) => ({
        id: rec.id,
        employee_code: rec.employees.employee_code,
        full_name: rec.employees.full_name,
        pay_type: rec.employees.pay_type,
        period_end: rec.period_end,
        net_pay: rec.net_pay,
        status: rec.status,
      }))
      setRecords(transformed)
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Adding payment...")

    const { error } = await supabase
      .from("payroll_records")
      .insert({
        employee_id: form.employee_id,
        period_start: form.period_start,
        period_end: form.period_end,
        net_pay: parseFloat(form.net_pay),
        basic_salary: parseFloat(form.net_pay),
        gross_pay: parseFloat(form.net_pay),
        total_deductions: 0,
        status: form.status,
      })

    if (error) {
      toast.error("Failed to add payment", { id: toastId })
    } else {
      toast.success("Payment added successfully", { id: toastId })
      fetchPayroll()
      setOpen(false)
      resetForm()
    }
  }

  function resetForm() {
    setForm({
      employee_id: "",
      period_start: "",
      period_end: "",
      net_pay: "",
      status: "Pending Payment",
    })
    setPeriodStart(undefined)
    setPeriodEnd(undefined)
  }

  function handleEdit(record: PayrollRecord) {
    setEditRecord(record)
    setOpen(true)
    setForm({
      employee_id: record.id,
      period_start: "",
      period_end: record.period_end,
      net_pay: record.net_pay.toString(),
      status: record.status,
    })
  }

  async function handleDeleteConfirm() {
    if (!deleteRecordId) return

    const toastId = toast.loading("Deleting payment...")
    const { error } = await supabase.from("payroll_records").delete().eq("id", deleteRecordId)

    if (error) toast.error("Failed to delete", { id: toastId })
    else {
      toast.success("Deleted successfully", { id: toastId })
      fetchPayroll()
    }
    setDeleteRecordId(null)
  }

  async function handleStatusUpdate(id: string, newStatus: string) {
    const toastId = toast.loading("Updating status...")

    const { error } = await supabase
      .from("payroll_records")
      .update({ status: newStatus })
      .eq("id", id)

    if (error) {
      toast.error("Failed to update status.", { id: toastId })
    } else {
      toast.success(`Status updated to "${newStatus}"`, { id: toastId })
      fetchPayroll()
    }
  }

  const periods = useMemo(() => {
    const unique = Array.from(new Set(records.map(r => r.period_end)))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    return unique
  }, [records])

  const selectedPeriod = periods[currentPeriodIndex]

  const filteredRecords = records.filter(record => {
    const matchesPeriod = !selectedPeriod || record.period_end === selectedPeriod
    const matchesFilter = filter === "all" || record.pay_type === filter
    const matchesSearch = record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesPeriod && matchesFilter && matchesSearch
  })

  // --- CHART DATA TRANSFORMATIONS ---

  const trendData = useMemo(() => {
    const monthlyMap = new Map()
    records.forEach(r => {
      const month = new Date(r.period_end).toLocaleString('default', { month: 'short', year: '2-digit' })
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + r.net_pay)
    })
    return Array.from(monthlyMap).map(([name, total]) => ({ name, total: total as number })).reverse().slice(-6)
  }, [records])

  const categoryData = useMemo(() => {
    const catMap = new Map()
    records.forEach(r => {
      catMap.set(r.pay_type, (catMap.get(r.pay_type) || 0) + r.net_pay)
    })
    return Array.from(catMap).map(([name, value]) => ({ name, value: value as number }))
  }, [records])

  const statusData = useMemo(() => {
    const statMap = new Map()
    records.forEach(r => {
      statMap.set(r.status, (statMap.get(r.status) || 0) + 1)
    })
    return Array.from(statMap).map(([name, value]) => ({ name, value: value as number }))
  }, [records])

  const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1']

  // --- END CHART DATA TRANSFORMATIONS ---

  // Calculate metrics
  const totalPayroll = records.reduce((sum, r) => sum + r.net_pay, 0)
  const completedPayments = records.filter(r => r.status.includes("Success") || r.status === "Paid").length
  const pendingPayments = records.filter(r => r.status.includes("Pending")).length

  if (isChecking || !role || dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-slate-400 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      {/* <div className="bg-white border-b">
        <div className="px-6 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-slate-600">
                  Payroll Management
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div> */}

      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">
          Monitor and manage employee payroll efficiently
        </p>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Payroll Trends</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Total payout distribution over time</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
              <div className="h-2 w-2 rounded-full bg-slate-900" />
              <span className="text-[10px] font-medium text-slate-600">Net Pay</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4 flex-1">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Total Payout']}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#0f172a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution (Donut) */}
        <Card className="border-0 shadow-sm flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold text-slate-900">Payment Status</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Current processing status</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0">
            <div className="h-[210px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="mt-auto space-y-2 pb-2 px-2">
              {statusData.slice(0, 3).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-0 shadow-sm flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Financial Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 flex-1">
            <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Payroll</p>
                <p className="text-lg font-bold text-slate-900">₱{totalPayroll.toLocaleString()}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <DollarSign className="h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Processed</p>
                <p className="text-lg font-bold text-slate-900">{completedPayments}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Bar Chart */}
        <Card className="lg:col-span-3 border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900">Payroll by Employment Type</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Comparison of net pay distribution</p>
          </CardHeader>
          <CardContent>
            <div className="h-[130px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Amount']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Tabs defaultValue="all" onValueChange={setFilter} className="w-full sm:w-fit">
                <TabsList className="grid w-full grid-cols-5 sm:w-fit">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="Member" className="text-xs">Member</TabsTrigger>
                  <TabsTrigger value="Staff" className="text-xs">Staff</TabsTrigger>
                  <TabsTrigger value="Freelance" className="text-xs">Freelance</TabsTrigger>
                  <TabsTrigger value="Part-Time" className="text-xs">Part-Time</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>

            {/* Period Navigation (Cuts) */}
            <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-slate-200">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPeriodIndex(prev => Math.min(periods.length - 1, prev + 1))}
                disabled={currentPeriodIndex >= periods.length - 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center min-w-[140px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Current Cut</span>
                <span className="text-xs font-semibold text-slate-900">
                  {selectedPeriod ? new Date(selectedPeriod).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "No Periods"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPeriodIndex(prev => Math.max(0, prev - 1))}
                disabled={currentPeriodIndex <= 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {payday ? payday.toLocaleDateString() : "Filter by Date"}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={payday}
                    onSelect={(date) => {
                      if (date) handleFilterByPayday(date)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Dialog open={open} onOpenChange={(v) => {
                setOpen(v)
                if (!v) {
                  setEditRecord(null)
                  resetForm()
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                    <Plus className="w-4 h-4 mr-2" />
                    New Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="lg:w-[50vw]">
                  <DialogHeader>
                    <DialogTitle>
                      {editRecord ? `Edit Payment - ${editRecord.full_name}` : "Add New Payment"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddPayment} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {selectedEmployee
                              ? `${selectedEmployee.full_name} (${selectedEmployee.employee_code})`
                              : "Select employee..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search employee..." />
                            <CommandList>
                              <CommandEmpty>No employee found.</CommandEmpty>
                              {employees.map(emp => (
                                <CommandItem
                                  key={emp.id}
                                  value={emp.id}
                                  onSelect={() => {
                                    setForm((prev) => ({
                                      ...prev,
                                      employee_id: emp.id,
                                      net_pay: emp.base_salary ? (emp.base_salary / 2).toString() : "",
                                    }))
                                    setEmployeePopoverOpen(false)
                                  }}
                                >
                                  {emp.full_name} ({emp.employee_code})
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      form.employee_id === emp.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Period Start</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div
                              className={cn(
                                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-3 w-full justify-start font-normal cursor-pointer",
                                !periodStart && "text-slate-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {periodStart ? periodStart.toLocaleDateString() : "Select date"}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={periodStart}
                              onSelect={(date) => setPeriodStart(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>Period End</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start font-normal",
                                !periodEnd && "text-slate-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {periodEnd ? periodEnd.toLocaleDateString() : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={periodEnd}
                              onSelect={(date) => setPeriodEnd(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Net Pay</Label>
                        <Input
                          type="number"
                          value={form.net_pay}
                          onChange={(e) => setForm({ ...form, net_pay: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={form.status}
                          onValueChange={v => setForm({ ...form, status: v })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending Payment">Pending Payment</SelectItem>
                            <SelectItem value="Payment Success">Payment Success</SelectItem>
                            <SelectItem value="On Hold Payment">On Hold Payment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">
                      {editRecord ? "Update Payment" : "Add Payment"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
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
                  <TableHead className="font-medium text-slate-900">Pay Period</TableHead>
                  <TableHead className="font-medium text-slate-900">Amount</TableHead>
                  <TableHead className="font-medium text-slate-900">Category</TableHead>
                  <TableHead className="font-medium text-slate-900">Status</TableHead>
                  <TableHead className="font-medium text-slate-900 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900">{record.full_name}</div>
                        <div className="text-sm text-slate-500">{record.employee_code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {new Date(record.period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      ₱{record.net_pay.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {record.pay_type}
                    </TableCell>
                    <TableCell>
                      {statusBadge(record.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(record)}>
                            Edit Payment
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Update Status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(record.id, "Pending Payment")}>
                                Mark as Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(record.id, "Payment Success")}>
                                Mark as Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(record.id, "On Hold Payment")}>
                                Put On Hold
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <Separator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setDeleteRecordId(record.id)
                                }}
                              >
                                Delete Payment
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Payment Record</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. The payroll record for {record.full_name} will be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteConfirm}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-2">
                <Users className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">No payments found</h3>
              <p className="text-slate-500">
                {searchTerm || filter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Get started by adding your first payment record"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}