// lib/useUserRole.ts
import { useEffect, useState } from "react"
import { supabase } from "./supabaseClient"

export function useUserRole() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        setRole(profile?.role ?? null)
      }

      setLoading(false)
    }

    fetch()
  }, [])

  return { role, loading }
}
