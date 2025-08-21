// app/layout.tsx

import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import {

  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar"
import { SidebarRight } from "@/components/sidebar-right"
import { SidebarLeft } from "@/components/sidebar-left"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Petrosphere Payroll System",
  description: "Payroll management using Next.js + Supabase",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SidebarProvider>
            <SidebarLeft />
            <SidebarInset>
              {children}
            </SidebarInset>
            <SidebarRight />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
