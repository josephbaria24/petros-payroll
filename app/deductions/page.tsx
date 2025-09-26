"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Plus, DollarSign, Users, TrendingDown, Calculator, FileText, Edit, Trash2 } from "lucide-react"
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
  type: string
  amount: number
  notes?: string
}

type BulkDeductionForm = {
  employee_id: string
  sss: string
  sss_notes: string
  philhealth: string
  philhealth_notes: string
  pagibig: string
  pagibig_notes: string
  other: string
  other_notes: string
}

const deductionTypeVariants: Record<string, string> = {
  "sss": "bg-slate-900 text-white border-slate-200",
  "philhealth": "bg-white text-slate-900 border-slate-300",
  "pagibig": "bg-slate-100 text-slate-600 border-slate-200",
  "other": "bg-slate-100 text-slate-600 border-slate-200",
}

export default function DeductionsPage() {
  useProtectedPage(["admin", "hr"])
  
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [open, setOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editDeduction, setEditDeduction] = useState<Deduction | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({
    employee_id: "",
    type: "",
    amount: "",
    notes: "",
  })

  const [bulkForm, setBulkForm] = useState<BulkDeductionForm>({
    employee_id: "",
    sss: "",
    sss_notes: "",
    philhealth: "",
    philhealth_notes: "",
    pagibig: "",
    pagibig_notes: "",
    other: "",
    other_notes: "",
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
    fetchEmployees()
  }, [])

  async function fetchDeductions() {
    const { data, error } = await supabase
      .from("deductions")
      .select("id, employee_id, type, amount, notes, employees(full_name)")
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
        type: d.type,
        amount: d.amount,
        notes: d.notes,
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

  async function applyDeductionsToExistingPayroll(employeeId: string, deductionType: string, amount: number) {
    try {
      const { data: latestPayroll, error } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("employee_id", employeeId)
        .order("period_end", { ascending: false })
        .limit(1)
        .single()

      if (error || !latestPayroll) {
        console.log("No recent payroll found for employee")
        return
      }

      const columnMap: Record<string, string> = {
        sss: "sss",
        philhealth: "philhealth",
        pagibig: "pagibig",
        other: "loans"
      }

      const column = columnMap[deductionType]
      if (!column) return

      const currentDeduction = latestPayroll[column] || 0
      const newDeduction = currentDeduction + amount
      
      const basicSalary = latestPayroll.basic_salary || 0
      const overtimePay = latestPayroll.overtime_pay || 0
      const absences = latestPayroll.absences || 0
      const sss = column === 'sss' ? newDeduction : (latestPayroll.sss || 0)
      const philhealth = column === 'philhealth' ? newDeduction : (latestPayroll.philhealth || 0)
      const pagibig = column === 'pagibig' ? newDeduction : (latestPayroll.pagibig || 0)
      const loans = column === 'loans' ? newDeduction : (latestPayroll.loans || 0)
      
      const grossPay = basicSalary + overtimePay
      const totalDeductions = sss + philhealth + pagibig + loans + absences
      const netPay = grossPay - totalDeductions

      const { error: updateError } = await supabase
        .from("payroll_records")
        .update({
          [column]: newDeduction,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay
        })
        .eq("id", latestPayroll.id)

      if (updateError) {
        console.error("Error updating payroll:", updateError)
      }

    } catch (error) {
      console.error("Error applying deduction to payroll:", error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading(editDeduction ? "Updating deduction..." : "Adding deduction...")
  
    const payload = {
      employee_id: form.employee_id,
      type: form.type,
      amount: parseFloat(form.amount),
      notes: form.notes,
    }
  
    let error
    if (editDeduction) {
      const res = await supabase.from("deductions").update(payload).eq("id", editDeduction.id)
      error = res.error
    } else {
      const res = await supabase.from("deductions").insert(payload).select().single()
      error = res.error
  
      if (!error && res.data) {
        await applyDeductionsToExistingPayroll(res.data.employee_id, res.data.type, res.data.amount)
      }
    }
  
    if (error) {
      toast.error("Error saving deduction", { id: toastId })
    } else {
      toast.success("Deduction saved and applied to payroll!", { id: toastId })
      setOpen(false)
      setEditDeduction(null)
      setForm({ employee_id: "", type: "", amount: "", notes: "" })
      fetchDeductions()
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Adding bulk deductions...")

    const deductionsToInsert: Array<{
      employee_id: string
      type: string
      amount: number
      notes?: string
    }> = []

    const deductionTypes = [
      { type: 'sss', amount: bulkForm.sss, notes: bulkForm.sss_notes },
      { type: 'philhealth', amount: bulkForm.philhealth, notes: bulkForm.philhealth_notes },
      { type: 'pagibig', amount: bulkForm.pagibig, notes: bulkForm.pagibig_notes },
      { type: 'other', amount: bulkForm.other, notes: bulkForm.other_notes },
    ]

    deductionTypes.forEach(({ type, amount, notes }) => {
      if (amount && parseFloat(amount) > 0) {
        deductionsToInsert.push({
          employee_id: bulkForm.employee_id,
          type,
          amount: parseFloat(amount),
          notes: notes || undefined,
        })
      }
    })

    if (deductionsToInsert.length === 0) {
      toast.error("Please enter at least one deduction amount", { id: toastId })
      return
    }

    const { data, error } = await supabase
      .from("deductions")
      .insert(deductionsToInsert)
      .select()

    if (error) {
      toast.error("Error saving bulk deductions", { id: toastId })
      return
    }

    if (data && data.length > 0) {
      const { data: latestPayroll } = await supabase
        .from("payroll_records")
        .select("id")
        .eq("employee_id", bulkForm.employee_id)
        .order("period_end", { ascending: false })
        .limit(1)
        .single()

      if (latestPayroll) {
        const columnMap: Record<string, string> = {
          sss: "sss",
          philhealth: "philhealth",
          pagibig: "pagibig",
          other: "loans"
        }

        const updates: Record<string, number> = {}
        
        data.forEach((deduction) => {
          const column = columnMap[deduction.type]
          if (column) {
            updates[column] = deduction.amount
          }
        })

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("payroll_records")
            .update(updates)
            .eq("id", latestPayroll.id)
        }
      }
    }

    toast.success("Bulk deductions saved!", { id: toastId })
    setBulkOpen(false)
    setBulkForm({
      employee_id: "",
      sss: "",
      sss_notes: "",
      philhealth: "",
      philhealth_notes: "",
      pagibig: "",
      pagibig_notes: "",
      other: "",
      other_notes: "",
    })
    fetchDeductions()
  }

  async function handleDelete() {
    if (!deleteId) return
    const toastId = toast.loading("Deleting deduction...")
    const { error } = await supabase.from("deductions").delete().eq("id", deleteId)
    if (error) {
      toast.error("Error deleting deduction", { id: toastId })
    } else {
      toast.success("Deduction deleted!", { id: toastId })
      fetchDeductions()
    }
    setDeleteId(null)
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Employee Deductions</h1>
        <p className="text-slate-600">Manage SSS, PhilHealth, Pag-ibig, and other employee deductions</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Total Deductions</p>
              <Calculator className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">₱{grandTotal.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Total Records</p>
              <FileText className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">{summaryMetrics.totalDeductions}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Employees</p>
              <Users className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">{summaryMetrics.totalEmployees}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Average Deduction</p>
              <TrendingDown className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">₱{summaryMetrics.averageDeduction.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Deduction Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">SSS</p>
                <div className="text-lg font-bold text-slate-900">₱{summaryMetrics.sssTotal.toLocaleString()}</div>
              </div>
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">PhilHealth</p>
                <div className="text-lg font-bold text-slate-900">₱{summaryMetrics.philhealthTotal.toLocaleString()}</div>
              </div>
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Pag-ibig</p>
                <div className="text-lg font-bold text-slate-900">₱{summaryMetrics.pagibigTotal.toLocaleString()}</div>
              </div>
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Other</p>
                <div className="text-lg font-bold text-slate-900">₱{summaryMetrics.otherTotal.toLocaleString()}</div>
              </div>
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Deduction Records</h2>
          <p className="text-slate-600">View and manage employee deduction records</p>
        </div>

        <div className="flex gap-3">
          {/* Bulk Add Deductions Dialog */}
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Bulk Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-slate-900">Add Bulk Deductions</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBulkSubmit} className="space-y-6">
                {/* Employee Selection */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Employee</Label>
                  <Select
                    value={bulkForm.employee_id}
                    onValueChange={(v) => setBulkForm({ ...bulkForm, employee_id: v })}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Deduction Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SSS */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <Label className="text-base font-medium text-slate-900">SSS</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={bulkForm.sss}
                        onChange={(e) => setBulkForm({ ...bulkForm, sss: e.target.value })}
                      />
                      <Input
                        placeholder="Notes (optional)"
                        value={bulkForm.sss_notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, sss_notes: e.target.value })}
                      />
                    </CardContent>
                  </Card>

                  {/* PhilHealth */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <Label className="text-base font-medium text-slate-900">PhilHealth</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={bulkForm.philhealth}
                        onChange={(e) => setBulkForm({ ...bulkForm, philhealth: e.target.value })}
                      />
                      <Input
                        placeholder="Notes (optional)"
                        value={bulkForm.philhealth_notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, philhealth_notes: e.target.value })}
                      />
                    </CardContent>
                  </Card>

                  {/* Pag-ibig */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <Label className="text-base font-medium text-slate-900">Pag-ibig</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={bulkForm.pagibig}
                        onChange={(e) => setBulkForm({ ...bulkForm, pagibig: e.target.value })}
                      />
                      <Input
                        placeholder="Notes (optional)"
                        value={bulkForm.pagibig_notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, pagibig_notes: e.target.value })}
                      />
                    </CardContent>
                  </Card>

                  {/* Other */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <Label className="text-base font-medium text-slate-900">Other Deductions</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={bulkForm.other}
                        onChange={(e) => setBulkForm({ ...bulkForm, other: e.target.value })}
                      />
                      <Input
                        placeholder="Notes (optional)"
                        value={bulkForm.other_notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, other_notes: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                </div>

                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                  Save All Deductions
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Single Deduction Dialog */}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditDeduction(null) }}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Single Deduction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-slate-900">
                  {editDeduction ? "Edit Deduction" : "Add Single Deduction"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Employee */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Employee</Label>
                  <Select
                    value={form.employee_id}
                    onValueChange={(v) => setForm({ ...form, employee_id: v })}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Deduction Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select deduction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sss">SSS</SelectItem>
                      <SelectItem value="philhealth">PhilHealth</SelectItem>
                      <SelectItem value="pagibig">Pag-ibig</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                  {editDeduction ? "Update Deduction" : "Save Deduction"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Employee Totals Summary */}
      {Object.keys(totals).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <h3 className="text-lg font-medium text-slate-900">Employee Totals</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(totals).map(([name, total]) => (
                <div key={name} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-600">{name}</p>
                  <p className="text-lg font-bold text-slate-900">₱{total.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deductions Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {deductions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No deductions found</h3>
              <p className="text-slate-600 mb-4">Add employee deductions to get started</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="font-medium text-slate-900">Employee</TableHead>
                    <TableHead className="font-medium text-slate-900">Type</TableHead>
                    <TableHead className="font-medium text-slate-900">Amount</TableHead>
                    <TableHead className="font-medium text-slate-900">Notes</TableHead>
                    <TableHead className="text-right font-medium text-slate-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((d) => (
                    <TableRow key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <TableCell className="font-medium text-slate-900">{d.employee_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${
                          deductionTypeVariants[d.type] || "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {d.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">₱{d.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-600">{d.notes || "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Edit */}
                            <DropdownMenuItem 
                              onClick={() => {
                                setEditDeduction(d)
                                setForm({
                                  employee_id: d.employee_id,
                                  type: d.type,
                                  amount: d.amount.toString(),
                                  notes: d.notes || "",
                                })
                                setOpen(true)
                              }}
                              className="flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>

                            {/* Delete */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => { e.preventDefault(); setDeleteId(d.id) }} 
                                  className="text-slate-600 hover:text-slate-700 flex items-center gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-slate-900">Confirm Deletion</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-600">
                                    Are you sure you want to delete this deduction? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleDelete}
                                    className="bg-slate-900 hover:bg-slate-800 text-white"
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}