"use client"

import { useState } from "react"
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"
import { SessionContextProvider } from "@supabase/auth-helpers-react"
import { ThemeProvider } from "@/components/theme-provider"
import { LayoutShell } from "@/components/layout-shell"
import { Toaster } from "sonner"
import { OrganizationProvider } from "@/contexts/OrganizationContext"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createPagesBrowserClient())

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <OrganizationProvider>
          <LayoutShell>{children}</LayoutShell>
          <Toaster
            position="top-center"
            toastOptions={{
              className: "custom-toast",
            }}
          />
        </OrganizationProvider>
      </ThemeProvider>
    </SessionContextProvider>
  )
}
