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
  interface TableMeta<TData extends unknown> {
    onEdit?: (emp: Employee) => void;
    onDelete?: (id: string) => void;
  }
}

// Define columns for employee table
export const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: "employee_code",
    header: "ID",
    cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.getValue("employee_code")}</span>
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent text-foreground font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.getValue("full_name") as string
      return (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border">
            {name?.charAt(0) || "E"}
          </div>
          <span className="font-medium text-foreground">{name}</span>
        </div>
      )
    }
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground truncate max-w-[180px] block">
        {row.getValue("email")}
      </span>
    ),
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.getValue("position") || "—"}</span>
    ),
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("department") || "—"}</span>
  },
  {
    accessorKey: "employment_status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("employment_status") as string
      const variants: Record<string, string> = {
        "Regular": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15",
        "Probationary": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15",
        "Contractual": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15",
        "Project-based": "bg-muted text-muted-foreground border-border hover:bg-muted",
      }
      return (
        <Badge variant="outline" className={cn("font-medium px-2 py-0.5 rounded-full text-[10px]", variants[status] || "bg-muted text-muted-foreground")}>
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
      return <div className="text-xs font-semibold text-foreground">₱{amount.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "allowance",
    header: "Allowance",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("allowance") || "0")
      return <div className="text-xs text-muted-foreground">₱{amount.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "leave_credits",
    header: "Leave Credits",
    cell: ({ row }) => {
      const credits = parseFloat(row.getValue("leave_credits") || "0")
      return <div className="text-xs font-medium text-muted-foreground">{credits.toFixed(1)} days</div>
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const emp = row.original
      const onEdit = table.options.meta?.onEdit
      const onDelete = table.options.meta?.onDelete
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
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
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
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
              <span className="font-semibold text-foreground">{emp.full_name}</span>'s record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
