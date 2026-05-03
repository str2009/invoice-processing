"use client"

import { usePathname } from "next/navigation"
import { Header } from "@/components/Header"

interface LayoutWrapperProps {
  children: React.ReactNode
}

// Pages that should not have the global header
const noHeaderPages = ["/login"]

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  
  const showHeader = !noHeaderPages.includes(pathname)

  if (!showHeader) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
