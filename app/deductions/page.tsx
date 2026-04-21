"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Plus, PhilippinePeso, Users, TrendingUp, Calculator, FileText, Edit, Trash2, ChevronLeft, ChevronRight, Search } from "lucide-react"
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
import { useProtectedPage } from "../hooks/useProtectedPage"

type Deduction = {
  id: string
  employee_id: string
  employee_name?: string
  employee_code?: string
  type: string
  amount: number
  notes?: string
}

type DeductionType = {
  id: string
  name: string
  is_mandatory: boolean
  default_amount: number
}

type PivotedDeduction = {
  employee_id: string
  employee_name: string
  employee_code?: string
  amounts: Record<string, number> // type name -> amount
  notes: Record<string, string> // type name -> notes
  ids: Record<string, string> // type name -> deduction record id
}


const deductionTypeVariants: Record<string, string> = {
  "SSS": "bg-primary text-primary-foreground border-transparent",
  "PhilHealth": "bg-muted text-muted-foreground border-border",
  "Pag-ibig": "bg-muted/50 text-muted-foreground border-border",
  "Other": "bg-muted/50 text-muted-foreground border-border",
}

export default function DeductionsPage() {
  useProtectedPage(["admin", "hr"], "deductions")
  const { activeOrganization } = useOrganization()

  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string; employee_code: string }[]>([])
  const [open, setOpen] = useState(false)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [editType, setEditType] = useState<DeductionType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const pageSize = 10

  const [form, setForm] = useState({
    employee_id: "",
    type: "",
    amount: "",
    notes: "",
  })

  // Aggregate totals per employee
  const totals = deductions.reduce<Record<string, number>>((acc, d) => {
    if (!acc[d.employee_name || "Unknown"]) acc[d.employee_name || "Unknown"] = 0
    acc[d.employee_name || "Unknown"] += d.amount
    return acc
  }, {})

  const grandTotal = deductions.reduce((sum, d) => sum + d.amount, 0)

  // Calculate summary metrics
  const summaryMetrics = {
    totalDeductions: deductions.length,
    totalEmployees: Object.keys(totals).length,
    averageDeduction: deductions.length > 0 ? grandTotal / deductions.length : 0,
    sssTotal: deductions.filter(d => d.type === 'sss').reduce((sum, d) => sum + d.amount, 0),
    philhealthTotal: deductions.filter(d => d.type === 'philhealth').reduce((sum, d) => sum + d.amount, 0),
    pagibigTotal: deductions.filter(d => d.type === 'pagibig').reduce((sum, d) => sum + d.amount, 0),
    otherTotal: deductions.filter(d => d.type === 'other').reduce((sum, d) => sum + d.amount, 0),
  }

  useEffect(() => {
    fetchDeductions()
    fetchDeductionTypes()
    fetchEmployees()
  }, [activeOrganization])

  async function fetchDeductionTypes() {
    if (activeOrganization === "pdn") {
      // PDN uses a simple default list for now (can be extended with a pdn_deduction_types table later)
      setDeductionTypes([
        { id: "1", name: "SSS", is_mandatory: true, default_amount: 0 },
        { id: "2", name: "PhilHealth", is_mandatory: true, default_amount: 0 },
        { id: "3", name: "Pag-ibig", is_mandatory: true, default_amount: 0 },
        { id: "4", name: "Other", is_mandatory: false, default_amount: 0 },
      ])
      return
    }

    const { data, error } = await supabase.from("deduction_types").select("*").order("name")
    if (error) {
      console.error(error)
      return
    }

    if (data.length === 0) {
      // Seed mandatory types if empty (Supabase usually has them but good fallback)
      setDeductionTypes([
        { id: "sss", name: "SSS", is_mandatory: true, default_amount: 0 },
        { id: "philhealth", name: "PhilHealth", is_mandatory: true, default_amount: 0 },
        { id: "pagibig", name: "Pag-ibig", is_mandatory: true, default_amount: 0 },
        { id: "other", name: "Other", is_mandatory: false, default_amount: 0 },
      ])
    } else {
      setDeductionTypes(data)
    }
  }

  async function fetchDeductions() {
    if (activeOrganization === "pdn") {
      const { data, error } = await supabase
        .from("pdn_deductions")
        .select("id, employee_id, type, amount, notes, pdn_employees(full_name, employee_code)")
        .order("id", { ascending: false })

      if (error) {
        console.error("Error fetching PDN deductions:", error)
        return
      }

      setDeductions(
        data.map((d: any) => ({
          id: d.id,
          employee_id: d.employee_id,
          employee_name: d.pdn_employees?.full_name,
          employee_code: d.pdn_employees?.employee_code,
          type: d.type,
          amount: d.amount,
          notes: d.notes,
        }))
      )
      return
    }

    const { data, error } = await supabase
      .from("deductions")
      .select("id, employee_id, type, amount, notes, employees(full_name, employee_code)")
      .order("id", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setDeductions(
      data.map((d: any) => ({
        id: d.id,
        employee_id: d.employee_id,
        employee_name: d.employees?.full_name,
        employee_code: d.employees?.employee_code,
        type: d.type,
        amount: d.amount,
        notes: d.notes,
      }))
    )
  }

  async function fetchEmployees() {
    if (activeOrganization === "pdn") {
      const { data, error } = await supabase.from("pdn_employees").select("id, full_name, employee_code")
      if (error) {
        console.error("Error fetching PDN employees:", error)
        return
      }
      setEmployees(data || [])
      return
    }

    const { data, error } = await supabase.from("employees").select("id, full_name, employee_code")
    if (error) {
      console.error(error)
      return
    }
    setEmployees(data)
  }

  // Pivot deductions data for the table
  const pivotedData: PivotedDeduction[] = employees.map(emp => {
    const empDeductions = deductions.filter(d => d.employee_id === emp.id)
    const amounts: Record<string, number> = {}
    const notes: Record<string, string> = {}
    const ids: Record<string, string> = {}

    deductionTypes.forEach(dt => {
      const match = empDeductions.find(d => d.type === dt.name)
      if (match) {
        amounts[dt.name] = match.amount
        notes[dt.name] = match.notes || ""
        ids[dt.name] = match.id
      } else {
        amounts[dt.name] = 0
        notes[dt.name] = ""
        ids[dt.name] = ""
      }
    })

    return {
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code,
      amounts,
      notes,
      ids
    }
  })

  // Group summary metrics calculation remains flat
  const flatDeductionsForMetrics = deductions;

  async function applyDeductionsToExistingPayroll(employeeId: string, deductionsList: Array<{ type: string, amount: number }>) {
    try {
      if (activeOrganization === "pdn") {
        // ... handled in handleSubmit usually or similar
        return
      }

      const { data: latestPayroll, error } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("employee_id", employeeId)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error || !latestPayroll) {
        console.log("No recent payroll found for employee")
        return
      }

      const columnMap: Record<string, string> = {
        sss: "sss",
        philhealth: "philhealth",
        pagibig: "pagibig",
        sss_loan: "loans",
        pagibig_loan: "loans",
        salary_loan: "loans",
        other: "loans"
      }

      const updates: Record<string, number> = { ...latestPayroll }
      let hasCustomColumns = false

      deductionsList.forEach(({ type, amount }) => {
        const column = columnMap[type.toLowerCase()]
        if (column) {
          updates[column] = (latestPayroll[column] || 0) + amount
          hasCustomColumns = true
        } else {
          // If it's a dynamic type not in standard columns, add to loans for now or a generic bucket
          updates.loans = (updates.loans || 0) + amount
          hasCustomColumns = true
        }
      })

      if (hasCustomColumns) {
        const basicSalary = updates.basic_salary || 0
        const overtimePay = updates.overtime_pay || 0
        const allowances = updates.allowances || 0
        const nightDiff = updates.night_diff || 0
        const holidayPay = updates.holiday_pay || 0

        const sss = updates.sss || 0
        const philhealth = updates.philhealth || 0
        const pagibig = updates.pagibig || 0
        const withholdingTax = updates.withholding_tax || 0
        const loans = updates.loans || 0
        const absences = updates.absences || 0
        const cashAdvance = updates.cash_advance || 0
        const uniform = updates.uniform || 0
        const tardiness = updates.tardiness || 0

        const grossPay = basicSalary + overtimePay + nightDiff + holidayPay + allowances
        const totalDeductions = sss + philhealth + pagibig + withholdingTax + loans + absences + cashAdvance + uniform + tardiness
        const netPay = grossPay - totalDeductions

        await supabase
          .from("payroll_records")
          .update({
            sss, philhealth, pagibig, withholding_tax: withholdingTax, loans,
            gross_pay: grossPay,
            total_deductions: totalDeductions,
            net_pay: netPay
          })
          .eq("id", latestPayroll.id)
      }

    } catch (error) {
      console.error("Error applying deduction to payroll:", error)
    }
  }

  async function handleRowSubmit(employeeId: string, amounts: Record<string, number>, notes: Record<string, string>) {
    const toastId = toast.loading("Saving employee deductions...")

    try {
      const recordsToInsert = Object.entries(amounts).map(([typeName, amount]) => ({
        employee_id: employeeId,
        type: typeName,
        amount: amount,
        notes: notes[typeName] || ""
      }))

      // Filtering out zero amounts if we want, or keep them to represent explicit zero
      // For now, let's only save non-zero or existing records that are being zeroed

      if (activeOrganization === "pdn") {
        // Remove old records for this employee
        await supabase.from("pdn_deductions").delete().eq("employee_id", employeeId)

        // Insert new ones
        const newRecords = recordsToInsert.filter(r => r.amount > 0)
        if (newRecords.length > 0) {
          const { error } = await supabase.from("pdn_deductions").insert(newRecords)
          if (error) throw error
        }

        toast.success("Deductions updated!", { id: toastId })
        setOpen(false)
        fetchDeductions()
        return
      }

      // Supabase: Upsert by deleting old and inserting new for that employee
      // OR better, individual upserts. Let's do a replace all for simplicity if small volume
      await supabase.from("deductions").delete().eq("employee_id", employeeId)

      const { error } = await supabase.from("deductions").insert(recordsToInsert.filter(r => r.amount > 0))

      if (error) throw error

      await applyDeductionsToExistingPayroll(employeeId, recordsToInsert)

      toast.success("Deductions saved and applied!", { id: toastId })
      setOpen(false)
      fetchDeductions()
    } catch (err) {
      console.error(err)
      toast.error("Error saving deductions", { id: toastId })
    }
  }

  async function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading(editType ? "Updating type..." : "Adding type...")

    const formData = new FormData(e.target as HTMLFormElement)
    const payload = {
      name: formData.get("name") as string,
      is_mandatory: formData.get("is_mandatory") === "on",
      default_amount: parseFloat(formData.get("default_amount") as string || "0"),
    }

    if (activeOrganization === "pdn") {
      // PDN uses static deduction types for now
      toast.info("PDN deduction types are managed from the default list.", { id: toastId })
      setTypeDialogOpen(false)
      setEditType(null)
      return
    }

    let error
    if (editType) {
      const res = await supabase.from("deduction_types").update(payload).eq("id", editType.id)
      error = res.error
    } else {
      const res = await supabase.from("deduction_types").insert(payload)
      error = res.error
    }

    if (error) {
      toast.error("Error saving type", { id: toastId })
    } else {
      toast.success("Deduction type saved!", { id: toastId })
      setTypeDialogOpen(false)
      setEditType(null)
      fetchDeductionTypes()
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    const toastId = toast.loading("Deleting deduction...")

    if (activeOrganization === "pdn") {
      const { error } = await supabase.from("pdn_deductions").delete().eq("id", deleteId)
      if (error) {
        toast.error("Error deleting deduction", { id: toastId })
      } else {
        toast.success("Deduction deleted!", { id: toastId })
        fetchDeductions()
      }
      setDeleteId(null)
      return
    }

    const { error } = await supabase.from("deductions").delete().eq("id", deleteId)
    if (error) {
      toast.error("Error deleting deduction", { id: toastId })
    } else {
      toast.success("Deduction deleted!", { id: toastId })
      fetchDeductions()
    }
    setDeleteId(null)
  }

  // Filtering and Pagination logic
  const filteredData = pivotedData.filter(row => 
    row.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.employee_code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedPivotedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background text-foreground">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Employee Deductions</h1>
        <p className="text-muted-foreground">Manage SSS, PhilHealth, Pag-ibig, and other employee deductions</p>
      </div>

      {/* Summary Metrics Chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 shadow-sm">
          <Calculator className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">Total</span>
          <span className="text-sm font-bold text-primary">Peso {grandTotal.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
          <FileText className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Records</span>
          <span className="text-sm font-bold text-foreground">{summaryMetrics.totalDeductions}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Employees</span>
          <span className="text-sm font-bold text-foreground">{summaryMetrics.totalEmployees}</span>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1 hidden md:block" />

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/10">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">SSS</span>
          <span className="text-xs font-semibold text-foreground">Peso {summaryMetrics.sssTotal.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/10">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">PhilHealth</span>
          <span className="text-xs font-semibold text-foreground">Peso {summaryMetrics.philhealthTotal.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/10">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Pag-Ibig</span>
          <span className="text-xs font-semibold text-foreground">Peso {summaryMetrics.pagibigTotal.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/10">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Other</span>
          <span className="text-xs font-semibold text-foreground">Peso {summaryMetrics.otherTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Deduction Records</h2>
          <p className="text-muted-foreground text-sm">Manage employee deductions by type</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              className="pl-9 h-10 rounded-full bg-muted/50 border-border focus-visible:ring-primary/20 w-full"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <div className="flex gap-2">
            {/* Manage Types Dialog */}
            <Dialog open={typeDialogOpen} onOpenChange={(v) => { setTypeDialogOpen(v); if (!v) setEditType(null) }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Types
                </Button>
              </DialogTrigger>
              <DialogContent className="lg:w-[40vw] w-[95vw]">
                <DialogHeader>
                  <DialogTitle>Manage Deduction Types</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <form onSubmit={handleTypeSubmit} className="space-y-3 p-3 border rounded-lg bg-muted/20">
                    <div className="grid gap-2">
                      <Label>Type Name</Label>
                      <Input name="name" defaultValue={editType?.name || ""} required placeholder="e.g. SSS Loan" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" name="is_mandatory" defaultChecked={editType?.is_mandatory} id="mandatory-check" />
                      <Label htmlFor="mandatory-check">Mandatory</Label>
                    </div>
                    <Button type="submit" size="sm" className="w-full">{editType ? "Update" : "Add Type"}</Button>
                    {editType && <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditType(null)}>Cancel Edit</Button>}
                  </form>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {deductionTypes.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/30">
                        <span className="font-medium text-sm">{t.name} {t.is_mandatory && <span className="text-[10px] bg-primary/20 text-primary px-1 rounded ml-1">M</span>}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditType(t)}><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                            if (confirm(`Delete ${t.name}?`)) {
                              if (activeOrganization === "pdn") {
                                // PDN deduction types are static defaults
                                toast.info("Cannot delete default PDN deduction types.")
                              } else {
                                await supabase.from("deduction_types").delete().eq("id", t.id)
                                fetchDeductionTypes()
                              }
                            }
                          }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Row Editor Dialog */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedEmployeeId(null) } }}>
              <DialogContent className="lg:w-[50vw] w-[90vw] max-h-[85vh] overflow-y-auto">
                {selectedEmployeeId ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Edit Deductions: {employees.find(e => e.id === selectedEmployeeId)?.full_name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault()
                      const formData = new FormData(e.target as HTMLFormElement)
                      const amounts: Record<string, number> = {}
                      const notes: Record<string, string> = {}
                      deductionTypes.forEach(dt => {
                        amounts[dt.name] = parseFloat(formData.get(`amount_${dt.name}`) as string || "0")
                        notes[dt.name] = formData.get(`notes_${dt.name}`) as string || ""
                      })
                      handleRowSubmit(selectedEmployeeId, amounts, notes)
                    }} className="space-y-4 py-4">
                      <div className="grid gap-4">
                        {deductionTypes.map(dt => {
                          const current = pivotedData.find(p => p.employee_id === selectedEmployeeId)
                          return (
                            <div key={dt.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 last:border-0 last:pb-0">
                              <div className="space-y-1.5">
                                <Label className="font-semibold text-sm">{dt.name}</Label>
                                <div className="relative">
                                  <PhilippinePeso className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                  <Input
                                    name={`amount_${dt.name}`}
                                    type="number"
                                    step="0.01"
                                    className="pl-8 h-9 text-sm"
                                    defaultValue={current?.amounts[dt.name] || 0}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs">Notes</Label>
                                <Input
                                  name={`notes_${dt.name}`}
                                  defaultValue={current?.notes[dt.name] || ""}
                                  placeholder="Notes"
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" className="flex-1 font-bold">Save Changes</Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Select Employee</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Select onValueChange={(v) => { setSelectedEmployeeId(v) }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              Add Records
            </Button>
          </div>
        </div>
      </div>

      {/* Employee Totals Summary Chips */}
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-2 items-center bg-muted/5 p-3 rounded-lg border border-border/50">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mr-2">Employee Totals</span>
          {Object.entries(totals).map(([name, total]) => (
            <div key={name} className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card shadow-sm hover:border-primary/30 transition-colors">
              <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
              <span className="text-xs font-bold text-foreground px-1.5 py-0.5 rounded-full bg-muted/30">Peso {total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Deductions Table */}
      <Card className="border border-border shadow-sm bg-card overflow-hidden">
        <CardContent className="p-0">
          {pivotedData.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">No employee data found</h3>
              <p className="text-muted-foreground mb-4">Ensure employees are registered in the system</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium text-foreground min-w-[200px]">Employee</TableHead>
                    {deductionTypes.map(dt => (
                      <TableHead key={dt.id} className="font-medium text-foreground text-right">{dt.name}</TableHead>
                    ))}
                    <TableHead className="font-medium text-foreground text-right">Total</TableHead>
                    <TableHead className="text-right font-medium text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPivotedData.map((row) => {
                    const rowTotal = Object.values(row.amounts).reduce((sum, a) => sum + a, 0)
                    return (
                      <TableRow key={row.employee_id} className="border-b border-border hover:bg-muted/30 transition group">
                        <TableCell className="font-medium text-foreground">
                          <div>
                            {row.employee_name}
                            <div className="text-[10px] text-muted-foreground">{row.employee_code}</div>
                          </div>
                        </TableCell>
                        {deductionTypes.map(dt => (
                          <TableCell key={dt.id} className="text-right">
                            {row.amounts[dt.name] > 0 ? (
                                <span className="font-medium text-foreground">Peso {row.amounts[dt.name].toLocaleString()}</span>
                            ) : (
                                <span className="text-muted-foreground/30">—</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            Peso {rowTotal.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedEmployeeId(row.employee_id)
                            setOpen(true)
                          }} className="opacity-0 group-hover:opacity-100 transition">
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {filteredData.length > pageSize && (
                <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{((currentPage - 1) * pageSize) + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, filteredData.length)}</span> of <span className="font-medium text-foreground">{filteredData.length}</span> employees
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}