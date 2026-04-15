//app\hooks\useProtectedPage.ts
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react"
import { getLandingPage } from "@/lib/auth-utils"

/**
 * Protects a page and optionally returns a loading state until role and permissions are verified.
 */
export function useProtectedPage(allowedRoles: string[] = [], requiredPermission?: string) {
  const router = useRouter()
  const session = useSession()
  const supabase = useSupabaseClient()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      if (!session) {
        setIsChecking(false)
        return
      }

      const userId = session.user.id

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, permissions")
        .eq("id", userId)
        .single()

      if (error || !profile) {
        console.error("Error fetching profile:", error)
        router.push("/login")
        return
      }

      const userRole = profile.role
      const userPermissions = profile.permissions || {}

      // Check role access
      if (!allowedRoles.includes(userRole)) {
        router.push("/my-payroll")
        return
      }

      // Check specific permission if required
      if (requiredPermission && !userPermissions[requiredPermission]) {
        console.warn(`User lacks required permission: ${requiredPermission}`)
        const destination = getLandingPage(userRole, userPermissions)
        router.push(destination)
        return
      }

      setIsChecking(false)
    }

    checkAccess()
  }, [session, supabase, router, allowedRoles, requiredPermission])

  return { isChecking }
}
