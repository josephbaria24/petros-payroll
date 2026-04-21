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
  Calendar,
  Droplet,
  Newspaper,
  MessageCircleReply,
  MessageCircleReplyIcon,
} from "lucide-react"

import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
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
  const { activeOrganization } = useOrganization()
  const [role, setRole] = React.useState<string | null>(null)
  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({})
  const [pendingCount, setPendingCount] = React.useState<number>(0)


  const fetchPendingRequests = async () => {
    if (activeOrganization === "pdn") {
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
          .select("role, permissions")
          .eq("id", user.id)
          .single()

        if (profile?.role) {
          setRole(profile.role)
          setPermissions(profile.permissions || {})
        }
      }
    }

    fetchRole()
  }, [])


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
      },
      {
        label: "MANAGEMENT",
        items: [
          { title: "User Manager", url: "/user-manager", icon: Settings2, color: "#64748b" }, // Slate
        ]
      }
    ]

    const employeeItems = [
      {
        label: "PERSONAL",
        items: [
          { title: "My Payroll", url: "/my-payroll", icon: Calculator, color: "#06b6d4" },
          { title: "TimeSheet", url: "/timesheet", icon: Calendar, color: "#3b82f6" },
          { title: "Requests", url: "/requests", icon: MessageCircleReply, color: "#ef4444" }
        ]
      }
    ]

    const groups = role === "admin" || role === "hr" ? adminItems : role === "employee" ? employeeItems : []

    const navItemActive = (itemUrl: string) => {
      if (itemUrl === "/") return pathname === "/"
      return pathname === itemUrl || pathname.startsWith(`${itemUrl}/`)
    }

    // Filter by permissions if HR
    if (role === "hr") {
      return groups
        .map((group) => ({
          ...group,
          items: group.items
            .filter((item) => {
              const key = item.url.replace("/", "")
              return permissions[key] === true
            })
            .map((item) => ({
              ...item,
              isActive: navItemActive(item.url),
            })),
        }))
        .filter((group) => group.items.length > 0)
    }

    return groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        isActive: navItemActive(item.url),
      })),
    }))
  }, [role, pathname, pendingCount, permissions])

  const navSecondary = []

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-xl" {...props}>
      <SidebarHeader className="py-4 ">
        <TeamSwitcher
          teams={[
            {
              name: "Petrosphere",
              logo: "/petrosphere.png",
              plan: "Payroll System",
            },
            {
              name: "Palawan Daily News",
              logo: "/palawandailynews.png",
              plan: "Payroll System",
            },
          ]}
        />
      </SidebarHeader>

      <SidebarContent className="gap-6 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="px-2">
            <div className="px-4 mb-2">
              <span className="text-[10px] font-bold tracking-widest text-sidebar-foreground/60 uppercase">
                {group.label}
              </span>
            </div>
            <NavMain items={group.items} />
          </div>
        ))}

        <div className="mt-auto px-4 pb-6">
          <div className="text-center group">
            <p className="text-[10px] font-bold tracking-widest text-sidebar-foreground/40 ">
              Developed by <span className="text-sidebar-foreground transition-colors">PetroCore</span><span className="text-red-500 transition-colors group-hover:text-red-500">X</span>
            </p>
          </div>
        </div>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
