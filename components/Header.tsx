"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { usePermissions } from "@/components/PermissionsContext"
import {
  FileText,
  BarChart3,
  MessageSquare,
  Car,
  Sun,
  Moon,
  Monitor,
  User,
  LogOut,
  ChevronDown,
  Warehouse,
  CheckSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// Permission to nav link mapping
const permissionToNavLink: Record<string, string> = {
  view_dashboard: "/",
  view_invoice: "/invoice",
  view_vin: "/vin",
  view_tasks: "/tasks",
  view_analytics: "/analytics",
  view_chat: "/chat",
}

// Navigation links
const navLinks = [
  { href: "/", label: "Dashboard", icon: FileText },
  { href: "/invoice", label: "Invoice", icon: FileText },
  { href: "/vin", label: "VIN", icon: Car },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/chat", label: "Chat", icon: MessageSquare },
]

const warehouses = [
  { id: "salut", name: "Салют" },
  { id: "koms18", name: "Комс 18" },
  { id: "talnah", name: "Талнах" },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { permissions, permissionsLoaded, user } = usePermissions()

  const [mounted, setMounted] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0])

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  // ✅ КЛЮЧЕВОЙ ФИКС
  const can = (perm: string) => {
    if (!permissionsLoaded) return true
    return permissions.includes(perm)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      
      {/* LEFT */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold hidden sm:inline">
            Max24 (в процессе разработки)
          </span>
        </Link>
      </div>

      {/* CENTER NAV */}
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => {
          const permissionKey = Object.entries(permissionToNavLink).find(
            ([, href]) => href === link.href
          )?.[0]

          if (permissionKey && !can(permissionKey)) return null

          const Icon = link.icon
          const active = isActive(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center h-8 gap-1.5 px-3 text-xs rounded-md transition-colors ${
                active
                  ? "text-foreground font-medium bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* RIGHT */}
      <div className="flex items-center gap-2">

        {/* Theme */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {mounted && (
                theme === "light" ? <Sun className="h-4 w-4" /> :
                theme === "graphite" ? <Monitor className="h-4 w-4" /> :
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("graphite")}>Graphite</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-5 w-px bg-border" />

        {/* Warehouse */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <Warehouse className="h-3.5 w-3.5" />
              {selectedWarehouse.name}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {warehouses.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => setSelectedWarehouse(w)}>
                {w.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-5 w-px bg-border" />

        {/* USER */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <User className="h-3.5 w-3.5" />
                {user.email}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Role: {user.role}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/login")}>
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}