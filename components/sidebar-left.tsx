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
} from "lucide-react"

import { usePathname } from "next/navigation"

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

  // Mark active item based on current pathname
  const navMain = baseData.navMain.map((item) => ({
    ...item,
    isActive: pathname.startsWith(item.url),
  }))

  const navSecondary = baseData.navSecondary.map((item) => ({
    ...item,
    isActive: pathname.startsWith(item.url),
  }))

  return (
    <Sidebar className="border-0 " {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={baseData.teams} />
        <NavMain items={navMain} />
      </SidebarHeader>
      <SidebarContent>

        
        <NavSecondary items={navSecondary} className="mt-auto" />
        
{/* Dark Mode Switch styled like a menu item */}
<div className="mt-2 px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">

  <span className="flex-1">Dark Mode</span>
  <ModeToggle />
</div>
      </SidebarContent>
      <SidebarRail />


    </Sidebar>
  )
}
