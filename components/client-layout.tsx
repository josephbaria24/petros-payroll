"use client"

import { SessionContextProvider } from "@supabase/auth-helpers-react"
import { ThemeProvider } from "@/components/theme-provider"
import { LayoutShell } from "@/components/layout-shell"
import { ThemeWrapper } from "@/components/theme-wrapper"
import { TeamTransition } from "@/components/team-transition"
import { OrganizationProvider } from "@/contexts/OrganizationContext"
import { HolidayProvider } from "@/contexts/HolidayContext"
import { supabase } from "@/lib/supabaseClient"
import { Toaster as SileoToaster } from "sileo"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
        <OrganizationProvider>
          <HolidayProvider>
            <ThemeWrapper>
              <TeamTransition />
              <LayoutShell>{children}</LayoutShell>
              <SileoToaster position="top-center" theme="dark" />
            </ThemeWrapper>
          </HolidayProvider>
        </OrganizationProvider>
      </ThemeProvider>
    </SessionContextProvider>
  )
}
