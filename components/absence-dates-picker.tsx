"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd")
}

function parseDateKeys(keys: string[]): Date[] {
  return keys
    .filter(Boolean)
    .map((k) => {
      try {
        return parseISO(k)
      } catch {
        return null
      }
    })
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
}

type AbsenceDatesPickerProps = {
  dates: string[]
  onChange: (dates: string[]) => void
  disabled?: boolean
  className?: string
  /** Compact trigger for dense generate UI */
  compact?: boolean
}

export function AbsenceDatesPicker({
  dates,
  onChange,
  disabled,
  className,
  compact,
}: AbsenceDatesPickerProps) {
  const selected = useMemo(() => parseDateKeys(dates), [dates])

  const removeDate = (key: string) => {
    onChange(dates.filter((d) => d !== key).sort())
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              compact ? "h-8 lg:h-9 text-xs px-2" : "h-10",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            <CalendarIcon className={cn("shrink-0 opacity-70", compact ? "mr-1.5 h-3 w-3" : "mr-2 h-4 w-4")} />
            {selected.length === 0
              ? "Select absence date(s)"
              : `${selected.length} date${selected.length === 1 ? "" : "s"} selected`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="multiple"
            selected={selected}
            onSelect={(days) => {
              const next = (days || []).map(toDateKey).sort()
              onChange(next)
            }}
            initialFocus
          />
          {selected.length > 0 && (
            <div className="border-t border-border px-3 py-2 flex justify-between items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">
                Click dates to toggle
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((d) => {
            const key = toDateKey(d)
            return (
              <Badge
                key={key}
                variant="secondary"
                className="gap-1 pr-1 font-medium text-[10px] sm:text-xs"
              >
                {format(d, "MMM d, yyyy")}
                {!disabled && (
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    onClick={() => removeDate(key)}
                    aria-label={`Remove ${key}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
