"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { usePermissions } from "@/components/PermissionsContext"
import { useUISettings } from "@/components/UISettingsContext"
import { createClient } from "@/lib/supabase/client"

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
  Maximize2,
  Minimize2,
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

// =======================
// PERMISSIONS
// =======================
const permissionToNavLink: Record<string, string> = {
  view_dashboard: "/",
  view_invoice: "/invoice",
  view_vin: "/vin",
  view_tasks: "/tasks",
  view_analytics: "/analytics",
  view_chat: "/chat",
}

const navLinks = [
  { href: "/", label: "Dashboard", icon: FileText },
  { href: "/invoice", label: "Invoice", icon: FileText },
  { href: "/vin", label: "VIN", icon: Car },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/chat", label: "Chat", icon: MessageSquare },
]

// =======================
// WAREHOUSE
// =======================
const warehouses = [
  { id: "salut", name: "Салют" },
  { id: "koms18", name: "Комс 18" },
  { id: "talnah", name: "Талнах" },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { permissions, permissionsLoaded, user } = usePermissions()
  const { theme, setTheme, density, setDensity, uiScale, setUIScale, textIntensity, setTextIntensity } = useUISettings()
  const supabase = createClient()

  const [mounted, setMounted] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0])

  useEffect(() => {
    setMounted(true)
  }, [])

  // =======================
  // LOGOUT
  // =======================
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // =======================
  // HELPERS
  // =======================
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  const can = (perm: string) => {
    if (!permissionsLoaded) return true
    return permissions.includes(perm)
  }

  // =======================
  // RENDER
  // =======================
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">

      {/* LEFT */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 flex items-center justify-center rounded bg-primary text-white">
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
          const permissionKey = Object.entries(permissionToNavLink)
            .find(([, href]) => href === link.href)?.[0]

          if (permissionKey && !can(permissionKey)) return null

          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 text-xs rounded ${
                isActive(link.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="inline h-3.5 w-3.5 mr-1" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* RIGHT */}
      <div className="flex items-center gap-2">

        {/* SETTINGS */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Sun className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[240px] p-2">

  {/* THEME */}
  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground px-2">
    Theme
  </DropdownMenuLabel>

  {[
    ["light", "Light", Sun],
    ["soft", "Soft", Sun],
    ["mellow", "Mellow", Sun],
    ["dark", "Dark", Moon],
    ["warm-dark", "Warm Dark", Moon],
    ["graphite", "Graphite", Monitor],
  ].map(([key, label, Icon]: any) => (
    <DropdownMenuItem
      key={key}
      onClick={() => setTheme(key)}
      className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
        theme === key ? "bg-accent text-foreground" : ""
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </DropdownMenuItem>
  ))}

  <DropdownMenuSeparator />

  {/* DENSITY */}
  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground px-2">
    Density
  </DropdownMenuLabel>

  <DropdownMenuItem
    onClick={() => setDensity("comfortable")}
    className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
      density === "comfortable" ? "bg-accent text-foreground" : ""
    }`}
  >
    <Maximize2 className="h-3.5 w-3.5" />
    Comfortable
  </DropdownMenuItem>
  <DropdownMenuItem
    onClick={() => setDensity("compact")}
    className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
      density === "compact" ? "bg-accent text-foreground" : ""
    }`}
  >
    <Minimize2 className="h-3.5 w-3.5" />
    Compact
  </DropdownMenuItem>

  <DropdownMenuSeparator />

  {/* SCALE */}
  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground px-2">
    UI Scale
  </DropdownMenuLabel>

  {["90", "100", "110", "120", "130"].map((s) => (
    <DropdownMenuItem
      key={s}
      onClick={() => setUIScale(s as "90" | "100" | "110" | "120" | "130")}
      className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
        uiScale === s ? "bg-accent text-foreground" : ""
      }`}
    >
      <span className="w-6 font-mono text-[10px]">{s}</span>
      {s}%
    </DropdownMenuItem>
  ))}

  <DropdownMenuSeparator />

  {/* TEXT */}
  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground px-2">
    Text Intensity
  </DropdownMenuLabel>

  <DropdownMenuItem
    onClick={() => setTextIntensity("normal")}
    className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
      textIntensity === "normal" ? "bg-accent text-foreground" : ""
    }`}
  >
    <span className="w-4 font-medium text-[10px]">N</span>
    Normal
  </DropdownMenuItem>
  <DropdownMenuItem
    onClick={() => setTextIntensity("medium")}
    className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
      textIntensity === "medium" ? "bg-accent text-foreground" : ""
    }`}
  >
    <span className="w-4 font-medium text-[10px]">M</span>
    Medium
  </DropdownMenuItem>
  <DropdownMenuItem
    onClick={() => setTextIntensity("high")}
    className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
      textIntensity === "high" ? "bg-accent text-foreground" : ""
    }`}
  >
    <span className="w-4 font-medium text-[10px]">H</span>
    High
  </DropdownMenuItem>

</DropdownMenuContent>
        </DropdownMenu>

        {/* USER */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {user.email}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Role: {user.role}
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleLogout}>
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
