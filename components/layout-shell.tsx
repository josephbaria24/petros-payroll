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
        
        {/* ✅ Apply dynamic background class */}
          <SidebarTrigger className="sticky top-0 flex h-14 shrink-0 items-center gap-2" />

        <SidebarInset>
          {children}
        </SidebarInset>

        <SidebarRight />
      </div>
    </SidebarProvider>
  )
}
