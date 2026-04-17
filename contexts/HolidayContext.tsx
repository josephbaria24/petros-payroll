"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"

interface Holiday {
  date: string
  name: string
  isOfficial: boolean
}

interface HolidayContextType {
  holidayDates: Date[]
  holidayMap: Record<string, string>
  loading: boolean
  refreshHolidays: () => Promise<void>
}

const HolidayContext = createContext<HolidayContextType | undefined>(undefined)

export function HolidayProvider({ children }: { children: React.ReactNode }) {
  const [holidayDates, setHolidayDates] = useState<Date[]>([])
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const fetchHolidays = useCallback(async () => {
    try {
      const [{ data: official }, { data: timeLogs }, { data: pdnLogs }] = await Promise.all([
        supabase.from("philippine_holidays").select("date, name"),
        supabase.from("time_logs").select("date").eq("status", "Holiday"),
        supabase.from("pdn_attendance_logs").select("work_date").eq("status", "Holiday")
      ])

      const map: Record<string, string> = {}
      const datesSet = new Set<string>()

      // Official Holidays
      official?.forEach(h => {
        datesSet.add(h.date)
        map[h.date] = h.name
      })

      // Manual Holidays from time_logs
      timeLogs?.forEach(l => {
        datesSet.add(l.date)
        if (!map[l.date]) map[l.date] = "Holiday"
      })

      // Manual Holidays from pdn_attendance_logs
      pdnLogs?.forEach(l => {
        datesSet.add(l.work_date)
        if (!map[l.work_date]) map[l.work_date] = "Holiday"
      })

      const finalDates = Array.from(datesSet).map(d => new Date(d + "T00:00:00"))
      setHolidayDates(finalDates)
      setHolidayMap(map)
    } catch (error) {
      console.error("Failed to fetch holidays:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  return (
    <HolidayContext.Provider value={{ holidayDates, holidayMap, loading, refreshHolidays: fetchHolidays }}>
      {children}
    </HolidayContext.Provider>
  )
}

export function useHoliday() {
  const context = useContext(HolidayContext)
  if (context === undefined) {
    throw new Error("useHoliday must be used within a HolidayProvider")
  }
  return context
}
