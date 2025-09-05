import { Calendar } from "@/components/ui/calendar"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

interface Holiday {
  id: string
  date: string // ISO format
  name: string
}

interface DatePickerProps {
  holidays?: Holiday[]
}

export function DatePicker({ holidays = [] }: DatePickerProps) {
  const today = new Date()

  // Convert holiday dates to Date objects
  const holidayDates = holidays.map((h) => new Date(h.date))

  // Filter holidays that are in the future (>= today)
  const upcomingHolidays = holidays
    .map((h) => ({ ...h, dateObj: new Date(h.date) }))
    .filter((h) => h.dateObj >= today)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()) // Sort ascending

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        <Calendar
          className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px]"
          modifiers={{
            holiday: holidayDates,
          }}
          modifiersClassNames={{
            holiday: "bg-red-200 text-red-900 font-bold rounded-md",
          }}
          
        />
{upcomingHolidays.length > 0 && (
  <div className="mt-2 px-4 pb-4 text-xs ">
    <div className="font-semibold mb-1">Upcoming Holidays:</div>
    <ul className="list-disc list-inside rounded-2xl bg-muted p-3 space-y-2">
      {upcomingHolidays.slice(0, 5).map((h) => (
        <li key={h.id} className="text-xs">
          <span className="font-semibold">
            {h.dateObj.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <div className="ml-4 text-muted-foreground">{h.name}</div>
        </li>
      ))}
    </ul>
  </div>
)}


      </SidebarGroupContent>
    </SidebarGroup>
  )
}
