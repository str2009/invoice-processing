"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  X,
  Package,
  TrendingUp,
  Warehouse as WarehouseIcon,
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
  panelEnabled?: boolean
}

interface PurchaseHistoryItem {
  price: number
  date: string
}

interface SalesMonthlyDataPoint {
  month: string // "YYYY-MM"
  qty: number
}

interface SalesMonthlyWarehouse {
  warehouse: string
  data: SalesMonthlyDataPoint[]
}

interface AnalogItem {
  part_brand_key: string
  code?: string
  brand: string
  sold_12m?: number
  sales_monthly?: SalesMonthlyWarehouse[]
  price: number
  purchase_price?: number
  stock: number
  purchase_history?: PurchaseHistoryItem[]
  last_sale_price?: number
  last_sale_date?: string
  last_stock_zero_date?: string
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

type BlockId = "pricing" | "inventory" | "physical" | "sales" | "analogs" | "analogDetails" | "history"

const STORAGE_KEY = "part-details-layout"

const DEFAULT_ORDER: BlockId[] = [
  "analogs",
  "analogDetails",
  "pricing",
  "inventory",
  "physical",
  "sales",
  "history",
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

// Product Header (sticky, non-draggable)
function ProductHeader({ row }: { row: InvoiceRow }) {
  return (
    <div className="sticky top-0 z-10 bg-card px-4 py-3 border-b border-border/50 shadow-sm">
      <h3 
        className="text-xl font-semibold leading-tight text-foreground line-clamp-2"
        title={row.partName}
      >
        {row.partName}
      </h3>
    </div>
  )
}

// Block components

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
        <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
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

function SalesBlock({ selectedAnalog }: { selectedAnalog: AnalogItem | null }) {
  // Generate last 12 months dynamically (from -11 months to current)
  const months = useMemo(() => {
    const result: { key: string; label: string }[] = []
    const now = new Date()
    const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: monthNames[d.getMonth()],
      })
    }
    return result
  }, [])

  const salesData = selectedAnalog?.sales_monthly ?? []

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sales
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border/50">
              {months.map((m) => (
                <th
                  key={m.key}
                  className="px-1 py-1 text-center font-normal text-muted-foreground"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salesData.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-2 py-2 text-center text-muted-foreground">
                  No data
                </td>
              </tr>
            ) : (
              salesData.map((row) => {
                // Convert row.data array to map for O(1) lookup
                const dataMap = Object.fromEntries(
                  row.data.map((x) => [x.month, x.qty])
                )
                
                return (
                  <tr 
                    key={row.warehouse} 
                    className="hover:bg-muted/50 transition-colors"
                    title={row.warehouse}
                  >
                    {months.map((m) => {
                      const value = dataMap[m.key] ?? 0
                      return (
                        <td
                          key={m.key}
                          className={`px-1 py-1.5 text-center font-mono tabular-nums ${
                            value > 0 ? "text-foreground" : "text-muted-foreground/50"
                          }`}
                        >
                          {value > 0 ? value : "–"}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// AnalogsBlock component
function AnalogsBlock({
  analogs,
  isLoading,
  includeZeroStock,
  onToggleZeroStock,
  currentPartKey,
  selectedAnalog,
  onSelectAnalog,
}: {
  analogs: AnalogItem[]
  isLoading: boolean
  includeZeroStock: boolean
  onToggleZeroStock: () => void
  currentPartKey: string
  selectedAnalog: AnalogItem | null
  onSelectAnalog: (analog: AnalogItem) => void
}) {
  const bestPrice = analogs.length > 0 ? Math.min(...analogs.map((a) => a.price)) : 0

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Analogs
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Include zero stock</span>
          <button
            type="button"
            role="switch"
            aria-checked={includeZeroStock}
            onClick={onToggleZeroStock}
            className={`relative h-4 w-7 rounded-full transition-colors ${
              includeZeroStock ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                includeZeroStock ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
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
          <div className="max-h-48 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
<th className="px-2 py-1.5 text-left font-medium">Code</th>
                      <th className="px-2 py-1.5 text-right font-medium">Sold 12m</th>
                      <th className="px-2 py-1.5 text-right font-medium">Now</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                  <th className="px-2 py-1.5 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {analogs.map((analog, idx) => {
                  const isCurrentPart = analog.part_brand_key === currentPartKey
                  const isSelected = selectedAnalog?.part_brand_key === analog.part_brand_key
                  return (
                    <tr
                      key={analog.part_brand_key}
                      onClick={() => onSelectAnalog(analog)}
                      className={`cursor-pointer transition-colors ${idx < analogs.length - 1 ? "border-b border-border/30" : ""} ${
                        isSelected ? "bg-muted" : isCurrentPart ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                      }`}
                    >
                      <td className={`px-2 py-1.5 font-mono ${isCurrentPart ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                        {analog.part_brand_key}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                        analog.sold_12m === undefined 
                          ? "text-muted-foreground" 
                          : analog.sold_12m === 0 
                            ? "text-muted-foreground/60" 
                            : analog.sold_12m >= 10 
                              ? "text-emerald-600 dark:text-emerald-400" 
                              : "text-foreground/80"
                      }`}>
                        {analog.sold_12m === undefined ? "—" : analog.sold_12m}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono ${
                          analog.price === bestPrice
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isCurrentPart ? "text-foreground" : "text-foreground/80"
                        }`}
                      >
                        {analog.price}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${isCurrentPart ? "text-foreground" : "text-foreground/80"}`}>
                        {analog.purchase_price}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${isCurrentPart ? "text-foreground" : "text-foreground/80"}`}>
                        {analog.stock}
                      </td>
                    </tr>
                  )
                })}
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

// Format date to DD.MM.YY
function formatDateShort(dateString: string): string {
  const d = new Date(dateString)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}.${month}.${year}`
}

function AnalogDetailsBlock({
  selectedAnalog,
}: {
  selectedAnalog: AnalogItem | null
}) {
  if (!selectedAnalog) {
    return (
      <div className="pl-6">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground/60">Select an analog to view details</p>
        </div>
      </div>
    )
  }

  // Sort purchase history by date descending, limit to 10 rows
  const sortedHistory = [...(selectedAnalog.purchase_history || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 10)

  // Check if date is older than 90 days
  const isOlderThan90Days = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays > 90
  }

  const lastSaleIsOld = selectedAnalog.last_sale_date 
    ? isOlderThan90Days(selectedAnalog.last_sale_date) 
    : false

  return (
    <div className="pl-6">
      <div 
        className="rounded-lg border border-border bg-muted/30 grid"
        style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
      >
        {/* Purchase History (Left) */}
        <div className="flex flex-col px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Purchase
          </span>
          <div className="mt-2 space-y-1 flex-1">
            {sortedHistory.length > 0 ? (
              sortedHistory.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono tabular-nums">
                    {item.price.toLocaleString("ru-RU")}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {formatDateShort(item.date)}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No history</span>
            )}
          </div>
        </div>

        {/* Last Sale (Center) */}
        <div className="flex flex-col px-4 py-3 border-l border-border">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Last Sale
          </span>
          <div className="mt-2 flex-1">
            {selectedAnalog.last_sale_date ? (
              <div className={`flex flex-col ${lastSaleIsOld ? "text-muted-foreground" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-base tabular-nums">
                    {selectedAnalog.last_sale_price 
                      ? selectedAnalog.last_sale_price.toLocaleString("ru-RU") 
                      : "—"}
                  </span>
                  {lastSaleIsOld && (
                    <span className="text-amber-500 text-xs" title="Sale older than 90 days">!</span>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {formatDateShort(selectedAnalog.last_sale_date)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Stock Status (Right) */}
        <div className="flex flex-col px-4 py-3 border-l border-border">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Stock
          </span>
          <div className="mt-2 flex-1">
            {selectedAnalog.stock > 0 ? (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-green-500">
                  IN STOCK
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  qty: {selectedAnalog.stock}
                </span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-destructive">
                  OUT OF STOCK
                </span>
                {selectedAnalog.last_stock_zero_date && (
                  <span className="text-xs text-muted-foreground mt-0.5">
                    since {formatDateShort(selectedAnalog.last_stock_zero_date)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PartDetailsPanel({ row, onClose, panelEnabled = true }: PartDetailsPanelProps) {
  const [blocksOrder, setBlocksOrder] = useState<BlockId[]>(DEFAULT_ORDER)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [analogsRaw, setAnalogsRaw] = useState<AnalogItem[]>([])
  const [historyRaw, setHistoryRaw] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [includeZeroStock, setIncludeZeroStock] = useState(false)
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null)

  // Get part_brand_key from row, or construct from partCode_manufacturer
  const partBrandKey = row?.part_brand_key || 
    (row?.partCode && row?.manufacturer ? `${row.partCode}_${row.manufacturer}` : null)

  // Fetch part details - depends ONLY on partBrandKey
  useEffect(() => {
    if (!partBrandKey) return

    const fetchPartDetails = async () => {
      setIsLoading(true)

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ part_brand_key: partBrandKey }),
        })

        const data = await res.json()

        setAnalogsRaw(data.analogs || [])
        setHistoryRaw(data.history || [])
      } catch (err) {
        console.error("[DETAILS] ERROR:", err)
        setAnalogsRaw([])
        setHistoryRaw([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchPartDetails()
  }, [partBrandKey])

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

  // Filtered analogs - current part first, then apply stock filter
  const analogsData = useMemo(() => {
    const currentPartKey = row?.part_brand_key || `${row.partCode}_${row.manufacturer}`
    
    // Find current part in n8n response to get its price
    const currentPartFromApi = analogsRaw.find(
      (a) => a.part_brand_key === currentPartKey
    )
    
    // Create current part row - all fields come from n8n response
    const currentPart: AnalogItem = {
      part_brand_key: currentPartKey,
      code: currentPartFromApi?.code || row.partCode,
      brand: row.manufacturer,
      sold_12m: currentPartFromApi?.sold_12m,
      sales_monthly: currentPartFromApi?.sales_monthly,
      price: currentPartFromApi?.price ?? 0,
      purchase_price: currentPartFromApi?.purchase_price,
      stock: currentPartFromApi?.stock ?? row.stock,
      purchase_history: currentPartFromApi?.purchase_history,
      last_sale_price: currentPartFromApi?.last_sale_price,
      last_sale_date: currentPartFromApi?.last_sale_date,
      last_stock_zero_date: currentPartFromApi?.last_stock_zero_date,
    }
    
    // Filter out current part from raw analogs (avoid duplicates)
    const otherAnalogs = analogsRaw.filter(
      (a) => a.part_brand_key !== currentPartKey
    )
    
    // Apply zero stock filter if toggle is OFF
    const filteredAnalogs = includeZeroStock
      ? otherAnalogs
      : otherAnalogs.filter((a) => a.stock > 0)
    
    // Current part is always first
    return [currentPart, ...filteredAnalogs]
  }, [analogsRaw, row, includeZeroStock])

  // History data (no filtering needed)
  const historyData = historyRaw

  // Reset selection when product changes (analogsRaw reference changes)
  useEffect(() => {
    setSelectedPartKey(null)
  }, [analogsRaw])
  
  // Derive selectedAnalog from selectedPartKey and analogsData
  const selectedAnalog = useMemo(() => {
    if (analogsData.length === 0) return null
    
    // If selectedPartKey is set and exists in current data, use it
    if (selectedPartKey) {
      const found = analogsData.find(a => a.part_brand_key === selectedPartKey)
      if (found) return found
    }
    
    // Fallback to first analog
    return analogsData[0]
  }, [analogsData, selectedPartKey])
  
  // Callback to select analog by key
  const handleSelectAnalog = useCallback((analog: AnalogItem) => {
    setSelectedPartKey(analog.part_brand_key)
  }, [])

  // Render a block by ID
  const renderBlock = useCallback(
    (blockId: BlockId) => {
      switch (blockId) {
        case "pricing":
          return <PricingBlock row={row} />
        case "inventory":
          return <InventoryBlock row={row} />
        case "physical":
          return <PhysicalBlock row={row} />
case "sales":
          return <SalesBlock selectedAnalog={selectedAnalog} />
        case "analogs":
          return (
            <AnalogsBlock
              analogs={analogsData}
              isLoading={isLoading}
              includeZeroStock={includeZeroStock}
              onToggleZeroStock={() => setIncludeZeroStock((prev) => !prev)}
              currentPartKey={row?.part_brand_key || `${row.partCode}_${row.manufacturer}`}
              selectedAnalog={selectedAnalog}
              onSelectAnalog={handleSelectAnalog}
            />
          )
        case "analogDetails":
          return <AnalogDetailsBlock selectedAnalog={selectedAnalog} />
        case "history":
          return <HistoryBlock history={historyData} isLoading={isLoading} />
        default:
          return null
      }
    },
    [row, analogsData, historyData, isLoading, includeZeroStock, selectedAnalog, handleSelectAnalog]
  )

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Part details"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
        {/* Left: Title */}
        <div className="w-24">
          <h2 className="text-sm font-semibold text-foreground">Part Details</h2>
        </div>
        
        {/* Center: Warehouse Selector */}
        <div className="flex flex-1 justify-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Warehouse
            </span>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="h-7 w-[120px] border-border/50 bg-transparent text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="koms18">Комс 18</SelectItem>
                <SelectItem value="talnakh">Талнах</SelectItem>
                <SelectItem value="salut">Салют</SelectItem>
                <SelectItem value="garage">Гараж</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Right: Close Button */}
        <div className="w-24 flex justify-end">
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
      </div>

      {/* Scrollable content with draggable blocks */}
      <ScrollArea className="flex-1">
        {/* Sticky Product Name Header */}
        <ProductHeader row={row} />
        
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
