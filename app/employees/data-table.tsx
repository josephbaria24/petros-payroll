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
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

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

  return (
    <div className="w-full space-y-4">
      {/* Integrated Toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card border-b border-border shadow-sm rounded-t-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-9 h-9 w-full bg-muted/50 border-border focus:bg-background transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          {children}
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-md">
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
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
      <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-b-lg">
        <div className="text-xs text-muted-foreground font-medium">
          Showing <span className="text-foreground">{table.getRowModel().rows.length}</span> of <span className="text-foreground">{data.length}</span> employees
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
