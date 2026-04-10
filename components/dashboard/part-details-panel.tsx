"use client"

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react"
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
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
  GripVertical,
  Link2,
  History,
} from "lucide-react"

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

interface AnalyticsData {
  price_best: number
  offers: number
  sold_12m: number
  days_no_sales: number
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
  price: number
  qty: number
}

interface PartDetailsResponse {
  analytics: AnalyticsData
  analogs: AnalogItem[]
  history: HistoryItem[]
}

interface PartDetailsPanelProps {
  row: AnalyticsRow | null
  onClose: () => void
}

// --- localStorage helpers ---
const STORAGE_KEY = "part-details-layout"

function loadBlocksOrder(): string[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function saveBlocksOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // ignore storage errors
  }
}

// --- Block IDs ---
const defaultBlocksOrder = [
  "identity",
  "pricing",
  "inventory",
  "physical",
  "sales",
  "analogs",
  "history",
]

// --- Info Row helper ---
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
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] font-medium text-center ${className || "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

// --- Skeleton Rows ---
function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

// --- Sortable Block Wrapper ---
function SortableItem({
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

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      <div
        className="absolute left-1.5 top-2 z-10 cursor-grab rounded p-0.5 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      {children}
    </div>
  )
}

// --- Block Components ---
function IdentityCard({ row }: { row: AnalyticsRow }) {
  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Identity
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5">
        <p className="font-mono text-xs font-semibold text-foreground">
          {row.partCode}
        </p>
        <p className="text-[11px] text-muted-foreground">{row.brand}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {row.pricingGroup} / {row.abcClass}
        </p>
      </div>
    </div>
  )
}

function PricingCard({ row }: { row: AnalyticsRow }) {
  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Pricing
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Purchase" value={row.purchase.toFixed(2)} />
        <div className="border-t border-border/50" />
        <InfoRow label="Current" value={row.current.toFixed(2)} />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Margin"
          value={`${row.marginPct.toFixed(1)}%`}
          className={
            row.marginPct > 40
              ? "text-emerald-600 dark:text-emerald-400"
              : row.marginPct < 0
              ? "text-red-500"
              : "text-amber-600 dark:text-amber-400"
          }
        />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Competitor"
          value={row.competitorPrice > 0 ? row.competitorPrice.toFixed(2) : "---"}
          className={
            row.competitorPrice > 0 && row.competitorPrice < row.current
              ? "text-red-500"
              : ""
          }
        />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Risk Score"
          value={row.riskScore}
          className={
            row.riskScore >= 60
              ? "text-red-500"
              : row.riskScore >= 30
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        />
      </div>
    </div>
  )
}

function InventoryCard({ row }: { row: AnalyticsRow }) {
  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Inventory
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow
          label="Current"
          value={row.stock}
          className={row.stock < 20 ? "text-amber-600 dark:text-amber-400" : ""}
        />
        <div className="border-t border-border/50" />
        <InfoRow label="Incoming" value={row.incoming} />
        <div className="border-t border-border/50" />
        <InfoRow label="Total" value={row.totalStock} />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Coverage"
          value={row.coverageDays >= 9999 ? "---" : `${row.coverageDays}d`}
          className={
            row.coverageDays < 30 ? "text-amber-600 dark:text-amber-400" : ""
          }
        />
      </div>
    </div>
  )
}

function PhysicalCard({ row }: { row: AnalyticsRow }) {
  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Weight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Physical
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="Weight" value={`${row.weight.toFixed(3)} kg`} />
        <div className="border-t border-border/50" />
        <InfoRow label="Bulk Qty" value={row.bulk} />
      </div>
    </div>
  )
}

function SalesCard({
  row,
  analytics,
  isLoading,
}: {
  row: AnalyticsRow
  analytics: AnalyticsData | null
  isLoading: boolean
}) {
  const daysNoSales = analytics?.days_no_sales ?? null

  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Sales
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
        <InfoRow label="12m Sales" value={row.sales12m.toLocaleString("en-US")} />
        <div className="border-t border-border/50" />
        <InfoRow label="3m Sales" value={row.sales3m.toLocaleString("en-US")} />
        <div className="border-t border-border/50" />
        <InfoRow
          label="Monthly Avg"
          value={Math.round(row.sales12m / 12).toLocaleString("en-US")}
        />
        <div className="border-t border-border/50" />
        {isLoading ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-muted-foreground">Days w/o Sales</span>
            <Skeleton className="h-3 w-8" />
          </div>
        ) : (
          <InfoRow
            label="Days w/o Sales"
            value={daysNoSales !== null ? daysNoSales : "---"}
            className={
              daysNoSales !== null && daysNoSales > 30
                ? "text-amber-600 dark:text-amber-400"
                : ""
            }
          />
        )}
      </div>
    </div>
  )
}

