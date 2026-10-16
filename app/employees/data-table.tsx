//data-table.tsx
"use client"
import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Employee } from "./columns"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onEdit?: (row: TData) => void
  onDelete?: (id: string) => void
  onMove?: (row: TData) => void
  onRowClick?: (row: TData) => void
  initialSorting?: SortingState
  children?: React.ReactNode // For Add Employee button or other toolbar actions
}

const statusVariants: Record<string, string> = {
  Regular: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Probationary: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Contractual: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "Project-based": "bg-muted text-muted-foreground border-border",
  Inactive: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onEdit,
  onDelete,
  onMove,
  onRowClick,
  initialSorting = [],
  children,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      onEdit: onEdit as (val: any) => void,
      onDelete,
      onMove: onMove as (val: any) => void,
    },
  })

  const rows = table.getRowModel().rows

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* Integrated Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-3 bg-card border-b border-border shadow-sm rounded-t-lg">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-9 h-9 w-full bg-muted/50 border-border focus:bg-background transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {children}
        </div>
      </div>

      {/* Mobile: compact cards */}
      <div className="md:hidden space-y-2 px-1">
        {rows.length ? (
          rows.map((row) => {
            const emp = row.original as Employee
            const status = emp.employment_status || "—"
            return (
              <div
                key={row.id}
                className="rounded-lg border border-border bg-card p-3 shadow-sm active:scale-[0.99] transition-transform"
                onClick={() => {
                  if (onRowClick) onRowClick(row.original)
                  else if (onEdit) onEdit(row.original)
                }}
              >
                <div className="flex items-start gap-2.5">
                  {emp.profile_picture_url ? (
                    <img
                      src={emp.profile_picture_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground border border-border shrink-0">
                      {emp.full_name?.charAt(0) || "E"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{emp.full_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{emp.employee_code || "—"}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold px-2 py-0.5 rounded-full text-[10px] shrink-0",
                          statusVariants[status] || "bg-muted text-muted-foreground"
                        )}
                      >
                        {status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {emp.position || "—"}
                      {emp.department ? ` · ${emp.department}` : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px]">
                      <div className="flex justify-between gap-1">
                        <span className="text-muted-foreground">Base</span>
                        <span className="font-semibold tabular-nums">
                          ₱{(emp.base_salary || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-1">
                        <span className="text-muted-foreground">Allowance</span>
                        <span className="font-medium tabular-nums">
                          ₱{(emp.allowance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-1 col-span-2 truncate">
                        <span className="text-muted-foreground shrink-0">Email</span>
                        <span className="truncate text-right">{emp.email || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="flex justify-end pt-2 mt-2 border-t border-border/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.getVisibleCells()
                    .filter((c) => c.column.id === "actions")
                    .map((cell) => (
                      <div key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto border border-border rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-primary/5 hover:bg-primary/5 border-b border-border">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4 font-bold text-primary/80 uppercase tracking-wider text-[10px] border-border whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    if (onRowClick) {
                      onRowClick(row.original)
                    } else if (onEdit) {
                      onEdit(row.original)
                    }
                  }}
                  className="hover:bg-primary/5 border-b border-border last:border-0 transition-all duration-200 cursor-pointer group shadow-sm active:scale-[0.99]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 transition-colors">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-card border border-border rounded-b-lg">
        <div className="text-xs text-muted-foreground font-medium">
          Showing <span className="text-foreground">{rows.length}</span> of{" "}
          <span className="text-foreground">{data.length}</span> employees
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 px-3 border-border text-muted-foreground hover:text-foreground shadow-none disabled:opacity-30 transition-all font-semibold gap-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 px-3 border-border text-muted-foreground hover:text-foreground shadow-none disabled:opacity-30 transition-all font-semibold gap-1.5"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
