"use client"

import { useEffect, useState } from "react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { cn } from "@/lib/utils"

export function TeamTransition() {
  const { activeOrganization } = useOrganization()
  const [animatingOrg, setAnimatingOrg] = useState(activeOrganization)
  const [state, setState] = useState<"hidden" | "entering" | "visible" | "leaving">("hidden")
  const [isInitialMount, setIsInitialMount] = useState(true)

  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false)
      return
    }

    if (activeOrganization !== animatingOrg && state === "hidden") {
      setAnimatingOrg(activeOrganization)
      setState("entering")
      
      // Trigger enter animation on the next frame
      requestAnimationFrame(() => {
        // Small delay to let the DOM settle before animating to visible
        setTimeout(() => setState("visible"), 50)
      })
      
      // Hold for 1.2 seconds, then leave
      setTimeout(() => {
        setState("leaving")
        // Wait for fade-out duration (500ms) to complete before hiding fully
        setTimeout(() => {
          setState("hidden")
        }, 500)
      }, 1200)
    }
  }, [activeOrganization, isInitialMount, animatingOrg, state])

  if (state === "hidden") return null

  const isPalawan = animatingOrg === "palawan"
  const orgName = isPalawan ? "Palawan Daily News" : "Petrosphere"
  const imageSrc = isPalawan ? "/palawandailynews.png" : "/petrosphere.png"
  
  // Custom colors matching the organization themes
  const bgColor = isPalawan ? "bg-[#ea580c]" : "bg-[#00004d]"

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-500 ease-in-out",
        bgColor,
        state === "visible" ? "opacity-100 scale-100" : "opacity-0 scale-105"
      )}
    >
      <div className={cn(
        "flex flex-col items-center justify-center space-y-6 transition-all duration-700 ease-out",
        state === "visible" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      )}>
        <div className="p-6 bg-white/10 rounded-3xl backdrop-blur-md shadow-2xl flex items-center justify-center">
          <img src={imageSrc} alt={orgName} className="w-20 h-20 md:w-28 md:h-28 object-contain animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white shadow-sm">
          {orgName}
        </h1>
        <p className="text-lg md:text-xl text-white/80 font-medium">
          Loading workspace...
        </p>
      </div>
    </div>
  )
}
