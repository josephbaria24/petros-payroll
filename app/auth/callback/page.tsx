"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error || !session) {
        router.push("/login?error=oauth")
        return
      }

      // 👇 Check user role before redirect
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()

      if (profileError || !profile) {
        router.push("/login?error=role")
        return
      }
      if (profile.role === "employee") {
        router.push("/my-payroll")
      }
      if (profile.role === "admin" || profile.role === "hr") {
        router.push("/dashboard")
      } 
    }

    getSession()
  }, [router])

  return <p>Loading...</p>
}
