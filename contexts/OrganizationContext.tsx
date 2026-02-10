"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useUserRole } from "@/lib/useUseRole"
import { supabase } from "@/lib/supabaseClient"

type Organization = "petrosphere" | "palawan"

interface OrganizationContextType {
    activeOrganization: Organization
    setActiveOrganization: (org: Organization) => void
    allowedOrganizations: Organization[]
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const [activeOrganization, setActiveOrganizationState] = useState<Organization>("petrosphere")
    const [allowedOrganizations, setAllowedOrganizations] = useState<Organization[]>(["petrosphere", "palawan"])
    const { role, loading } = useUserRole()

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("activeOrganization")
        if (stored === "petrosphere" || stored === "palawan") {
            setActiveOrganizationState(stored)
        }
    }, [])

    // Enforce access control and detect allowed organizations
    useEffect(() => {
        const checkAccess = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || loading) return

            // Admins and HR see everything
            const normalizedRole = role?.toLowerCase()
            if (normalizedRole === 'admin' || normalizedRole === 'super_admin' || normalizedRole === 'hr') {
                setAllowedOrganizations(["petrosphere", "palawan"])
                return
            }

            // Check Petrosphere membership (Supabase)
            const { data: petroEmp } = await supabase
                .from("employees")
                .select("id")
                .eq("email", user.email)
                .single()

            // Check Palawan membership (LocalStorage)
            const storedPalawan = localStorage.getItem("palawan_employees")
            const palawanEmps = storedPalawan ? JSON.parse(storedPalawan) : []
            const palawanEmp = palawanEmps.find((e: any) => e.email === user.email)

            const allowed: Organization[] = []
            if (petroEmp) allowed.push("petrosphere")
            if (palawanEmp) allowed.push("palawan")

            // Fallback to petrosphere if not found in either
            if (allowed.length === 0) allowed.push("petrosphere")

            setAllowedOrganizations(allowed)

            // If current active organization is NOT allowed, switch to the first allowed one
            if (!allowed.includes(activeOrganization)) {
                const fallback = allowed[0]
                setActiveOrganizationState(fallback)
                localStorage.setItem("activeOrganization", fallback)
            }
        }

        checkAccess()
    }, [role, loading, activeOrganization])

    // Save to localStorage when changed
    const setActiveOrganization = (org: Organization) => {
        // Prevent manual switching to unauthorized organizations
        if (!allowedOrganizations.includes(org)) {
            console.warn(`Unauthorized switch attempt to ${org}`)
            return
        }

        setActiveOrganizationState(org)
        localStorage.setItem("activeOrganization", org)
    }

    return (
        <OrganizationContext.Provider value={{ activeOrganization, setActiveOrganization, allowedOrganizations }}>
            {children}
        </OrganizationContext.Provider>
    )
}

export function useOrganization() {
    const context = useContext(OrganizationContext)
    if (context === undefined) {
        throw new Error("useOrganization must be used within an OrganizationProvider")
    }
    return context
}