function AnalogsCard({
  analogs,
  isLoading,
}: {
  analogs: AnalogItem[]
  isLoading: boolean
}) {
  // Find best (lowest) price
  const bestPrice = useMemo(() => {
    if (!analogs.length) return null
    return Math.min(...analogs.map((a) => a.price))
  }, [analogs])

  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Analogs
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30">
        {isLoading ? (
          <div className="px-3 py-2">
            <SkeletonRows count={4} />
          </div>
        ) : analogs.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <span className="text-[11px] text-muted-foreground/60">No data</span>
          </div>
        ) : (
          <div className="max-h-[160px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    Code
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    Brand
                  </th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                    Price
                  </th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {analogs.map((analog, idx) => {
                  const isBest = analog.price === bestPrice
                  return (
                    <tr
                      key={idx}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="px-2 py-1 font-mono text-foreground">
                        {analog.part_brand_key}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {analog.brand}
                      </td>
                      <td
                        className={`px-2 py-1 text-center font-mono tabular-nums ${
                          isBest
                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {analog.price.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-center font-mono tabular-nums text-muted-foreground">
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

function HistoryCard({
  history,
  isLoading,
}: {
  history: HistoryItem[]
  isLoading: boolean
}) {
  // Sort by date DESC
  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [history])

  return (
    <div className="pl-6">
      <div className="mb-1.5 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Purchase History
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30">
        {isLoading ? (
          <div className="px-3 py-2">
            <SkeletonRows count={5} />
          </div>
        ) : sortedHistory.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <span className="text-[11px] text-muted-foreground/60">No data</span>
          </div>
        ) : (
          <div className="max-h-[180px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    Supplier
                  </th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                    Qty
                  </th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/30 last:border-0"
                  >
                    <td className="px-2 py-1 font-mono text-muted-foreground">
                      {item.date}
                    </td>
                    <td className="px-2 py-1 truncate text-foreground max-w-[100px]">
                      {item.supplier}
                    </td>
                    <td className="px-2 py-1 text-center font-mono tabular-nums text-muted-foreground">
                      {item.qty}
                    </td>
                    <td className="px-2 py-1 text-center font-mono tabular-nums text-foreground">
                      {item.price.toFixed(2)}
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

// --- Main Component ---
export function PartDetailsPanel({ row, onClose }: PartDetailsPanelProps) {
  // Block order state
  const [blocksOrder, setBlocksOrder] = useState<string[]>(() => {
    const saved = loadBlocksOrder()
    if (saved) {
      // Merge with defaults (in case new blocks were added)
      const merged = saved.filter((id) => defaultBlocksOrder.includes(id))
      const missing = defaultBlocksOrder.filter((id) => !merged.includes(id))
      return [...merged, ...missing]
    }
    return defaultBlocksOrder
  })

  // Async data state
  const [asyncData, setAsyncData] = useState<PartDetailsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  // Fetch async data when row changes
  useEffect(() => {
    if (!row) {
      setAsyncData(null)
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      setAsyncData(null)

      try {
        // Construct part_brand_key from row data
        const partBrandKey = `${row.partCode}_${row.brand}`

        const response = await fetch("/api/part-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part_brand_key: partBrandKey }),
        })

        if (response.ok) {
          const data: PartDetailsResponse = await response.json()
          setAsyncData(data)
        } else {
          // Endpoint might not exist yet, use empty data
          setAsyncData({
            analytics: { price_best: 0, offers: 0, sold_12m: 0, days_no_sales: 0 },
            analogs: [],
            history: [],
          })
        }
      } catch {
        // On error, set empty data
        setAsyncData({
          analytics: { price_best: 0, offers: 0, sold_12m: 0, days_no_sales: 0 },
          analogs: [],
          history: [],
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [row])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setBlocksOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string)
      const newIdx = prev.indexOf(over.id as string)
      const newOrder = arrayMove(prev, oldIdx, newIdx)
      saveBlocksOrder(newOrder)
      return newOrder
    })
  }, [])

  // Render block by ID
  const renderBlock = useCallback(
    (blockId: string) => {
      if (!row) return null

      switch (blockId) {
        case "identity":
          return <IdentityCard row={row} />
        case "pricing":
          return <PricingCard row={row} />
        case "inventory":
          return <InventoryCard row={row} />
        case "physical":
          return <PhysicalCard row={row} />
        case "sales":
          return (
            <SalesCard
              row={row}
              analytics={asyncData?.analytics ?? null}
              isLoading={isLoading}
            />
          )
        case "analogs":
          return (
            <AnalogsCard
              analogs={asyncData?.analogs ?? []}
              isLoading={isLoading}
            />
          )
        case "history":
          return (
            <HistoryCard
              history={asyncData?.history ?? []}
              isLoading={isLoading}
            />
          )
        default:
          return null
      }
    },
    [row, asyncData, isLoading]
  )

  if (!row) return null

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Part analytics"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-xs font-semibold text-foreground">Part Details</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Close panel</span>
        </Button>
      </div>

      {/* Scrollable content with DnD */}
      <ScrollArea className="flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocksOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3 p-3">
              {blocksOrder.map((blockId) => (
                <SortableItem key={blockId} id={blockId}>
                  {renderBlock(blockId)}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>
    </aside>
  )
}
