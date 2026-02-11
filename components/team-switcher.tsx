"use client"

import * as React from "react"
import { ChevronDown, Plus } from "lucide-react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useUserRole } from "@/lib/useUseRole"
import { cn } from "@/lib/utils"

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
  const { activeOrganization, setActiveOrganization, allowedOrganizations } = useOrganization()
  // const { role, loading } = useUserRole() // Removed as role-based filtering is replaced

  // Filter teams based on allowedOrganizations from context
  const filteredTeams = React.useMemo(() => {
    // if (loading) return [] // No longer needed as filtering is based on allowedOrganizations

    // For each team in the list, check if its "orgId" (derived from name) is in the allowed list
    return teams.filter(team => {
      const orgId = team.name.toLowerCase().includes("palawan") ? "palawan" : "petrosphere"
      return allowedOrganizations.includes(orgId as any)
    })
  }, [teams, allowedOrganizations]) // Removed 'loading' and 'role' from dependencies

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

    return found || filteredTeams[0] || teams[0]
  }, [activeOrganization, filteredTeams, teams])

  const handleTeamChange = (team: typeof teams[0]) => {
    // Map team name to organization ID
    const orgId = team.name.toLowerCase().includes("palawan") ? "palawan" : "petrosphere"
    setActiveOrganization(orgId as any)
  }

  // If there's only one team visible, don't show the dropdown arrow (optional, but cleaner)
  const showSwitcher = filteredTeams.length > 1

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!showSwitcher}>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-full justify-start px-3 py-6 rounded-xl transition-all duration-200 hover:bg-sidebar-accent/50 group"
            >
              <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm transition-transform group-hover:scale-105 group-hover:rotate-3">
                <activeTeam.logo className="size-6 font-bold" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight ml-3">
                <span className="truncate font-semibold text-foreground">
                  {activeTeam.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeTeam.plan}
                </span>
              </div>
              {showSwitcher && <ChevronDown className="ml-auto size-4 opacity-50 transition-transform group-data-[state=open]:rotate-180" />}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {showSwitcher && (
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
                  className={cn(
                    "gap-2 p-2",
                    activeTeam.name === team.name && "bg-muted font-medium"
                  )}
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
          )}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
