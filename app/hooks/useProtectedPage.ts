"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react"

/**
 * Protects a page and optionally returns a loading state until role is verified.
 */
export function useProtectedPage(allowedRoles: string[] = []) {
  const router = useRouter()
  const session = useSession()
  const supabase = useSupabaseClient()
  const [isChecking, setIsChecking] = useState(true) // 👈 add loading state

  useEffect(() => {
    const checkAccess = async () => {
      if (!session) {
        setIsChecking(false)
        return
      }

      const userId = session.user.id

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single()

      if (error || !profile) {
        console.error("Error fetching profile:", error)
        router.push("/login")
        return
      }

      const userRole = profile.role

      if (!allowedRoles.includes(userRole)) {
        router.push("/my-payroll")
        return
      }

      setIsChecking(false)
    }

    checkAccess()
  }, [session, supabase, router, allowedRoles])

  return { isChecking }
}
