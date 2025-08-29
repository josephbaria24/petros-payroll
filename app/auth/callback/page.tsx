// app/auth/callback/page.tsx
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
      } else {
        router.push("/dashboard")
      }
    }

    getSession()
  }, [router])

  return <p>Loading...</p>
}
