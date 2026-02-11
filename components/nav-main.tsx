import React from "react"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon | React.ReactElement
    isActive?: boolean
    color?: string
  }[]
}) {
  return (
    <SidebarMenu className="gap-1.5 px-2">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ease-in-out",
              item.isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm ring-1 ring-sidebar-border/50"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground hover:translate-x-1"
            )}
          >
            <Link href={item.url}>
              {/* Icon Container with dynamic color */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110",
                  item.isActive ? "bg-background shadow-xs" : "bg-muted/30"
                )}
                style={{ color: item.color }}
              >
                {React.isValidElement(item.icon) ? (
                  item.icon
                ) : (
                  <item.icon className="h-4.5 w-4.5" />
                )}
              </div>
              <span className="flex-1 truncate">{item.title}</span>

              {item.isActive && (
                <div className="absolute left-0 h-6 w-1 rounded-r-full bg-primary" />
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
