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
  MessageCircleReply,
  MessageCircleReplyIcon,
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
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeOrganization } = useOrganization()
  const [role, setRole] = React.useState<string | null>(null)
  const [pendingCount, setPendingCount] = React.useState<number>(0)


  const fetchPendingRequests = async () => {
    if (activeOrganization === "palawan") {
      const stored = localStorage.getItem("palawan_requests")
      const requests = stored ? JSON.parse(stored) : []
      const pending = requests.filter((req: any) => req.status === "Pending").length
      setPendingCount(pending)
    } else {
      const { count, error } = await supabase
        .from("employee_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending")

      if (!error && count !== null) {
        setPendingCount(count)
      }
    }
  }
  React.useEffect(() => {
    fetchPendingRequests()
    const interval = setInterval(fetchPendingRequests, 60000)
    return () => clearInterval(interval)
  }, [activeOrganization])

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

  // Build nav based on role with groups and colors
  const navGroups = React.useMemo(() => {
    if (!role) return []

    const adminItems = [
      {
        label: "CORE",
        items: [
          { title: "Dashboard", url: "/dashboard", icon: Home, color: "#3b82f6" }, // Blue
          { title: "Reports", url: "/reports", icon: FileText, color: "#8b5cf6" }, // Violet
        ]
      },
      {
        label: "WORKFORCE",
        items: [
          { title: "Employees", url: "/employees", icon: Users, color: "#10b981" }, // Emerald
          { title: "Timekeeping", url: "/timekeeping", icon: Clock, color: "#f59e0b" }, // Amber
          {
            title: "Requests",
            url: "/admin-requests",
            color: "#ef4444", // Red
            icon: (
              <div className="relative">
                <MessageCircleReplyIcon className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
            )
          },
        ]
      },
      {
        label: "FINANCE",
        items: [
          { title: "Payroll", url: "/payroll", icon: Calculator, color: "#06b6d4" }, // Cyan
          { title: "Deductions", url: "/deductions", icon: Receipt, color: "#f43f5e" }, // Rose
        ]
      }
    ]

    const employeeItems = [
      {
        label: "PERSONAL",
        items: [
          { title: "My Payroll", url: "/my-payroll", icon: Calculator, color: "#06b6d4" },
          { title: "My Attendance", url: "/my-attendance", icon: Clock, color: "#f59e0b" },
          { title: "My Timesheet", url: "/timesheet", icon: Calendar, color: "#3b82f6" },
          { title: "Requests", url: "/requests", icon: MessageCircleReply, color: "#ef4444" }
        ]
      }
    ]

    const groups = role === "admin" || role === "hr" ? adminItems : role === "employee" ? employeeItems : []

    return groups.map(group => ({
      ...group,
      items: group.items.map(item => ({
        ...item,
        isActive: pathname.startsWith(item.url)
      }))
    }))
  }, [role, pathname, pendingCount])

  const navSecondary = [
    {
      title: "Help",
      url: "/help",
      icon: MessageCircleQuestion,
      isActive: pathname.startsWith("/help"),
    },
  ]

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-xl" {...props}>
      <SidebarHeader className="py-4">
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
      </SidebarHeader>

      <SidebarContent className="gap-6 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="px-2">
            <div className="px-4 mb-2">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
                {group.label}
              </span>
            </div>
            <NavMain items={group.items} />
          </div>
        ))}

        <div className="mt-auto">
          <NavSecondary items={navSecondary} />
        </div>

        {/* Logout Button */}
        <div className="px-4 pb-6 mt-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-50/10 transition-colors group"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Logout
          </Button>
        </div>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
