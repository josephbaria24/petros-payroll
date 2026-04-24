//columns.tsx
"use client"
import { toast } from "@/lib/toast"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import React from "react"
import { Input } from "@/components/ui/input"
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
  employment_status: "Regular" | "Probationary" | "Project-based" | "Contractual" | "Inactive"
  tin: string | null
  sss: string | null
  philhealth: string | null
  pagibig: string | null
  base_salary: number
  allowance: number
  pay_type: "monthly" | "semi-monthly" | "weekly" | "daily" | "hourly"
  /** Legacy DB field; generate uses Date range vs Fixed monthly on the payroll screen. */
  monthly_salary_mode?: "prorated" | "fixed_split" | null
  shift: string | null
  hours_per_week: number | null
  leave_credits: number
  created_at: string
  attendance_log_userid?: number | null
  shift_id?: string | null
  profile_picture_url?: string | null
  working_days?: string[] | null
  daily_rate?: number | null
}

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends unknown> {
    onEdit?: (emp: Employee) => void;
    onDelete?: (id: string) => void;
    onMove?: (emp: Employee) => void;
  }
}

// Define columns for employee table
export const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: "employee_code",
    header: "ID",
    cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground group-hover:text-primary/70 transition-colors">{row.getValue("employee_code")}</span>
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
      const avatarUrl = row.original.profile_picture_url
      return (
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name || "Employee"} className="h-7 w-7 rounded-full object-cover border border-border group-hover:border-primary/30 transition-colors" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/30 transition-colors">
              {name?.charAt(0) || "E"}
            </div>
          )}
          <span className="font-medium text-foreground group-hover:text-primary transition-colors">{name}</span>
        </div>
      )
    }
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground group-hover:text-primary/80 transition-colors truncate max-w-[180px] block">
        {row.getValue("email")}
      </span>
    ),
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground group-hover:text-primary/80 transition-colors">{row.getValue("position") || "—"}</span>
    ),
  },
  {
    accessorKey: "department",
    header: ({ column }) => (
      <div className="flex items-center gap-2">
        <span>Department</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter Department</DropdownMenuLabel>
            <div className="p-2">
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ""}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => column.setFilterValue(event.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {typeof column.getFilterValue() === 'string' && column.getFilterValue() !== "" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => column.setFilterValue("")}
                  className="text-xs justify-center font-medium"
                >
                  Clear Filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    cell: ({ row }) => <span className="text-xs text-muted-foreground group-hover:text-primary/80 transition-colors font-medium">{row.getValue("department") || "—"}</span>
  },
  {
    accessorKey: "employment_status",
    header: ({ column }) => (
      <div className="flex items-center gap-2">
        <span>Status</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["Regular", "Probationary", "Contractual", "Project-based", "Inactive"].map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => column.setFilterValue(status)}
                className={cn(
                  "text-xs",
                  column.getFilterValue() === status && "bg-primary/10 font-bold text-primary"
                )}
              >
                {status}
              </DropdownMenuItem>
            ))}
            {typeof column.getFilterValue() === 'string' && column.getFilterValue() !== "" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => column.setFilterValue("")}
                  className="text-xs justify-center font-medium"
                >
                  Clear Filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    cell: ({ row }) => {
      const status = row.getValue("employment_status") as string
      const variants: Record<string, string> = {
        "Regular": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15",
        "Probationary": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15",
        "Contractual": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15",
        "Project-based": "bg-muted text-muted-foreground border-border hover:bg-muted",
        "Inactive": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/15",
      }
      return (
        <Badge variant="outline" className={cn("font-bold px-2.5 py-0.5 rounded-full text-[10px] tracking-tight", variants[status] || "bg-muted text-muted-foreground")}>
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
      return <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">₱{amount.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "allowance",
    header: "Allowance",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("allowance") || "0")
      return <div className="text-xs text-muted-foreground group-hover:text-primary/80 transition-colors">₱{amount.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "leave_credits",
    header: "Leave Credits",
    cell: ({ row }) => {
      const credits = parseFloat(row.getValue("leave_credits") || "0")
      return <div className="text-xs font-medium text-muted-foreground group-hover:text-primary/80 transition-colors">{credits.toFixed(1)} days</div>
    },
  },
  {
    accessorKey: "working_days",
    header: "Days of Work",
    cell: ({ row }) => {
      const days = row.original.working_days?.length || 0
      return (
        <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">
          <span className="text-xs font-bold text-foreground">{days}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">days</span>
        </div>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const emp = row.original
      const onEdit = table.options.meta?.onEdit
      const onDelete = table.options.meta?.onDelete
      const onMove = table.options.meta?.onMove
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <EmployeeActions emp={emp} onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
        </div>
      )
    },
  }
]

function EmployeeActions({
  emp,
  onEdit,
  onDelete,
  onMove,
}: {
  emp: Employee
  onEdit?: (emp: Employee) => void
  onDelete?: (id: string) => void
  onMove?: (emp: Employee) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [moveOpen, setMoveOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-8 w-8 p-0 hover:bg-primary/10 group-hover:text-primary" 
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
            onClick={() => setMoveOpen(true)}
          >
            Move to other Team
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            onClick={() => setOpen(true)}
          >
            Delete Employee
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={moveOpen} onOpenChange={setMoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move <span className="font-semibold text-foreground">{emp.full_name}</span> to the other team? 
              This will safely transfer their basic information and remove them from the current team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                onMove?.(emp)
                setMoveOpen(false)
              }}
            >
              Confirm Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
