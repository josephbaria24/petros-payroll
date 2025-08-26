
Here’s a short PAYROLL_CHEATSHEET.md — minimal but enough to restore context quickly.

📝 Payroll System – Quick Cheat Sheet
🔹 Supabase Schema
create table employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text,
  department text,
  employment_status text check (employment_status in ('Regular','Probationary','Contractual','Project-based')),
  tin text,
  sss text,
  philhealth text,
  pagibig text,
  base_salary numeric not null,
  pay_type text check (pay_type in ('monthly','daily','hourly')) default 'monthly',
  created_at timestamp default now()
);

🔹 Sidebar (with active route)
import { usePathname } from "next/navigation"
import { Home, Users, Clock, Calculator, Receipt, FileText, Settings2, MessageCircleQuestion } from "lucide-react"
import { Sidebar, SidebarHeader, SidebarContent, SidebarRail } from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { TeamSwitcher } from "@/components/team-switcher"

const baseData = {
  teams: [{ name: "Petrosphere", logo: Home, plan: "Payroll System" }],
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Employees", url: "/employees", icon: Users },
    { title: "Timekeeping", url: "/timekeeping", icon: Clock },
    { title: "Payroll", url: "/payroll", icon: Calculator },
    { title: "Deductions", url: "/deductions", icon: Receipt },
    { title: "Reports", url: "/reports", icon: FileText },
  ],
  navSecondary: [
    { title: "Settings", url: "/settings", icon: Settings2 },
    { title: "Help", url: "/help", icon: MessageCircleQuestion },
  ],
}

export function SidebarLeft(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const navMain = baseData.navMain.map((i) => ({ ...i, isActive: pathname.startsWith(i.url) }))
  const navSecondary = baseData.navSecondary.map((i) => ({ ...i, isActive: pathname.startsWith(i.url) }))

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={baseData.teams} />
        <NavMain items={navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

🔹 Employee Table Page
app/employees/page.tsx
"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { DataTable } from "./data-table"
import { columns, Employee } from "./columns"

export default function EmployeesPage() {
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEmployees()
  }, [])

  async function fetchEmployees() {
    setLoading(true)
    const { data, error } = await supabase.from("employees").select("*")
    if (error) console.error(error)
    else setData(data as Employee[])
    setLoading(false)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Employee Management</h1>
      {loading ? <p>Loading...</p> : <DataTable columns={columns} data={data} />}
    </div>
  )
}

app/employees/columns.tsx (simplified)
import { ColumnDef } from "@tanstack/react-table"
import { Employee } from "./page"

export const columns: ColumnDef<Employee>[] = [
  { accessorKey: "full_name", header: "Name" },
  { accessorKey: "position", header: "Position" },
  { accessorKey: "department", header: "Department" },
  { accessorKey: "employment_status", header: "Status" },
  { accessorKey: "base_salary", header: "Salary" },
  { accessorKey: "pay_type", header: "Pay Type" },
]

🔹 Dashboard as Landing Page

Redirect / → /dashboard:

// app/page.tsx
import { redirect } from "next/navigation"
export default function Home() {
  redirect("/dashboard")
}


✅ That’s the cheat sheet version.
It’s short, but with just this, I’ll know you’re working on:

Next.js + ShadCN

Supabase employees table

Sidebar with payroll menus

Dashboard landing