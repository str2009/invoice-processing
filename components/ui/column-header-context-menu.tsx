"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { EyeOff, RotateCcw, Columns3, RefreshCw } from "lucide-react"

interface ContextMenuPosition {
  x: number
  y: number
}

interface ColumnHeaderContextMenuProps {
  position: ContextMenuPosition | null
  columnId: string | null
  onClose: () => void
  onHideColumn: (columnId: string) => void
  onResetOrder: () => void
  onResetWidth: () => void
  onResetAll: () => void
  onHideOthers?: (columnId: string) => void
  onShowAll?: () => void
}

export function ColumnHeaderContextMenu({
  position,
  columnId,
  onClose,
  onHideColumn,
  onResetOrder,
  onResetWidth,
  onResetAll,
  onHideOthers,
  onShowAll,
}: ColumnHeaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or escape
  useEffect(() => {
    if (!position) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [position, onClose])

  if (!position || !columnId) return null

  const menuItems = [
    {
      icon: EyeOff,
      label: "Hide column",
      onClick: () => {
        onHideColumn(columnId)
        onClose()
      },
    },
    ...(onHideOthers
      ? [
          {
            icon: EyeOff,
            label: "Hide other columns",
            onClick: () => {
              onHideOthers(columnId)
              onClose()
            },
          },
        ]
      : []),
    ...(onShowAll
      ? [
          {
            icon: Columns3,
            label: "Show all columns",
            onClick: () => {
              onShowAll()
              onClose()
            },
          },
        ]
      : []),
    { type: "separator" as const },
    {
      icon: RotateCcw,
      label: "Reset order",
      onClick: () => {
        onResetOrder()
        onClose()
      },
    },
    {
      icon: RotateCcw,
      label: "Reset width",
      onClick: () => {
        onResetWidth()
        onClose()
      },
    },
    {
      icon: RefreshCw,
      label: "Reset all",
      onClick: () => {
        onResetAll()
        onClose()
      },
    },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {menuItems.map((item, index) => {
        if ("type" in item && item.type === "separator") {
          return <div key={index} className="my-1 h-px bg-border" />
        }
        const Icon = item.icon
        return (
          <button
            key={index}
            onClick={item.onClick}
            className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// Hook to manage context menu state
export function useColumnContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition | null
    columnId: string | null
  }>({
    position: null,
    columnId: null,
  })

  const handleContextMenu = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      columnId,
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ position: null, columnId: null })
  }, [])

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
  }
}
