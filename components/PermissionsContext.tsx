"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface User {
  email: string
  role: string
}

interface PermissionsContextType {
  permissions: string[]
  permissionsLoaded: boolean
  user: User | null
  can: (perm: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  permissionsLoaded: false,
  user: null,
  can: () => true,
})

export function usePermissions() {
  return useContext(PermissionsContext)
}

interface PermissionsProviderProps {
  children: ReactNode
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function loadPermissions() {
      const supabase = createClient()

      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        setPermissions([])
        setPermissionsLoaded(true)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single()

      if (!profile) {
        setPermissions([])
        setPermissionsLoaded(true)
        return
      }

      setUser({
        email: userData.user.email || "",
        role: profile.role,
      })

      const { data: perms } = await supabase
        .from("permissions")
        .select("permission")
        .eq("role", profile.role)
        .eq("allowed", true)

      setPermissions(perms?.map(p => p.permission) ?? [])
      setPermissionsLoaded(true)
    }

    loadPermissions()
  }, [])

  // 🔥 КЛЮЧЕВОЙ helper (фикс всей проблемы)
  const can = (perm: string) => {
    // пока грузится — показываем всё (НЕ ломаем UI)
    if (!permissionsLoaded) return true

    // после загрузки — строгая проверка
    return permissions.includes(perm)
  }

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        permissionsLoaded,
        user,
        can,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}