import * as React from "react"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"


import { Calendars } from "@/components/calendars"
import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

// Initialize Supabase client

// Sample user and calendar structure
const data = {
  user: {
    name: "payroll",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  calendars: [
    {
      name: "Favorites",
      items: ["Holidays", "Birthdays"],
    },
    {
      name: "Other",
      items: ["Travel", "Reminders", "Deadlines"],
    },
  ],
}

export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const [holidays, setHolidays] = React.useState<any[]>([])
  const [selectedCalendars, setSelectedCalendars] = React.useState<string[]>(["Holidays"])

  // Fetch holidays when "Holidays" is selected
  React.useEffect(() => {
    if (selectedCalendars.includes("Holidays")) {
      supabase
        .from("philippine_holidays")
        .select("*")
        .then(({ data, error }) => {
          if (error) console.error("Failed to fetch holidays", error)
          else setHolidays(data || [])
        })
    }
  }, [selectedCalendars])

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarHeader className="border-sidebar-border h-16 border-b">
        <NavUser user={data.user} />
      </SidebarHeader>

      <SidebarContent>
        <DatePicker holidays={selectedCalendars.includes("Holidays") ? holidays : []} />
        <SidebarSeparator className="mx-0" />
        <Calendars
          calendars={data.calendars}
          selected={selectedCalendars}
          onChange={setSelectedCalendars}
        />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Plus />
              <span>New Calendar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
