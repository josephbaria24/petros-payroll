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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
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
// 3. Function to apply new deductions to existing payroll
async function applyDeductionsToExistingPayroll(employeeId: string, deductionType: string, amount: number) {
  try {
    // Get the most recent payroll record for this employee
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

    // Map deduction types to payroll columns
    const columnMap: Record<string, string> = {
      sss: "sss",
      philhealth: "philhealth",
      pagibig: "pagibig",
      other: "loans"
    }

    const column = columnMap[deductionType]
    if (!column) return

    // Update the specific deduction column and recalculate totals
    const currentDeduction = latestPayroll[column] || 0
    const newDeduction = currentDeduction + amount
    
    // Recalculate totals
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

    // Update the payroll record
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
  
      // Apply the new deduction to existing payroll
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

  // async function handleSubmit(e: React.FormEvent) {
  //   e.preventDefault()
  //   const toastId = toast.loading(editDeduction ? "Updating deduction..." : "Adding deduction...")
  
  //   const payload = {
  //     employee_id: form.employee_id,
  //     type: form.type,
  //     amount: parseFloat(form.amount),
  //     notes: form.notes,
  //   }
  
  //   let error
  //   if (editDeduction) {
  //     const res = await supabase.from("deductions").update(payload).eq("id", editDeduction.id)
  //     error = res.error
  //   } else {
  //     const res = await supabase.from("deductions").insert(payload).select().single()
  //     error = res.error
  
  //     if (!error && res.data) {
  //       // Update payroll_records with this deduction
  //       const { employee_id, type, amount } = res.data
  
  //       // Find latest payroll record for this employee
  //       const { data: latestPayroll } = await supabase
  //         .from("payroll_records")
  //         .select("id")
  //         .eq("employee_id", employee_id)
  //         .order("period_end", { ascending: false })
  //         .limit(1)
  //         .single()
  
  //       if (latestPayroll) {
  //         const columnMap: Record<string, string> = {
  //           sss: "sss",
  //           philhealth: "philhealth",
  //           pagibig: "pagibig",
  //           other: "loans"
  //         }
  
  //         const column = columnMap[type]
  
  //         if (column) {
  //           await supabase
  //             .from("payroll_records")
  //             .update({ [column]: amount })
  //             .eq("id", latestPayroll.id)
  //         }
  //       }
  //     }
  //   }
  
  //   if (error) {
  //     toast.error("Error saving deduction", { id: toastId })
  //   } else {
  //     toast.success("Deduction saved!", { id: toastId })
  //     setOpen(false)
  //     setEditDeduction(null)
  //     setForm({ employee_id: "", type: "", amount: "", notes: "" })
  //     fetchDeductions()
  //   }
  // }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading("Adding bulk deductions...")

    const deductionsToInsert: Array<{
      employee_id: string
      type: string
      amount: number
      notes?: string
    }> = []

    // Build array of deductions to insert (only non-empty amounts)
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

    // Insert all deductions
    const { data, error } = await supabase
      .from("deductions")
      .insert(deductionsToInsert)
      .select()

    if (error) {
      toast.error("Error saving bulk deductions", { id: toastId })
      return
    }

    // Update payroll_records with these deductions
    if (data && data.length > 0) {
      // Find latest payroll record for this employee
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Deductions</h1>
        <div className="flex gap-2">
          {/* Bulk Add Deductions Dialog */}
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">+ Bulk Add Deductions</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Bulk Deductions</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                {/* Employee Selection */}
                <div>
                  <Label>Employee</Label>
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
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">SSS</Label>
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
                  </div>

                  {/* PhilHealth */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">PhilHealth</Label>
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
                  </div>

                  {/* Pag-ibig */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Pag-ibig</Label>
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
                  </div>

                  {/* Other */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Other</Label>
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
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Save All Deductions
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Single Deduction Dialog */}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditDeduction(null) }}>
            <DialogTrigger asChild>
              <Button>+ Add Single Deduction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editDeduction ? "Edit Deduction" : "Add Single Deduction"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Employee */}
                <div>
                  <Label>Employee</Label>
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
                  <Label>Deduction Type</Label>
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
                  <Label>Amount</Label>
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
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Grand Total Deductions</p>
            <h2 className="text-xl font-bold">₱ {grandTotal.toLocaleString()}</h2>
          </CardContent>
        </Card>
        {Object.entries(totals).map(([name, total]) => (
          <Card key={name}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{name}</p>
              <h2 className="text-lg font-semibold">₱ {total.toLocaleString()}</h2>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deductions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.employee_name}</TableCell>
                  <TableCell className="capitalize">{d.type}</TableCell>
                  <TableCell>₱ {d.amount.toLocaleString()}</TableCell>
                  <TableCell>{d.notes || "-"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Edit */}
                        <DropdownMenuItem onClick={() => {
                          setEditDeduction(d)
                          setForm({
                            employee_id: d.employee_id,
                            type: d.type,
                            amount: d.amount.toString(),
                            notes: d.notes || "",
                          })
                          setOpen(true)
                        }}>
                          Edit
                        </DropdownMenuItem>

                        {/* Delete */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeleteId(d.id) }} className="text-red-600">
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this deduction? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
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
        </CardContent>
      </Card>
    </div>
  )
}