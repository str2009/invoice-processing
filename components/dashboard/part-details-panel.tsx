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
  MessageSquare,
  Check,
  Globe,
  Loader2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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

// --- Types ---
interface AnalyticsRow {
  id: string
  partCode: string
  brand: string
  supplier: string
  partName: string
  purchase: number
  current: number
  marginPct: number
  marginAbs: number
  deltaPct: number
  deltaAbs: number
  stock: number
  incoming: number
  totalStock: number
  sales12m: number
  sales3m: number
  coverageDays: number
  pricingGroup: string
  weight: number
  bulk: number
  competitorPrice: number
  competitorStock: number
  lastSaleDate: string
  abcClass: string
  riskScore: number
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
  stock_by_wh?: {
    komsa18?: number
    salut?: number
    talnah?: number
  }
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

interface CommentRecord {
  id: string
  part_brand_key: string
  comment: string
  manager: string
  source: string
  created_at: string
  updated_at: string
}

interface WebPricingData {
  price: number
  stock: number
  delivery_days: number
  supplier: string
}

interface DetailsResponse {
  analogs: AnalogItem[]
  history: HistoryItem[]
  analytics?: Record<string, unknown>
}

interface PartDetailsPanelProps {
  row: AnalyticsRow | null
  onClose: () => void
  onCommentChange?: (partBrandKey: string, hasComment: boolean) => void
}

type BlockId = "comment" | "web" | "pricing" | "inventory" | "physical" | "sales" | "analogs" | "analogDetails" | "history"

const STORAGE_KEY = "analytics-part-details-layout"

const DEFAULT_ORDER: BlockId[] = [
  "analogs",
  "analogDetails",
  "web",
  "comment",
  "pricing",
  "inventory",
  "physical",
  "sales",
  "history",
]

const WEBHOOK_URL = "https://max24vin.ru/webhook/analytics-details-5ee2beb3bf59"

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
function ProductHeader({ row }: { row: AnalyticsRow }) {
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

function PricingBlock({ row }: { row: AnalyticsRow }) {
  const margin = row.current > 0 ? ((row.current - row.purchase) / row.current) * 100 : 0

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pricing
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Purchase (Cost)" value={row.purchase.toFixed(2)} />
        <div className="border-t border-border/50" />
        <InfoRow label="Current (Now)" value={row.current.toFixed(2)} />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Incoming (Ship)"
          value={row.incoming > 0 ? row.incoming.toFixed(2) : "---"}
          className={row.incoming === 0 ? "text-muted-foreground/40" : ""}
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

function InventoryBlock({ row }: { row: AnalyticsRow }) {
  const totalValue = row.purchase * row.bulk

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Inventory
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Quantity (invoice)" value={row.bulk} />
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

function PhysicalBlock({ row }: { row: AnalyticsRow }) {
  const totalWeight = row.weight * row.bulk

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
  commentsMap,
}: {
  analogs: AnalogItem[]
  isLoading: boolean
  includeZeroStock: boolean
  onToggleZeroStock: () => void
  currentPartKey: string
  selectedAnalog: AnalogItem | null
  onSelectAnalog: (analog: AnalogItem) => void
  commentsMap: Record<string, boolean>
}) {
  const bestPrice = analogs.length > 0 ? Math.min(...analogs.map((a) => a.price)) : 0

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Analogs
          </span>
        </div>
        <label className="mx-auto flex cursor-pointer items-center gap-1.5">
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
                  <th className="w-4 px-1 py-1.5"></th>
                  <th className="px-2 py-1.5 text-left font-medium">Code</th>
                      <th className="px-2 py-1.5 text-right font-medium">Sold 12m</th>
                      <th className="px-2 py-1.5 text-right font-medium">Now</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                  <th className="px-2 py-1.5 text-right font-medium">Наличие</th>
                  <th className="px-2 py-1.5 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {analogs.map((analog, idx) => {
                  const isCurrentPart = analog.part_brand_key === currentPartKey
                  const isSelected = selectedAnalog?.part_brand_key === analog.part_brand_key
                  
                  // Calculate inactivity level for row highlighting
                  const getDaysSince = (dateStr: string | undefined): number | null => {
                    if (!dateStr) return null
                    const d = new Date(dateStr)
                    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
                  }
                  
                  // Use lastSaleDate, or fallback to latest purchase date
                  let days: number | null = null
                  if (analog.last_sale_date) {
                    days = getDaysSince(analog.last_sale_date)
                  } else if (analog.purchase_history && analog.purchase_history.length > 0) {
                    // Get most recent purchase date
                    const latestPurchase = analog.purchase_history[0]?.date
                    days = getDaysSince(latestPurchase)
                  }
                  // If neither exists, days stays null -> no highlight
                  
                  const inactivityBg = days !== null && days >= 730
                    ? "rgba(255, 80, 80, 0.16)"    // dead: 2+ years, soft red
                    : days !== null && days >= 365
                      ? "rgba(255, 120, 150, 0.12)" // slow: 1+ year, soft pink
                      : undefined
                  
                  return (
                    <tr
                      key={analog.part_brand_key}
                      onClick={() => onSelectAnalog(analog)}
                      className={`cursor-pointer transition-colors ${idx < analogs.length - 1 ? "border-b border-border/30" : ""} ${
                        isSelected ? "bg-muted" : isCurrentPart ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                      }`}
                      style={inactivityBg && !isSelected ? { backgroundColor: inactivityBg } : undefined}
                    >
                      <td className="w-4 px-1 py-1.5 text-center">
                        {commentsMap[analog.part_brand_key] && (
                          <span className="text-red-500 font-bold text-[10px]">!</span>
                        )}
                      </td>
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
                      <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${isCurrentPart ? "text-foreground" : "text-foreground/80"}`}>
                        {analog.stock_by_wh 
                          ? `${analog.stock} (${analog.stock_by_wh.komsa18 || 0}-${analog.stock_by_wh.salut || 0}-${analog.stock_by_wh.talnah || 0})`
                          : analog.stock}
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

function CommentBlock({
  comment,
  isLoading,
  onEdit,
  selectedAnalog,
}: {
  comment: CommentRecord | null
  isLoading: boolean
  onEdit: () => void
  selectedAnalog: AnalogItem | null
}) {
  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Comment
        </span>
        {selectedAnalog && (
          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[150px]">
            ({selectedAnalog.part_brand_key})
          </span>
        )}
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        {!selectedAnalog ? (
          <p className="text-xs text-muted-foreground/60 text-center py-1">
            Select an analog to view/add comments
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : comment?.comment ? (
          <div className="space-y-1.5">
            <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4">
              {comment.comment}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/60">
                {comment.manager} • {new Date(comment.updated_at).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={onEdit}
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-full text-xs text-muted-foreground"
            onClick={onEdit}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Add comment
          </Button>
        )}
      </div>
    </div>
  )
}

function WebBlock({
  webData,
  isLoading,
  error,
  selectedAnalog,
  webEnabled,
}: {
  webData: WebPricingData | null
  isLoading: boolean
  error: string | null
  selectedAnalog: AnalogItem | null
  webEnabled: boolean
}) {
  if (!webEnabled) return null

  return (
    <div className="pl-6">
      <div className="mb-2 flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Web
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        {!selectedAnalog ? (
          <p className="text-xs text-muted-foreground/60 text-center py-1">
            Select a part
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-xs text-destructive text-center py-1">
            Failed to load data
          </p>
        ) : webData ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Supplier</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {webData.supplier}
              </span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Price</span>
              <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {webData.price.toLocaleString()} ₽
              </span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Stock</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {webData.stock}
              </span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Delivery</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {webData.delivery_days} days
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 text-center py-1">
            No data available
          </p>
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

  // Calculate days since last sale
  const getDaysSinceLastSale = (dateStr: string | undefined): number | null => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Format days as "118 d" or "2y 118d"
  const formatDaysSince = (days: number | null): string => {
    if (days === null) return "no sales"
    if (days < 365) return `${days} d`
    const years = Math.floor(days / 365)
    const restDays = days % 365
    return `${years}y ${restDays}d`
  }

  const daysSinceLastSale = getDaysSinceLastSale(selectedAnalog.last_sale_date)
  
  // Determine inactivity level for highlighting
  const getInactivityLevel = (days: number | null): "normal" | "slow" | "dead" => {
    if (days === null) return "dead" // no sales = treat as dead stock
    if (days >= 730) return "dead"   // 2+ years
    if (days >= 365) return "slow"   // 1+ year
    return "normal"
  }
  
  const inactivityLevel = getInactivityLevel(daysSinceLastSale)

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
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base tabular-nums">
                    {selectedAnalog.last_sale_price 
                      ? selectedAnalog.last_sale_price.toLocaleString("ru-RU") 
                      : "—"}
                  </span>
                  <span 
                    className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                      inactivityLevel === "dead" 
                        ? "bg-red-500/15 text-red-400" 
                        : inactivityLevel === "slow" 
                          ? "bg-amber-500/15 text-amber-400" 
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {formatDaysSince(daysSinceLastSale)}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {formatDateShort(selectedAnalog.last_sale_date)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-sm text-red-400">no sales</span>
              </div>
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

export function PartDetailsPanel({ row, onClose, onCommentChange }: PartDetailsPanelProps) {
  const [blocksOrder, setBlocksOrder] = useState<BlockId[]>(DEFAULT_ORDER)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [analogsRaw, setAnalogsRaw] = useState<AnalogItem[]>([])
  const [historyRaw, setHistoryRaw] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [includeZeroStock, setIncludeZeroStock] = useState(false)
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null)

  // Comment state
  const [commentData, setCommentData] = useState<CommentRecord | null>(null)
  const [isCommentLoading, setIsCommentLoading] = useState(false)
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [commentSaved, setCommentSaved] = useState(false)
  const [analogsCommentsMap, setAnalogsCommentsMap] = useState<Record<string, boolean>>({})

  // Web pricing state
  const [webEnabled, setWebEnabled] = useState(false)
  const [webData, setWebData] = useState<WebPricingData | null>(null)
  const [webLoading, setWebLoading] = useState(false)
  const [webError, setWebError] = useState<string | null>(null)

  // Get part_brand_key from row
  const partBrandKey = row ? `${row.partCode}_${row.brand}` : null

  // Fetch part details - depends ONLY on partBrandKey
  useEffect(() => {
    console.log("[v0] PartDetailsPanel useEffect triggered, row:", row)
    if (!row) {
      console.log("[v0] No row, skipping fetch")
      return
    }

    const fetchPartDetails = async () => {
      console.log("[v0] Fetching details for:", row.partCode, row.brand)
      setIsLoading(true)

      try {
        console.log("[v0] Sending POST to:", WEBHOOK_URL)
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            part_code: row.partCode,
            brand: row.brand,
          }),
        })

        console.log("[v0] Response status:", res.status)
        const data = await res.json()
        console.log("[v0] Response data:", data)

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
  }, [row?.partCode, row?.brand])

  // Load order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          // Merge saved order with new blocks that might have been added
          const validSaved = parsed.filter((id: string) => DEFAULT_ORDER.includes(id as BlockId))
          const missing = DEFAULT_ORDER.filter((id) => !validSaved.includes(id))
          setBlocksOrder([...validSaved, ...missing] as BlockId[])
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
    if (!row) return []
    
    const currentPartKey = `${row.partCode}_${row.brand}`
    
    // Find current part in response to get its price
    const currentPartFromApi = analogsRaw.find(
      (a) => a.part_brand_key === currentPartKey
    )
    
    // Create current part row - all fields come from response
    const currentPart: AnalogItem = {
      part_brand_key: currentPartKey,
      code: currentPartFromApi?.code || row.partCode,
      brand: row.brand,
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

  // Fetch comments status for all analogs
  useEffect(() => {
    if (!analogsData || analogsData.length === 0) {
      setAnalogsCommentsMap({})
      return
    }

    const fetchAnalogsComments = async () => {
      const keys = analogsData.map((a) => a.part_brand_key)
      try {
        const response = await fetch("/api/comments/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys }),
        })
        if (response.ok) {
          const data = await response.json()
          setAnalogsCommentsMap(data)
        }
      } catch {
        // Ignore errors
      }
    }

    fetchAnalogsComments()
  }, [analogsData])

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

  // Fetch comment based on selected analog
  useEffect(() => {
    const commentKey = selectedAnalog?.part_brand_key
    if (!commentKey) {
      setCommentData(null)
      return
    }

    const fetchComment = async () => {
      setIsCommentLoading(true)
      try {
        const response = await fetch(`/api/comments?part_brand_key=${encodeURIComponent(commentKey)}`)
        if (response.ok) {
          const data = await response.json()
          setCommentData(data)
        } else {
          setCommentData(null)
        }
      } catch {
        setCommentData(null)
      } finally {
        setIsCommentLoading(false)
      }
    }

    fetchComment()
  }, [selectedAnalog?.part_brand_key])

  // Open comment modal
  const handleOpenCommentModal = useCallback(() => {
    setCommentText(commentData?.comment || "")
    setIsCommentModalOpen(true)
    setCommentSaved(false)
  }, [commentData])

  // Fetch web pricing when webEnabled and selectedAnalog changes
  useEffect(() => {
    // Clear data when web is disabled
    if (!webEnabled) {
      setWebData(null)
      setWebError(null)
      return
    }

    // No analog selected
    if (!selectedAnalog) {
      setWebData(null)
      setWebError(null)
      return
    }

    // Debounce timer
    const debounceTimer = setTimeout(async () => {
      setWebLoading(true)
      setWebError(null)

      try {
        // Extract part_code and brand from part_brand_key
        const parts = selectedAnalog.part_brand_key.split("_")
        const part_code = parts[0]
        const brand = parts.slice(1).join("_") || selectedAnalog.brand

        const response = await fetch("/api/web-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part_code, brand }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch")
        }

        const data = await response.json()
        setWebData(data)
      } catch {
        setWebError("Failed to load data")
        setWebData(null)
      } finally {
        setWebLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(debounceTimer)
  }, [webEnabled, selectedAnalog?.part_brand_key])
  
  // Save comment for selected analog
  const handleSaveComment = useCallback(async () => {
    const commentKey = selectedAnalog?.part_brand_key
    if (!commentKey) return

    setIsSavingComment(true)
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_brand_key: commentKey,
          comment: commentText,
          manager: "manager",
          source: "analytics",
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCommentData(data)
        setCommentSaved(true)
        // Update the analogs comments map
        if (commentKey) {
          setAnalogsCommentsMap((prev) => ({
            ...prev,
            [commentKey]: !!commentText,
          }))
        }
        // Notify parent about comment change
        if (onCommentChange) {
          onCommentChange(commentKey, !!commentText)
        }
        setTimeout(() => {
          setIsCommentModalOpen(false)
          setCommentSaved(false)
        }, 800)
      }
    } catch {
      // Handle error silently
    } finally {
      setIsSavingComment(false)
    }
  }, [selectedAnalog?.part_brand_key, commentText, onCommentChange])

  // Render a block by ID
  const renderBlock = useCallback(
    (blockId: BlockId) => {
      if (!row) return null
      
      switch (blockId) {
        case "comment":
          return (
            <CommentBlock
              comment={commentData}
              isLoading={isCommentLoading}
              onEdit={handleOpenCommentModal}
              selectedAnalog={selectedAnalog}
            />
          )
        case "web":
          return (
            <WebBlock
              webData={webData}
              isLoading={webLoading}
              error={webError}
              selectedAnalog={selectedAnalog}
              webEnabled={webEnabled}
            />
          )
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
              currentPartKey={partBrandKey || ""}
              selectedAnalog={selectedAnalog}
              onSelectAnalog={handleSelectAnalog}
              commentsMap={analogsCommentsMap}
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
    [row, analogsData, historyData, isLoading, includeZeroStock, selectedAnalog, handleSelectAnalog, commentData, isCommentLoading, handleOpenCommentModal, analogsCommentsMap, webData, webLoading, webError, webEnabled, partBrandKey]
  )

  if (!row) return null

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Part details"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
        {/* Left: Title */}
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Part Details</h2>
        </div>

        {/* Web Toggle */}
        <label className="flex cursor-pointer items-center gap-1.5 mr-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Web
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={webEnabled}
            onClick={() => setWebEnabled((prev) => !prev)}
            className={`relative h-4 w-7 rounded-full transition-colors ${
              webEnabled ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                webEnabled ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
        
        {/* Comment Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={handleOpenCommentModal}
          disabled={!selectedAnalog}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comment
          {commentData?.comment && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </Button>

        {/* Right: Warehouse Selector */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Warehouse
          </span>
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="h-7 w-[80px] border-border/50 bg-transparent text-xs">
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
        
        {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 ml-2"
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

      {/* Comment Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add your note..."
              className="min-h-[100px] text-sm resize-none"
              disabled={isSavingComment}
            />
            {commentData?.updated_at && (
              <p className="text-[10px] text-muted-foreground">
                Last updated by {commentData.manager} on{" "}
                {new Date(commentData.updated_at).toLocaleString()}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCommentModalOpen(false)}
              disabled={isSavingComment}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveComment}
              disabled={isSavingComment}
              className="min-w-[70px]"
            >
              {commentSaved ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Saved
                </>
              ) : isSavingComment ? (
                "Saving..."
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
