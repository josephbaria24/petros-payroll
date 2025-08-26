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
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ModeToggle } from "./mode-toggle"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"

const baseData = {
  teams: [
    {
      name: "Petrosphere",
      logo: Home,
      plan: "Payroll System",
    },
  ],
  navMain: [
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
  ],
  navSecondary: [
    {
      title: "Help",
      url: "/help",
      icon: MessageCircleQuestion,
    },
  ],
  favorites: [],
  workspaces: [],
}

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const navMain = baseData.navMain.map((item) => ({
    ...item,
    isActive: pathname.startsWith(item.url),
  }))

  const navSecondary = baseData.navSecondary.map((item) => ({
    ...item,
    isActive: pathname.startsWith(item.url),
  }))

  return (
    <Sidebar className="border-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={baseData.teams} />
        <NavMain items={navMain} />
      </SidebarHeader>

      <SidebarContent>
        <NavSecondary items={navSecondary} className="mt-auto" />

        {/* Dark Mode Toggle */}
        <div className="mt-2 px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex-1">Dark Mode</span>
          <ModeToggle />
        </div>

        {/* Logout Button */}
        <div className="px-1 pb-6 ">
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
