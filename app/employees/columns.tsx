//columns.tsx
"use client"
import { toast } from "sonner"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
  allowance: number
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
  {
    accessorKey: "employee_code",
    header: "ID",
    cell: ({ row }) => <span className="text-xs font-mono text-slate-500">{row.getValue("employee_code")}</span>
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent text-slate-900 font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.getValue("full_name") as string
      return (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
            {name?.charAt(0) || "E"}
          </div>
          <span className="font-medium text-slate-900">{name}</span>
        </div>
      )
    }
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-xs text-slate-600 truncate max-w-[180px] block">
        {row.getValue("email")}
      </span>
    ),
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => (
      <span className="text-xs text-slate-600">{row.getValue("position") || "—"}</span>
    ),
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => <span className="text-xs text-slate-600">{row.getValue("department") || "—"}</span>
  },
  {
    accessorKey: "employment_status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("employment_status") as string
      const variants: Record<string, string> = {
        "Regular": "bg-emerald-50 text-emerald-700 border-emerald-100/50 hover:bg-emerald-50",
        "Probationary": "bg-blue-50 text-blue-700 border-blue-100/50 hover:bg-blue-50",
        "Contractual": "bg-amber-50 text-amber-700 border-amber-100/50 hover:bg-amber-50",
        "Project-based": "bg-slate-50 text-slate-700 border-slate-100/50 hover:bg-slate-50",
      }
      return (
        <Badge variant="outline" className={cn("font-medium px-2 py-0.5 rounded-full text-[10px]", variants[status] || "bg-slate-50 text-slate-600")}>
          {status}
        </Badge>
      )
    }
  },
  {
    accessorKey: "base_salary",
    header: "Base Salary",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("base_salary") || "0")
      return <div className="text-xs font-semibold text-slate-900">₱{amount.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "allowance",
    header: "Allowance",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("allowance") || "0")
      return <div className="text-xs text-slate-600">₱{amount.toLocaleString()}</div>
    },
  },
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
            <MoreHorizontal className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
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
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
            onClick={() => setOpen(true)}
          >
            Delete Employee
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-semibold text-slate-900">{emp.full_name}</span>'s record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                onDelete?.(emp.id)
                toast.success(`${emp.full_name} has been deleted`)
                setOpen(false)
              }}
            >
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
