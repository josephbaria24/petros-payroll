//columns.tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Employee = {
  id: string
  employee_code: string
  full_name: string
  position: string | null
  department: string | null
  employment_status: "Regular" | "Probationary" | "Project-based" | "Contractual"
  tin: string | null
  sss: string | null
  philhealth: string | null
  pagibig: string | null
  base_salary: number
  pay_type: "monthly" | "daily" | "hourly"
  shift: string | null
  hours_per_week: number | null
  leave_credits: number
  created_at: string
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
  { accessorKey: "pay_type", header: "Pay Type" },
  { accessorKey: "shift", header: "Shift" },
  { accessorKey: "hours_per_week", header: "Hours/Week" },
  { accessorKey: "leave_credits", header: "Leave Credits" },
  {
    id: "actions",
    cell: ({ row }) => {
      const emp = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(emp.id)}
            >
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
