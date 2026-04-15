//app\auth\callback\page.tsx

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getLandingPage } from "@/lib/auth-utils"

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
        .select("role, avatar_url, permissions")
        .eq("id", session.user.id)
        .single()

      if (profileError || !profile) {
        router.push("/login?error=role")
        return
      }

      // Sync Azure SSO Avatar if available
      const ssoAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
      if (ssoAvatar && profile.avatar_url !== ssoAvatar) {
        await supabase
          .from("profiles")
          .update({ avatar_url: ssoAvatar })
          .eq("id", session.user.id)
      }

      // Refresh the router to update middleware session
      router.refresh()

      const destination = getLandingPage(profile.role, profile.permissions)
      router.push(destination)
    }

    getSession()
  }, [router])

  return <p>Loading...</p>
}
