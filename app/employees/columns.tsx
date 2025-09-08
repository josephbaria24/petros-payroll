//columns.tsx
"use client"
import { toast } from "sonner"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

export type Employee = {
  id: string
  employee_code: string
  full_name: string
  email: string  
  position: string | null
  department: string | null
  employment_status: "Regular" | "Probationary" | "Project-based" | "Contractual"
  tin: string | null
  sss: string | null
  philhealth: string | null
  pagibig: string | null
  base_salary: number
  allowance: number // <-- NEW
  pay_type: "monthly" | "daily" | "hourly"
  shift: string | null
  hours_per_week: number | null
  leave_credits: number
  created_at: string
}


declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends unknown, TValue> {
    onEdit?: (emp: Employee) => void;
    onDelete?: (id: string) => void; 
  }
}
// Define columns for employee table
export const columns: ColumnDef<Employee>[] = [
  { accessorKey: "employee_code", header: "ID" },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name <ArrowUpDown />
      </Button>
    ),
    
  },
  {
    accessorKey: "email",                   // <-- new column
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Email <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="max-w-[220px] truncate inline-block">
        {row.getValue("email") as string}
      </span>
    ),
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => (
      <div className="max-w-[100px] truncate whitespace-nowrap overflow-hidden">
        {row.getValue("position")}
      </div>
    ),
  },
  
  { accessorKey: "department", header: "Department" },
  { accessorKey: "employment_status", header: "Status" },
  { accessorKey: "tin", header: "TIN" },
  { accessorKey: "sss", header: "SSS" },
  { accessorKey: "philhealth", header: "PhilHealth",
  cell: ({ row }) => (
    <div className="max-w-[50px] truncate whitespace-nowrap overflow-hidden">
      {row.getValue("philhealth")}
    </div>
  ),
   },
  { accessorKey: "pagibig", header: "Pag-IBIG" },
  {
    accessorKey: "base_salary",
    header: "Salary",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("base_salary"))
      return <div>₱ {amount.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "allowance",
    header: "Allowance",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("allowance"))
      return <div>₱ {amount.toLocaleString()}</div>
    },
  },
  {
    header: "Total Compensation",
    cell: ({ row }) => {
      const salary = parseFloat(row.getValue("base_salary")?.toString() || "0")

      const allowance = parseFloat(row.getValue("allowance")?.toString() || "0")

      return <div>₱ {(salary + allowance).toLocaleString()}</div>
    },
  },
  
  { accessorKey: "pay_type", header: "Pay Type" },
  { accessorKey: "shift", header: "Shift" },
  { accessorKey: "hours_per_week", header: "Hours/Week" },
  { accessorKey: "leave_credits", header: "Leave Credits" },

  {
    id: "actions",
    cell: ({ row, column }) => {
      const emp = row.original
      const onEdit = column.columnDef.meta?.onEdit
      const onDelete = column.columnDef.meta?.onDelete
  
      return <EmployeeActions emp={emp} onEdit={onEdit} onDelete={onDelete} />
    },
  }
  
  
]
function EmployeeActions({
  emp,
  onEdit,
  onDelete,
}: {
  emp: Employee
  onEdit?: (emp: Employee) => void
  onDelete?: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(emp.id)}>
            Copy ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              toast.info(`Editing ${emp.full_name}`)
              onEdit?.(emp)
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => setOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-semibold">{emp.full_name}</span>'s record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(emp.id)
                toast.success(`${emp.full_name} has been deleted`)
                setOpen(false)
              }}
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
