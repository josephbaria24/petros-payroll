"use client"

import * as React from "react"
import { ChevronDown, Plus } from "lucide-react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useUserRole } from "@/lib/useUseRole"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { activeOrganization, setActiveOrganization } = useOrganization()
  const { role, loading } = useUserRole()

  // Filter teams based on role
  const filteredTeams = React.useMemo(() => {
    if (loading) return []

    // Admins see all teams
    if (role === 'admin' || role === 'super_admin') {
      return teams
    }

    // Regular employees only see Petrosphere for now
    // TODO: In the future, check if they are specifically assigned to Palawan
    return teams.filter(team => !team.name.toLowerCase().includes("palawan"))
  }, [teams, role, loading])

  // Determine active team based on organization context
  const activeTeam = React.useMemo(() => {
    const found = filteredTeams.find(team =>
      team.name.toLowerCase().includes(activeOrganization)
    )

    // If active org is restricted (not in filtered list), fallback to first available
    if (!found && filteredTeams.length > 0) {
      // We don't auto-switch here to avoid side-effects during render, 
      // but the OrganizationContext should handle the enforcement.
      return filteredTeams[0]
    }

    return found || teams[0]
  }, [activeOrganization, filteredTeams, teams])

  const handleTeamChange = (team: typeof teams[0]) => {
    // Map team name to organization ID
    const orgId = team.name.toLowerCase().includes("palawan") ? "palawan" : "petrosphere"
    setActiveOrganization(orgId)
  }

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-fit px-1.5">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-5 items-center justify-center rounded-md">
                <activeTeam.logo className="size-3" />
              </div>
              <span className="truncate font-medium">{activeTeam.name}</span>
              <ChevronDown className="opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            {filteredTeams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => handleTeamChange(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-xs border">
                  <team.logo className="size-4 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            {/* 
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add team</div>
            </DropdownMenuItem>
            */}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
