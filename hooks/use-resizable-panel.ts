"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface UseResizablePanelOptions {
  storageKey: string
  defaultWidth: number
  minWidth?: number
  maxWidthPct?: number // max % of viewport width
}

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth = 320,
  maxWidthPct = 50,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = Number(saved)
        if (!Number.isNaN(parsed) && parsed >= minWidth) {
          const maxPx = Math.floor(window.innerWidth * (maxWidthPct / 100))
          return Math.min(Math.max(parsed, minWidth), maxPx)
        }
      }
    } catch {
      // localStorage not available
    }
    return defaultWidth
  })

  const dragStartX = useRef<number | null>(null)
  const dragStartW = useRef<number>(defaultWidth)

  // Clamp utility
  const clamp = useCallback(
    (val: number) => {
      const maxPx = Math.floor(window.innerWidth * (maxWidthPct / 100))
      return Math.min(Math.max(val, minWidth), maxPx)
    },
    [minWidth, maxWidthPct]
  )

  // Persist to localStorage whenever width changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width))
    } catch {
      // ignore
    }
  }, [storageKey, width])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragStartX.current = e.clientX
      dragStartW.current = width
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [width]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartX.current === null) return
      // Dragging left edge: moving left = wider, moving right = narrower
      const delta = dragStartX.current - e.clientX
      setWidth(clamp(dragStartW.current + delta))
    },
    [clamp]
  )

  const onPointerUp = useCallback(() => {
    dragStartX.current = null
  }, [])

  const resetToDefault = useCallback(() => {
    setWidth(defaultWidth)
    try {
      localStorage.setItem(storageKey, String(defaultWidth))
    } catch {
      // ignore
    }
  }, [defaultWidth, storageKey])

  return {
    width,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick: resetToDefault,
    },
  }
}
