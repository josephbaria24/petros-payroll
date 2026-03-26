"use client"

import { SessionContextProvider } from "@supabase/auth-helpers-react"
import { ThemeProvider } from "@/components/theme-provider"
import { LayoutShell } from "@/components/layout-shell"
import { ThemeWrapper } from "@/components/theme-wrapper"
import { TeamTransition } from "@/components/team-transition"
import { Toaster } from "sonner"
import { OrganizationProvider } from "@/contexts/OrganizationContext"
import { supabase } from "@/lib/supabaseClient"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
        <OrganizationProvider>
          <ThemeWrapper>
            <TeamTransition />
            <LayoutShell>{children}</LayoutShell>
            <Toaster
              position="top-center"
              toastOptions={{
                className: "custom-toast",
              }}
            />
          </ThemeWrapper>
        </OrganizationProvider>
      </ThemeProvider>
    </SessionContextProvider>
  )
}
