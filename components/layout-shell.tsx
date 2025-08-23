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
        <div className=" top-3 z-50">
  <SidebarTrigger className=" sticky top-0 flex h-14 shrink-0 items-center gap-2" />
</div>

        <SidebarInset>
          {children}
        </SidebarInset>
        <SidebarRight />
      </div>
    </SidebarProvider>
  )
}
