"use client"

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ShoppingCart } from "lucide-react"
import { useCart, type CartItem } from "./cart-context"

// Row data type for context menu
interface RowData {
  id: string
  part_code?: string
  brand?: string
  part_name?: string
  name?: string
  price?: number
  sell_price?: number
  qty?: number
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  rowData: RowData | null
  source: "analytics" | "invoice"
}

interface RowContextMenuContextType {
  openMenu: (e: React.MouseEvent, rowData: RowData, source: "analytics" | "invoice") => void
  closeMenu: () => void
}

const RowContextMenuContext = createContext<RowContextMenuContextType | null>(null)

export function useRowContextMenu() {
  const context = useContext(RowContextMenuContext)
  if (!context) {
    throw new Error("useRowContextMenu must be used within a RowContextMenuProvider")
  }
  return context
}

export function RowContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    rowData: null,
    source: "analytics",
  })
  const { addToCart, isInCart } = useCart()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const openMenu = useCallback((e: React.MouseEvent, rowData: RowData, source: "analytics" | "invoice") => {
    e.preventDefault()
    e.stopPropagation()

    // Position menu, ensuring it stays within viewport
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 100)

    setMenu({ visible: true, x, y, rowData, source })
  }, [])

  const closeMenu = useCallback(() => {
    setMenu(prev => ({ ...prev, visible: false, rowData: null }))
  }, [])

  const handleAddToCart = useCallback(() => {
    if (!menu.rowData) return

    const item: Omit<CartItem, "qty"> = {
      id: menu.rowData.id,
      part_code: menu.rowData.part_code || "",
      brand: menu.rowData.brand || "",
      part_name: menu.rowData.part_name || menu.rowData.name || "",
      price: menu.rowData.sell_price || menu.rowData.price || 0,
      source: menu.source,
    }
    addToCart(item)
    closeMenu()
  }, [menu.rowData, menu.source, addToCart, closeMenu])

  // Close menu on click outside or escape
  useEffect(() => {
    if (!menu.visible) return

    const handleClickOutside = () => closeMenu()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu()
    }

    // Small delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [menu.visible, closeMenu])

  const inCart = menu.rowData ? isInCart(menu.rowData.id) : false

  return (
    <RowContextMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}

      {mounted && menu.visible && createPortal(
        <div
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleAddToCart}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{inCart ? "Добавить ещё" : "Добавить в корзину"}</span>
          </button>
        </div>,
        document.body
      )}
    </RowContextMenuContext.Provider>
  )
}

// Legacy wrapper for backwards compatibility (not recommended for tables)
interface RowContextMenuProps {
  children: ReactNode
  rowData: RowData
  source: "analytics" | "invoice"
}

export function RowContextMenu({ children, rowData, source }: RowContextMenuProps) {
  const { openMenu } = useRowContextMenu()

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    openMenu(e, rowData, source)
  }, [openMenu, rowData, source])

  return (
    <div onContextMenu={handleContextMenu} style={{ display: "contents" }}>
      {children}
    </div>
  )
}
