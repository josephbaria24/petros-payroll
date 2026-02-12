// components/layout-shell.tsx
"use client"

import { usePathname } from "next/navigation"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { SidebarRight } from "@/components/sidebar-right"
import { SidebarLeft } from "@/components/sidebar-left"
import { ModeToggle } from "@/components/mode-toggle"

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isAuthPage = ["/login", "/signup", "/forgot-password"].some((route) =>
    pathname.startsWith(route)
  )

  // 🔁 Choose background based on pathname
  const backgroundClass = pathname === "/my-payroll"
    ? "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50"
    : pathname === "/my-attendance"
      ? "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      : pathname === "/timesheet"
        ? "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
        : "bg-white" // fallback for other pages

  if (isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {children}
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SidebarLeft />

        <SidebarInset>
          {/* Header with SidebarTrigger and ModeToggle */}
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="h-9 w-9" />

            <div className="flex items-center gap-2">
              <ModeToggle />
            </div>
          </header>

          <div className="flex-1">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
