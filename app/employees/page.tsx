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
    if (error) {
      console.error("Error fetching employees:", error)
    } else {
      setData(data as Employee[])
    }
    setLoading(false)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Employee Management</h1>
      {loading ? <p>Loading...</p> : <DataTable columns={columns} data={data} />}
    </div>
  )
}
