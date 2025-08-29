// lib/supabaseClient.ts
"use client"

import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"

export const supabase = createPagesBrowserClient()
