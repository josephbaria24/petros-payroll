import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import "./globals.css"
import { ClientLayout } from "@/components/client-layout" // 👈 New wrapper component


const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: "Petrosphere Payroll System",
  description: "Payroll management using Next.js + Supabase",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans`}
        style={{
          fontFamily: `var(--font-geist-sans),var(--font-inter),  system-ui, sans-serif`,
        }}
      >
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}



// import type { Metadata } from "next";
// import { Geist, Geist_Mono, Inter } from "next/font/google";
// import "./globals.css";
// import { ThemeProvider } from "@/components/theme-provider";
// import { ClientLayoutWrapper } from "@/components/client-layout-wrapper";

// const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });
// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// export const metadata: Metadata = {
//   title: "petrosphere-crm",
//   description: "petrosphere-crm",
// };

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en" suppressHydrationWarning>
      // <body
      //   className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans`}
      //   style={{
      //     fontFamily: `var(--font-geist-sans),var(--font-inter),  system-ui, sans-serif`,
      //   }}
      // >
//         <ThemeProvider
//           attribute="class"
//           defaultTheme="system"
//           enableSystem
//           disableTransitionOnChange
//         >
//           <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
//         </ThemeProvider>
//       </body>
//     </html>
//   );
// }
