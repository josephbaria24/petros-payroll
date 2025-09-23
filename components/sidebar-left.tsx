"use client"

import * as React from "react"
import {
  Home,
  Users,
  Clock,
  Receipt,
  FileText,
  Settings2,
  Calculator,
  MessageCircleQuestion,
  Moon,
  LogOut,
  Calendar,
  Droplet,
  Newspaper,
} from "lucide-react"

import { usePathname, useRouter } from "next/navigation"

import { NavFavorites } from "@/components/nav-favorites"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavWorkspaces } from "@/components/nav-workspaces"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = React.useState<string | null>(null)

  const supabase = createPagesBrowserClient()

  // Fetch user role on mount
  React.useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (profile?.role) {
          setRole(profile.role)
        }
      }
    }

    fetchRole()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Build nav based on role
  const navMain = [
    ...(role === "admin" || role === "hr"
      ? [
          {
            title: "Dashboard",
            url: "/dashboard",
            icon: Home,
          },
          {
            title: "Employees",
            url: "/employees",
            icon: Users,
          },
          {
            title: "Timekeeping",
            url: "/timekeeping",
            icon: Clock,
          },
          {
            title: "Payroll",
            url: "/payroll",
            icon: Calculator,
          },
          {
            title: "Deductions",
            url: "/deductions",
            icon: Receipt,
          },
          {
            title: "Reports",
            url: "/reports",
            icon: FileText,
          },
        ]
      : role === "employee"
      ? [
          {
            title: "My Payroll",
            url: "/my-payroll",
            icon: Calculator,
          },
          {
            title: "My Attendance",
            url: "/my-attendance",
            icon: Clock, // already imported in your sidebar
          },
          {
            title: "My Timesheet",
            url: "/timesheet",
            icon: Calendar, // already imported in your sidebar
          }
        ]
      : [])
  ].map((item) => ({
    ...item,
    isActive: pathname.startsWith(item.url),
  }))

  const navSecondary = [
    {
      title: "Help",
      url: "/help",
      icon: MessageCircleQuestion,
      isActive: pathname.startsWith("/help"),
    },
  ]

  return (
    <Sidebar className="border-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              name: "Petrosphere",
              logo: Droplet,
              plan: "Payroll System",
            },
            {
              name: "Palawan Daily News",
              logo: Newspaper,
              plan: "Payroll System",
            },
          ]}
        />
        <NavMain items={navMain} />
      </SidebarHeader>

      <SidebarContent>
        <NavSecondary items={navSecondary} className="mt-auto" />

        {/* Dark Mode Toggle */}
        {/* <div className="mt-2 px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex-1">Dark Mode</span>
          <ModeToggle />
        </div> */}

        {/* Logout Button */}
        <div className="px-1 pb-6">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 cursor-pointer" />
            Logout
          </Button>
        </div>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
