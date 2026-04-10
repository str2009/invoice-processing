"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  X,
  Package,
  TrendingUp,
  Warehouse,
  Weight,
  BarChart3,
  GitCompareArrows,
  History,
  GripVertical,
} from "lucide-react"
import type { InvoiceRow } from "@/lib/mock-data"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

interface PartDetailsPanelProps {
  row: InvoiceRow
  onClose: () => void
}

interface AnalogItem {
  part_brand_key: string
  brand: string
  price: number
  stock: number
}

interface HistoryItem {
  date: string
  supplier: string
  qty: number
  price: number
}

interface DetailsResponse {
  analogs: AnalogItem[]
  history: HistoryItem[]
  analytics?: Record<string, unknown>
}

type BlockId = "identity" | "pricing" | "inventory" | "physical" | "sales" | "analogs" | "history"

const STORAGE_KEY = "part-details-layout"

const DEFAULT_ORDER: BlockId[] = [
  "identity",
  "pricing",
  "inventory",
  "physical",
  "sales",
  "analogs",
  "history",
]

// Fallback data for Analogs (used when API fails or returns empty)
const FALLBACK_ANALOGS: AnalogItem[] = [
  { part_brand_key: "C112_SAKURA", brand: "SAKURA", price: 690, stock: 5 },
  { part_brand_key: "C112_MASUMA", brand: "MASUMA", price: 720, stock: 12 },
]

// Fallback data for History (used when API fails or returns empty)
const FALLBACK_HISTORY: HistoryItem[] = [
  { date: "2025-12-01", supplier: "AMX", qty: 10, price: 280 },
  { date: "2025-10-15", supplier: "BEST", qty: 5, price: 310 },
]

const API_URL = "/api/part-details"

function InfoRow({
  label,
  value,
  className = "",
}: {
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-medium ${className || "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

// Sortable block wrapper
function SortableBlock({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.15)" : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="group relative">
        {/* Drag handle */}
        <div
          {...listeners}
          className="absolute -left-1 top-0 flex h-6 w-6 cursor-grab items-center justify-center text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        {children}
      </div>
    </div>
  )
}

// Block components
function IdentityBlock({ row }: { row: InvoiceRow }) {
  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Identity
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <p className="font-mono text-sm font-semibold text-foreground">
          {row.partCode}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.manufacturer}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
          {row.partName}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {row.productGroup}
        </p>
      </div>
    </div>
  )
}

function PricingBlock({ row }: { row: InvoiceRow }) {
  const margin = row.now > 0 ? ((row.now - row.cost) / row.now) * 100 : 0

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pricing
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Purchase (Cost)" value={row.cost.toFixed(2)} />
        <div className="border-t border-border/50" />
        <InfoRow label="Current (Now)" value={row.now.toFixed(2)} />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Incoming (Ship)"
          value={row.ship > 0 ? row.ship.toFixed(2) : "---"}
          className={row.ship === 0 ? "text-muted-foreground/40" : ""}
        />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          className={
            margin > 40
              ? "text-emerald-600 dark:text-emerald-400"
              : margin <= 0
                ? "text-amber-600 dark:text-amber-400"
                : ""
          }
        />
      </div>
    </div>
  )
}

function InventoryBlock({ row }: { row: InvoiceRow }) {
  const totalValue = row.cost * row.qty

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <Warehouse className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Inventory
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Quantity (invoice)" value={row.qty} />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Stock"
          value={row.stock}
          className={row.stock === 0 ? "text-amber-600 dark:text-amber-400" : ""}
        />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Total value"
          value={totalValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        />
      </div>
    </div>
  )
}

function PhysicalBlock({ row }: { row: InvoiceRow }) {
  const totalWeight = row.weight * row.qty

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <Weight className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Physical
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Weight" value={`${row.weight.toFixed(1)} kg`} />
        <div className="border-t border-border/50" />
        <InfoRow label="Total weight" value={`${totalWeight.toFixed(1)} kg`} />
      </div>
    </div>
  )
}

function SalesBlock({ row }: { row: InvoiceRow }) {
  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sales
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="12-month sales" value={row.sales12m} />
        <div className="border-t border-border/50" />
        <InfoRow label="Monthly avg" value={Math.round(row.sales12m / 12)} />
      </div>
    </div>
  )
}

