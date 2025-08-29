"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function MyPayrollPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const supabase = createPagesBrowserClient()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()

      if (sessionError || !user) {
        router.push("/login")
        return
      }

      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .single()

      if (!employee) {
        setError("No employee record found.")
        setLoading(false)
        return
      }

      const { data, error: payrollError } = await supabase
        .from("payroll_records")
        .select("period_end, net_pay, status, period_start")
        .eq("employee_id", employee.id)
        .order("period_end", { ascending: false })

      if (payrollError) {
        setError("Error fetching payroll records.")
        setLoading(false)
        return
      }

      setRecords(data || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const statusBadge = (status: string) => {
    switch (status) {
      case "Payment Success":
        return <Badge className="bg-blue-100 text-blue-600">● {status}</Badge>
      case "Pending Payment":
        return <Badge className="bg-orange-100 text-orange-600">● {status}</Badge>
      case "On Hold Payment":
        return <Badge className="bg-gray-100 text-gray-600">● {status}</Badge>
      default:
        return <Badge className="bg-muted text-muted-foreground">● Unknown</Badge>
    }
  }

  return (
    <div className="space-y-6 pr-4">
      <h2 className="text-xl font-bold">My Payroll</h2>

      {loading ? (
        <p>Loading payroll records...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : records.length === 0 ? (
        <p>No payroll records found.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {rec.period_start} – {rec.period_end}
                    </TableCell>
                    <TableCell>₱ {rec.net_pay.toLocaleString()}</TableCell>
                    <TableCell>{statusBadge(rec.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
