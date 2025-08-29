"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react"

export function useProtectedPage(allowedRoles: string[] = []) {
  const router = useRouter()
  const session = useSession()
  const supabase = useSupabaseClient()

  useEffect(() => {
    const checkAccess = async () => {
      // 🚫 No session yet (still loading or user not signed in)
      if (!session) return

      const userId = session.user.id

      // ✅ Check the profile from Supabase
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single()

      if (error || !profile) {
        console.error("Error fetching profile:", error)
        router.push("/unauthorized")
        return
      }

      const userRole = profile.role

      if (!allowedRoles.includes(userRole)) {
        router.push("/unauthorized")
      }
    }

    checkAccess()
  }, [session, supabase, router, allowedRoles])
}
