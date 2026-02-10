"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useUserRole } from "@/lib/useUseRole"

type Organization = "petrosphere" | "palawan"

interface OrganizationContextType {
    activeOrganization: Organization
    setActiveOrganization: (org: Organization) => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const [activeOrganization, setActiveOrganizationState] = useState<Organization>("petrosphere")
    const { role, loading } = useUserRole()

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("activeOrganization")
        if (stored === "petrosphere" || stored === "palawan") {
            setActiveOrganizationState(stored)
        }
    }, [])

    // Enforce access control
    useEffect(() => {
        if (loading) return

        // If user is basic employee (not admin) and tries to access Palawan
        if (role === 'employee' && activeOrganization === 'palawan') {
            console.log("Unauthorized access to Palawan detected, redirecting to Petrosphere")
            setActiveOrganizationState("petrosphere")
            localStorage.setItem("activeOrganization", "petrosphere")
        }
    }, [activeOrganization, role, loading])

    // Save to localStorage when changed
    const setActiveOrganization = (org: Organization) => {
        // Double check before setting
        if (role === 'employee' && org === 'palawan') {
            return // Ignore the attempt
        }

        setActiveOrganizationState(org)
        localStorage.setItem("activeOrganization", org)
    }

    return (
        <OrganizationContext.Provider value={{ activeOrganization, setActiveOrganization }}>
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
