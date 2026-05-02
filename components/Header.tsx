"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Mock user data
const user = {
  email: "suzo@list.ru",
  role: "admin",
}

// Warehouse options
const warehouses = [
  { id: "salut", name: "Салют" },
  { id: "koms18", name: "Комс 18" },
  { id: "talnah", name: "Талнах" },
]

// Navigation links
const navLinks = [
  { href: "/", label: "Dashboard", icon: FileText },
  { href: "/invoice", label: "Invoice", icon: FileText },
  { href: "/vin", label: "VIN", icon: Car },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/chat", label: "Chat", icon: MessageSquare },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if current path matches or starts with the link href
  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      {/* Left - App title */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-foreground hidden sm:inline">
            Max24 (в процессе разработки)
          </span>
        </Link>
      </div>

      {/* Center - Navigation */}
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => {
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

      {/* Right - Theme, Warehouse, User */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              aria-label="Change theme"
            >
              {mounted && (
                theme === "light" ? (
                  <Sun className="h-4 w-4" />
                ) : theme === "soft" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : theme === "mellow" ? (
                  <Sun className="h-4 w-4 text-stone-500" />
                ) : theme === "graphite" ? (
                  <Monitor className="h-4 w-4" />
                ) : theme === "warm-dark" ? (
                  <Moon className="h-4 w-4 text-amber-500" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className={`gap-2 text-xs ${theme === "light" ? "bg-accent" : ""}`}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("soft")}
              className={`gap-2 text-xs ${theme === "soft" ? "bg-accent" : ""}`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              Soft
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("mellow")}
              className={`gap-2 text-xs ${theme === "mellow" ? "bg-accent" : ""}`}
            >
              <Sun className="h-3.5 w-3.5 text-stone-500" />
              Mellow
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className={`gap-2 text-xs ${theme === "dark" ? "bg-accent" : ""}`}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("warm-dark")}
              className={`gap-2 text-xs ${theme === "warm-dark" ? "bg-accent" : ""}`}
            >
              <Moon className="h-3.5 w-3.5 text-amber-500" />
              Warm Dark
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("graphite")}
              className={`gap-2 text-xs ${theme === "graphite" ? "bg-accent" : ""}`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Graphite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-5 w-px bg-border" aria-hidden="true" />

        {/* Warehouse selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Warehouse className="h-3.5 w-3.5" />
              <span className="hidden sm:inline max-w-[80px] truncate">
                {selectedWarehouse.name}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              Warehouse
            </DropdownMenuLabel>
            {warehouses.map((warehouse) => (
              <DropdownMenuItem
                key={warehouse.id}
                onClick={() => setSelectedWarehouse(warehouse)}
                className={`gap-2 text-xs ${
                  selectedWarehouse.id === warehouse.id ? "bg-accent" : ""
                }`}
              >
                <Warehouse className="h-3.5 w-3.5" />
                {warehouse.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-5 w-px bg-border" aria-hidden="true" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden lg:inline max-w-[120px] truncate">
                {user.email}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuLabel className="font-medium">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground -mt-1">
              Role: {user.role}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/")}
              className="gap-2 text-xs text-destructive focus:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
