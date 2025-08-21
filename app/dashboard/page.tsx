// app/dashboard/page.tsx

import {
  SidebarTrigger,

} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

export default function DashboardPage() {
  return (
    <>
      <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 px-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1">
                Project Management & Task Tracking
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex-1 flex flex-col gap-4 p-4">
        <div className="bg-muted/50 mx-auto h-24 w-full max-w-3xl rounded-xl" />
        <div className="bg-muted/50 mx-auto h-[100vh] w-full max-w-3xl rounded-xl" />
      </div>
    </>
  )
}
