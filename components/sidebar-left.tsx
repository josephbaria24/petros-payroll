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
} from "@/components/ui/sidebar"

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
      title: "Settings",
      url: "/settings",
      icon: Settings2,
    },
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
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={baseData.teams} />
        <NavMain items={navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites favorites={baseData.favorites} />
        <NavWorkspaces workspaces={baseData.workspaces} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
