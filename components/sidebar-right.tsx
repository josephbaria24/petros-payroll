"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { usePathname } from "next/navigation"

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

export function SidebarRight(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [holidays, setHolidays] = React.useState<any[]>([])
  const [selectedCalendars, setSelectedCalendars] = React.useState<string[]>(["Holidays"])
  const [user, setUser] = React.useState<any>(null)

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

  React.useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) {
        console.error("Failed to get user", error)
        return
      }

      const u = data.user
      setUser({
        name: u.user_metadata?.name || u.email,
        email: u.email,
        avatar: u.user_metadata?.avatar_url || "/default-avatar.png",
      })
    }

    fetchUser()
  }, [])

  // ✅ Don't render sidebar if in /employees route
  if (pathname?.startsWith("/employees")) {
    return null
  }

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l border-sidebar-border bg-sidebar/30 backdrop-blur-xl lg:flex"
      {...props}
    >
      <SidebarHeader className="h-20 border-b border-sidebar-border/50 px-6 flex justify-center">
        {user && <NavUser user={user} />}
      </SidebarHeader>

      <SidebarContent>
        <DatePicker holidays={selectedCalendars.includes("Holidays") ? holidays : []} />
        <SidebarSeparator className="mx-0" />
        <Calendars
          calendars={[
            { name: "Favorites", items: ["Holidays", "Birthdays"] },
            { name: "Other", items: ["Travel", "Reminders", "Deadlines"] },
          ]}
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
