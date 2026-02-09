"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type Organization = "petrosphere" | "palawan"

interface OrganizationContextType {
    activeOrganization: Organization
    setActiveOrganization: (org: Organization) => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const [activeOrganization, setActiveOrganizationState] = useState<Organization>("petrosphere")

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("activeOrganization")
        if (stored === "petrosphere" || stored === "palawan") {
            setActiveOrganizationState(stored)
        }
    }, [])

    // Save to localStorage when changed
    const setActiveOrganization = (org: Organization) => {
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