function AnalogsBlock({
  analogs,
  isLoading,
}: {
  analogs: AnalogItem[]
  isLoading: boolean
}) {
  const bestPrice = analogs.length > 0 ? Math.min(...analogs.map((a) => a.price)) : 0

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Analogs
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30">
        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : analogs.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground/60">No analogs</p>
        ) : (
          <div className="max-h-32 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">Code</th>
                  <th className="px-2 py-1.5 text-left font-medium">Brand</th>
                  <th className="px-2 py-1.5 text-right font-medium">Price</th>
                  <th className="px-2 py-1.5 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {analogs.map((analog, idx) => (
                  <tr
                    key={analog.part_brand_key}
                    className={idx < analogs.length - 1 ? "border-b border-border/30" : ""}
                  >
                    <td className="px-2 py-1.5 font-mono text-foreground/80">
                      {analog.part_brand_key}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {analog.brand}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-mono ${
                        analog.price === bestPrice
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground/80"
                      }`}
                    >
                      {analog.price}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-foreground/80">
                      {analog.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryBlock({
  history,
  isLoading,
}: {
  history: HistoryItem[]
  isLoading: boolean
}) {
  // Sort by date descending
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          History
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30">
        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : sortedHistory.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground/60">No history</p>
        ) : (
          <div className="max-h-32 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium">Supplier</th>
                  <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                  <th className="px-2 py-1.5 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((item, idx) => (
                  <tr
                    key={`${item.date}-${item.supplier}-${idx}`}
                    className={idx < sortedHistory.length - 1 ? "border-b border-border/30" : ""}
                  >
                    <td className="px-2 py-1.5 font-mono text-foreground/80">
                      {item.date}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {item.supplier}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-foreground/80">
                      {item.qty}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-foreground/80">
                      {item.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function PartDetailsPanel({ row, onClose }: PartDetailsPanelProps) {
  const [blocksOrder, setBlocksOrder] = useState<BlockId[]>(DEFAULT_ORDER)
  const [detailsData, setDetailsData] = useState<DetailsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch part details from webhook
  useEffect(() => {
    const fetchDetails = async () => {
      const partBrandKey = row.part_brand_key
      if (!partBrandKey) {
        console.log("[v0] REQUEST PART: (no part_brand_key)")
        return
      }

      console.log("[v0] REQUEST PART:", partBrandKey)
      setIsLoading(true)

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ part_brand_key: partBrandKey }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        console.log("[v0] DETAILS RESPONSE:", data)
        setDetailsData(data)
      } catch (error) {
        console.error("[v0] FETCH ERROR:", error)
        setDetailsData(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetails()
  }, [row.part_brand_key])

  // Load order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) {
          setBlocksOrder(parsed as BlockId[])
        }
      }
    } catch {
      // Ignore errors
    }
  }, [])

  // Save order to localStorage
  const saveOrder = useCallback((order: BlockId[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    } catch {
      // Ignore errors
    }
  }, [])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = blocksOrder.indexOf(active.id as BlockId)
        const newIndex = blocksOrder.indexOf(over.id as BlockId)
        const newOrder = arrayMove(blocksOrder, oldIndex, newIndex)
        setBlocksOrder(newOrder)
        saveOrder(newOrder)
      }
    },
    [blocksOrder, saveOrder]
  )

  // Get analogs data with fallback
  const analogsData = useMemo(() => {
    if (detailsData?.analogs && detailsData.analogs.length > 0) {
      return detailsData.analogs
    }
    // Use fallback if no data or empty
    return FALLBACK_ANALOGS
  }, [detailsData])

  // Get history data with fallback
  const historyData = useMemo(() => {
    if (detailsData?.history && detailsData.history.length > 0) {
      return detailsData.history
    }
    // Use fallback if no data or empty
    return FALLBACK_HISTORY
  }, [detailsData])

  // Render a block by ID
  const renderBlock = useCallback(
    (blockId: BlockId) => {
      switch (blockId) {
        case "identity":
          return <IdentityBlock row={row} />
        case "pricing":
          return <PricingBlock row={row} />
        case "inventory":
          return <InventoryBlock row={row} />
        case "physical":
          return <PhysicalBlock row={row} />
        case "sales":
          return <SalesBlock row={row} />
        case "analogs":
          return <AnalogsBlock analogs={analogsData} isLoading={isLoading} />
        case "history":
          return <HistoryBlock history={historyData} isLoading={isLoading} />
        default:
          return null
      }
    },
    [row, analogsData, historyData, isLoading]
  )

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Part details"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Part Details</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close panel</span>
        </Button>
      </div>

      {/* Scrollable content with draggable blocks */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={blocksOrder}
              strategy={verticalListSortingStrategy}
            >
              {blocksOrder.map((blockId) => (
                <SortableBlock key={blockId} id={blockId}>
                  {renderBlock(blockId)}
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>
    </aside>
  )
}
