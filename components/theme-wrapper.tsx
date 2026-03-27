"use client"

import { useOrganization } from "@/contexts/OrganizationContext"
import { ReactNode, useEffect } from "react"

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { activeOrganization } = useOrganization()

  useEffect(() => {
    // Remove existing themes
    document.body.classList.remove("theme-petrosphere", "theme-pdn")
    
    // Apply current theme
    if (activeOrganization) {
      document.body.classList.add(`theme-${activeOrganization}`)
    }
  }, [activeOrganization])

  return <>{children}</>
}
