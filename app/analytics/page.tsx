"use client"

import { useState, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
  type ColumnSizingState,
  type VisibilityState,
  type Header,
  type Cell,
} from "@tanstack/react-table"
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
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { ControlPanel } from "@/components/dashboard/control-panel"
import { PartDetailsPanel } from "@/components/dashboard/part-details-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiLevelCalendar } from "@/components/ui/multi-level-calendar"
import type { DateRange } from "react-day-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Table components not used - using native table elements for resizing support
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  BarChart3,
  ChevronUp,
  ChevronDown,
  PanelLeft,
  GripHorizontal,
  Columns3,
  CalendarDays,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import type { InvoiceRow, InvoiceListItem } from "@/lib/mock-data"
import { useResizablePanel } from "@/hooks/use-resizable-panel"

// --- Extended analytics row ---
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

// --- Transform InvoiceRow[] -> AnalyticsRow[] (pure, no mock data) ---
function toAnalyticsRows(rows: InvoiceRow[]): AnalyticsRow[] {
  const abcClasses = ["A", "A", "B", "B", "B", "C", "C"]
  const pricingGroups = ["Standard", "Premium", "Economy", "OEM", "Aftermarket"]
  return rows.map((row, idx) => {
    const margin = row.now > 0 ? ((row.now - row.cost) / row.now) * 100 : 0
    const marginAbs = row.now - row.cost
    const deltaAbs = row.now > 0 ? row.cost * (row.deltaPercent / 100) : 0
    const sales3m = row.sales12m > 0 ? Math.round(row.sales12m * 0.25) : 0
    const monthlyAvg = row.sales12m / 12
    const coverage = monthlyAvg > 0 ? Math.round((row.stock / monthlyAvg) * 30) : 9999
    const incoming = 0
    const competitorPrice = 0
    const competitorStock = 0
    const riskScore = Math.round(
      (margin < 10 ? 30 : 0) +
      (row.stock < 10 ? 25 : 0) +
      (coverage < 30 ? 20 : 0) +
      (row.sales12m < 50 ? 15 : 0)
    )

    return {
      id: row.id ?? String(idx + 1),
      partCode: row.partCode,
      brand: row.manufacturer,
      supplier: row.manufacturer,
      partName: row.partName,
      purchase: row.cost,
      current: row.now,
      marginPct: margin,
      marginAbs,
      deltaPct: row.deltaPercent,
      deltaAbs,
      stock: row.stock,
      incoming,
      totalStock: row.stock + incoming,
      sales12m: row.sales12m,
      sales3m,
      coverageDays: coverage,
      pricingGroup: pricingGroups[idx % pricingGroups.length],
      weight: row.weight,
      bulk: row.qty,
      competitorPrice,
      competitorStock,
      lastSaleDate: "",
      abcClass: abcClasses[idx % abcClasses.length],
      riskScore: Math.min(riskScore, 100),
    }
  })
}

// --- Numeric column IDs for centering ---
const numericCols = new Set([
  "purchase", "current", "marginPct", "marginAbs", "deltaPct", "deltaAbs",
  "stock", "incoming", "totalStock", "sales12m", "sales3m", "coverageDays",
  "weight", "bulk", "competitorPrice", "competitorStock", "riskScore",
])

// --- localStorage helpers for column persistence ---
const STORAGE_KEY_ORDER = "analytics-column-order"
const STORAGE_KEY_SIZING = "analytics-column-sizing"
const STORAGE_KEY_VISIBILITY = "analytics-column-visibility"

function loadFromStorage<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

// --- Default column widths ---
const defaultColumnSizing: ColumnSizingState = {
  partCode: 120,
  brand: 100,
  supplier: 100,
  purchase: 90,
  current: 90,
  marginPct: 80,
  marginAbs: 90,
  deltaPct: 80,
  deltaAbs: 80,
  stock: 70,
  incoming: 70,
  totalStock: 80,
  sales12m: 80,
  sales3m: 80,
  coverageDays: 80,
  pricingGroup: 100,
  moot: 90,
  weight: 80,
  bulk: 60,
  competitorPrice: 100,
  competitorStock: 100,
  lastSaleDate: 90,
  abcClass: 60,
  riskScore: 70,
}

// --- Resize Handle Component ---
function ResizeHandle({
  header,
  onDoubleClick,
}: {
  header: Header<AnalyticsRow, unknown>
  onDoubleClick: () => void
}) {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onDoubleClick={onDoubleClick}
      className={`absolute right-0 top-0 z-10 h-full w-[5px] cursor-col-resize select-none touch-none transition-colors ${header.column.getIsResizing()
          ? "bg-primary"
          : "bg-border hover:bg-primary/60"
        }`}
      style={{ transform: "translateX(50%)" }}
    />
  )
}

// --- Sort header ---
function SortHeader({
  column,
  label,
}: {
  column: {
    toggleSorting: (desc: boolean) => void
    getIsSorted: () => false | "asc" | "desc"
  }
  label: string
}) {
  const sorted = column.getIsSorted()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-1 h-7 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {sorted === "asc" && <ArrowUp className="ml-0.5 h-3 w-3 text-primary" />}
      {sorted === "desc" && <ArrowDown className="ml-0.5 h-3 w-3 text-primary" />}
    </Button>
  )
}
function MootEditor({ row, setMootChanges }: any) {
  const initial = row.original.moot ?? ""
  const [value, setValue] = useState(initial)

  return (
    <input
      type="number"
      step="0.1"
      value={value}
      onChange={(e) => {
        const val = e.target.value
        setValue(val)

        setMootChanges((prev: any) => ({
          ...prev,
          [row.original.id]: Number(val),
        }))
      }}
      className="w-[70px] h-7 border rounded px-2 text-xs font-mono"
    />
  )
}

// --- Draggable header cell with resize handle ---
function DraggableHeaderCell({ 
  header,
  onAutoFit,
}: { 
  header: Header<AnalyticsRow, unknown>
  onAutoFit: (columnId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: header.column.id })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    width: header.getSize(),
    minWidth: 40,
  }
  const isSorted = header.column.getIsSorted()
  const isNumeric = numericCols.has(header.column.id)
  return (
    <th
      ref={setNodeRef}
      style={style}
      data-column-id={header.column.id}
      className={`relative h-9 select-none border-b-2 border-r-2 border-border bg-muted px-2 text-left text-xs font-semibold text-muted-foreground ${isDragging ? "z-20" : ""}`}
      colSpan={header.colSpan}
    >
      <div
        className={`flex h-full cursor-grab items-center gap-1 active:cursor-grabbing ${isNumeric ? "justify-center" : ""}`}
        {...attributes}
        {...listeners}
      >
        <span
          className="cursor-pointer truncate hover:text-foreground"
          onClick={() => header.column.toggleSorting()}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onAutoFit(header.column.id)
          }}
        >
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {isSorted === "asc" && <ArrowUp className="h-3 w-3 shrink-0 text-primary" />}
        {isSorted === "desc" && <ArrowDown className="h-3 w-3 shrink-0 text-primary" />}
      </div>
      <ResizeHandle
        header={header}
        onDoubleClick={() => onAutoFit(header.column.id)}
      />
    </th>
  )
}

// --- Draggable body cell ---
function DraggableCell({ cell, width }: { cell: Cell<AnalyticsRow, unknown>; width: number }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: cell.column.id })
  const isNumeric = numericCols.has(cell.column.id)
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width,
    minWidth: 40,
  }
  return (
    <td
      ref={setNodeRef}
      style={style}
      data-column-id={cell.column.id}
      className={`truncate border-b border-r border-border px-2 py-1.5 text-xs ${isNumeric ? "text-center" : ""}`}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  )
}

// --- Filter toggle button ---
function FilterToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

// --- Info row for detail panel ---
function InfoRow({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] font-medium ${className || "text-foreground"}`}>{value}</span>
    </div>
  )
}

// --- Column labels for column manager ---
const columnLabels: Record<string, string> = {
  partCode: "Part Code",
  brand: "Brand",
  supplier: "Supplier",
  purchase: "Purchase",
  current: "Current",
  marginPct: "Margin %",
  marginAbs: "Margin Abs",
  deltaPct: "Delta %",
  deltaAbs: "Delta Abs",
  stock: "Stock",
  incoming: "Incoming",
  totalStock: "Total Stock",
  sales12m: "12m Sales",
  sales3m: "3m Sales",
  coverageDays: "Coverage Days",
  pricingGroup: "Pricing Group",
  weight: "Weight",
  bulk: "Bulk",
  competitorPrice: "Competitor Price",
  competitorStock: "Competitor Stock",
  lastSaleDate: "Last Sale Date",
  abcClass: "ABC Class",
  riskScore: "Risk Score",
}

// --- Column definitions (23 columns) ---
function getColumns(setMootChanges: any): ColumnDef<AnalyticsRow>[] {
  return [
  {
    id: "partCode",
    accessorKey: "partCode",
    header: ({ column }) => <SortHeader column={column} label="Part Code" />,
    cell: ({ row }) => <span className="font-mono text-[11px] text-foreground">{row.getValue("partCode")}</span>,
  },
  {
    id: "brand",
    accessorKey: "brand",
    header: ({ column }) => <SortHeader column={column} label="Brand" />,
    cell: ({ row }) => <span className="text-[11px]">{row.getValue("brand")}</span>,
  },
  {
    id: "supplier",
    accessorKey: "supplier",
    header: ({ column }) => <SortHeader column={column} label="Supplier" />,
    cell: ({ row }) => <span className="text-[11px] text-muted-foreground">{row.getValue("supplier")}</span>,
  },
  {
    id: "purchase",
    accessorKey: "purchase",
    header: ({ column }) => <SortHeader column={column} label="Purchase" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{(row.getValue("purchase") as number).toFixed(2)}</span>,
  },
  {
    id: "current",
    accessorKey: "current",
    header: ({ column }) => <SortHeader column={column} label="Current" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums">{(row.getValue("current") as number).toFixed(2)}</span>,
  },
  {
    id: "marginPct",
    accessorKey: "marginPct",
    header: ({ column }) => <SortHeader column={column} label="Margin %" />,
    cell: ({ row }) => {
      const v = row.getValue("marginPct") as number
      return (
        <span className={`font-mono text-[11px] tabular-nums ${v > 40 ? "text-emerald-600 dark:text-emerald-400" : v > 20 ? "text-foreground" : v < 0 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
          {v.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: "marginAbs",
    accessorKey: "marginAbs",
    header: ({ column }) => <SortHeader column={column} label="Margin Abs" />,
    cell: ({ row }) => {
      const v = row.getValue("marginAbs") as number
      return <span className={`font-mono text-[11px] tabular-nums ${v < 0 ? "text-red-500" : "text-muted-foreground"}`}>{v.toFixed(2)}</span>
    },
  },
  {
    id: "deltaPct",
    accessorKey: "deltaPct",
    header: ({ column }) => <SortHeader column={column} label="Delta %" />,
    cell: ({ row }) => {
      const v = row.getValue("deltaPct") as number
      if (v === -100) return <span className="font-mono text-[11px] text-muted-foreground/40">---</span>
      return (
        <span className={`font-mono text-[11px] tabular-nums ${v > 0 ? "text-amber-600 dark:text-amber-400" : v < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {v > 0 ? "+" : ""}{v.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: "deltaAbs",
    accessorKey: "deltaAbs",
    header: ({ column }) => <SortHeader column={column} label="Delta Abs" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{(row.getValue("deltaAbs") as number).toFixed(2)}</span>,
  },
  {
    id: "stock",
    accessorKey: "stock",
    header: ({ column }) => <SortHeader column={column} label="Stock" />,
    cell: ({ row }) => {
      const v = row.getValue("stock") as number
      return <span className={`font-mono text-[11px] tabular-nums ${v < 20 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{v}</span>
    },
  },
  {
    id: "incoming",
    accessorKey: "incoming",
    header: ({ column }) => <SortHeader column={column} label="Incoming" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{row.getValue("incoming")}</span>,
  },
  {
    id: "totalStock",
    accessorKey: "totalStock",
    header: ({ column }) => <SortHeader column={column} label="Total Stock" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums">{row.getValue("totalStock")}</span>,
  },
  {
    id: "sales12m",
    accessorKey: "sales12m",
    header: ({ column }) => <SortHeader column={column} label="12m Sales" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{(row.getValue("sales12m") as number).toLocaleString("en-US")}</span>,
  },
  {
    id: "sales3m",
    accessorKey: "sales3m",
    header: ({ column }) => <SortHeader column={column} label="3m Sales" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{(row.getValue("sales3m") as number).toLocaleString("en-US")}</span>,
  },
  {
    id: "coverageDays",
    accessorKey: "coverageDays",
    header: ({ column }) => <SortHeader column={column} label="Coverage" />,
    cell: ({ row }) => {
      const d = row.getValue("coverageDays") as number
      return (
        <span className={`font-mono text-[11px] tabular-nums ${d < 30 ? "text-amber-600 dark:text-amber-400" : d > 365 ? "text-muted-foreground/50" : "text-foreground"}`}>
          {d >= 9999 ? "---" : `${d}d`}
        </span>
      )
    },
  },
  {
    id: "pricingGroup",
    accessorKey: "pricingGroup",
    header: ({ column }) => <SortHeader column={column} label="Pricing Grp" />,
    cell: ({ row }) => <span className="text-[11px]">{row.getValue("pricingGroup")}</span>,
  },
  {
    id: "moot",
    accessorKey: "moot",
    header: ({ column }) => <SortHeader column={column} label="MOOT" />,
    cell: ({ row }) => (
      <MootEditor row={row} setMootChanges={setMootChanges} />
    ),
  },
  {
    id: "weight",
    accessorKey: "weight",
    header: ({ column }) => <SortHeader column={column} label="Weight" />,
    cell: ({ row }) => {
      const w = row.getValue("weight") as number
      return <span className={`font-mono text-[11px] tabular-nums ${w === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{w.toFixed(3)}</span>
    },
  },
  {
    id: "bulk",
    accessorKey: "bulk",
    header: ({ column }) => <SortHeader column={column} label="Bulk" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums">{row.getValue("bulk")}</span>,
  },
  {
    id: "competitorPrice",
    accessorKey: "competitorPrice",
    header: ({ column }) => <SortHeader column={column} label="Comp. Price" />,
    cell: ({ row }) => {
      const cp = row.getValue("competitorPrice") as number
      const current = row.original.current
      return (
        <span className={`font-mono text-[11px] tabular-nums ${cp > 0 && cp < current ? "text-red-500" : "text-muted-foreground"}`}>
          {cp > 0 ? cp.toFixed(2) : "---"}
        </span>
      )
    },
  },
  {
    id: "competitorStock",
    accessorKey: "competitorStock",
    header: ({ column }) => <SortHeader column={column} label="Comp. Stock" />,
    cell: ({ row }) => <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{row.getValue("competitorStock")}</span>,
  },
  {
    id: "lastSaleDate",
    accessorKey: "lastSaleDate",
    header: ({ column }) => <SortHeader column={column} label="Last Sale" />,
    cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground">{row.getValue("lastSaleDate")}</span>,
  },
  {
    id: "abcClass",
    accessorKey: "abcClass",
    header: ({ column }) => <SortHeader column={column} label="ABC" />,
    cell: ({ row }) => {
      const c = row.getValue("abcClass") as string
      return (
        <span className={`text-[11px] font-semibold ${c === "A" ? "text-emerald-600 dark:text-emerald-400" : c === "B" ? "text-foreground" : "text-muted-foreground"}`}>
          {c}
        </span>
      )
    },
  },
  {
    id: "riskScore",
    accessorKey: "riskScore",
    header: ({ column }) => <SortHeader column={column} label="Risk" />,
    cell: ({ row }) => {
      const v = row.getValue("riskScore") as number
      return (
        <span className={`font-mono text-[11px] tabular-nums font-semibold ${v >= 60 ? "text-red-500" : v >= 30 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {v}
        </span>
      )
    },
  },
]}



// Default visible columns (hide some less important ones by default)
const defaultHidden: string[] = ["supplier", "deltaAbs", "incoming", "sales3m", "competitorStock", "lastSaleDate"]

// --- Main page ---
export default function AnalyticsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Workspace display settings
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable")
  const [uiScale, setUiScale] = useState<"90" | "100" | "110">("100")

  useEffect(() => {
    setMounted(true)
    // Load workspace settings from localStorage
    const savedDensity = localStorage.getItem("workspace_density")
    const savedScale = localStorage.getItem("workspace_ui_scale")
    if (savedDensity === "comfortable" || savedDensity === "compact") {
      setDensity(savedDensity)
    }
    if (savedScale === "90" || savedScale === "100" || savedScale === "110") {
      setUiScale(savedScale)
    }
  }, [])

  // Persist workspace settings
  const handleDensityChange = useCallback((value: "comfortable" | "compact") => {
    setDensity(value)
    localStorage.setItem("workspace_density", value)
  }, [])

  const handleScaleChange = useCallback((value: "90" | "100" | "110") => {
    setUiScale(value)
    localStorage.setItem("workspace_ui_scale", value)
  }, [])

  const { width: rightPanelWidth, handleProps: rightHandleProps } = useResizablePanel({
    storageKey: "analyticsRightPanelWidth",
    defaultWidth: 450,
    minWidth: 320,
    maxWidthPct: 50,
  })
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [mootChanges, setMootChanges] = useState<Record<string, number>>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(defaultColumnSizing)
  const [isHydrated, setIsHydrated] = useState(false)

  const columns = useMemo(() => getColumns(setMootChanges), [setMootChanges])

  const allColumnIds = useMemo(
    () => columns.map((c) => c.id!),
    [columns]
  )

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [pricingGroupFilter, setPricingGroupFilter] = useState("all")
  const [selectedRow, setSelectedRow] = useState<AnalyticsRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerHeight, setDrawerHeight] = useState(60) // vh
  const dragStartY = useRef<number | null>(null)
  const dragStartH = useRef<number>(60)

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartH.current = drawerHeight
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [drawerHeight])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return
    const deltaVh = ((dragStartY.current - e.clientY) / window.innerHeight) * 100
    const next = Math.min(80, Math.max(50, dragStartH.current + deltaVh))
    setDrawerHeight(next)
  }, [])

  const onDragEnd = useCallback(() => {
    dragStartY.current = null
  }, [])

// Load saved settings from localStorage on mount
useEffect(() => {
  const savedOrder = loadFromStorage<string[]>(STORAGE_KEY_ORDER)
  if (savedOrder) {
    const filtered = savedOrder.filter((id) => allColumnIds.includes(id))
    const missing = allColumnIds.filter((id) => !filtered.includes(id))
    setColumnOrder([...filtered, ...missing])
  } else {
    setColumnOrder(allColumnIds)
  }

  const savedSizing = loadFromStorage<ColumnSizingState>(STORAGE_KEY_SIZING)
  if (savedSizing) setColumnSizing({ ...defaultColumnSizing, ...savedSizing })

  const savedVisibility = loadFromStorage<VisibilityState>(STORAGE_KEY_VISIBILITY)
  if (savedVisibility) setColumnVisibility(savedVisibility)

  setIsHydrated(true)
}, [allColumnIds])

// Persist column order changes
const handleColumnOrderChange = useCallback(
  (updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)) => {
    setColumnOrder((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      saveToStorage(STORAGE_KEY_ORDER, next)
      return next
    })
  },
  []
)

// Persist column sizing changes
const handleColumnSizingChange = useCallback(
  (updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)) => {
    setColumnSizing((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      saveToStorage(STORAGE_KEY_SIZING, next)
      return next
    })
  },
  []
)

// Persist column visibility changes
const handleColumnVisibilityChange = useCallback(
  (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    setColumnVisibility((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      saveToStorage(STORAGE_KEY_VISIBILITY, next)
      return next
    })
  },
  []
)

const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const vis: VisibilityState = {}
    defaultHidden.forEach((id) => { vis[id] = false })
    return vis
  })

  const fmtDate = useCallback((d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }), [])
  const dateLabel =
    dateRange && dateRange.from && dateRange.to
      ? `${fmtDate(dateRange.from)} — ${fmtDate(dateRange.to)}`
      : "All time"
  const today = useMemo(() => new Date(), [])

  // Toggle filters
  const [filterInStock, setFilterInStock] = useState(false)
  const [filterSlowMoving, setFilterSlowMoving] = useState(false)
  const [filterNegativeMargin, setFilterNegativeMargin] = useState(false)
  const [filterCompetitor, setFilterCompetitor] = useState(false)
  const [filterBulk, setFilterBulk] = useState(false)

  // Data — manual load only, no auto-fetch
  const [rawInvoiceRows, setRawInvoiceRows] = useState<InvoiceRow[]>([])
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // Manual data load function - called by button click only
  const loadWarehouseData = useCallback(async () => {
    setIsDataLoading(true)
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inStock: filterInStock,
          limit: 200,
          offset: 0,
        }),
      })
      
      if (!response.ok) {
        setIsDataLoading(false)
        return
      }
      
      // Backend returns a plain JSON array
      const data = await response.json()
      const rows = Array.isArray(data) ? data : []
      
      const mappedRows = rows.map((r: Record<string, unknown>, idx: number) => ({
        id: String(r.id ?? idx + 1),
        partCode: (r.part_code as string) ?? (r.partCode as string) ?? "",
        manufacturer: (r.brand as string) ?? (r.manufacturer as string) ?? "",
        partName: (r.part_name as string) ?? (r.partName as string) ?? "",
        qty: Number(r.qty ?? 0),
        cost: Number(r.purchase_price ?? r.cost ?? 0),
        now: Number(r.price ?? r.now ?? r.price_now ?? 0),
        ship: Number(r.ship ?? r.price_ship ?? 0),
        deltaPercent: Number(r.delta_percent ?? r.deltaPercent ?? 0),
        stock: Number(r.stock_qty ?? r.stock ?? 0),
        weight: Number(r.weight ?? 0),
        isBulky: Boolean(r.isBulky),
        productGroup: (r.product_group as string) ?? (r.productGroup as string) ?? "",
        sales12m: Number(r.sales_12m ?? r.sales12m ?? 0),
      })) as InvoiceRow[]
      
      setRawInvoiceRows(mappedRows)
      setIsDataLoaded(true)
    } catch {
      setRawInvoiceRows([])
    } finally {
      setIsDataLoading(false)
    }
  }, [filterInStock])

  const analyticsData = useMemo(() => toAnalyticsRows(rawInvoiceRows), [rawInvoiceRows])
  


// Auto-fit column width to content
const handleAutoFit = useCallback((columnId: string) => {
  // Create a temporary element to measure text
  const measureEl = document.createElement("span")
  measureEl.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:11px;font-family:inherit;padding:0;"
  document.body.appendChild(measureEl)

  // Measure header text
  const headerText = columnLabels[columnId] || columnId
  measureEl.textContent = headerText
  let maxWidth = measureEl.offsetWidth + 40 // add padding for sort icon and spacing

  // Measure all cell values
  analyticsData.forEach((row) => {
    const value = row[columnId as keyof AnalyticsRow]
    let text = ""

    if (value === null || value === undefined) {
      text = ""
    } else if (typeof value === "number") {
      text = value.toFixed(2)
    } else {
      text = String(value)
    }

    measureEl.textContent = text
    const cellWidth = measureEl.offsetWidth + 20
    if (cellWidth > maxWidth) maxWidth = cellWidth
  })

  document.body.removeChild(measureEl)

  // Clamp width between 50 and 400
  const finalWidth = Math.max(50, Math.min(400, maxWidth))
  handleColumnSizingChange((prev) => ({ ...prev, [columnId]: finalWidth }))
}, [analyticsData, handleColumnSizingChange])
  
  const suppliers = useMemo(() => [...new Set(analyticsData.map((r) => r.brand))].sort(), [analyticsData])
  const pricingGroups = useMemo(() => [...new Set(analyticsData.map((r) => r.pricingGroup))].sort(), [analyticsData])

  // Filtered data
  const filteredData = useMemo(() => {
let d = analyticsData
  if (supplierFilter !== "all") d = d.filter((r) => r.brand === supplierFilter)
    if (pricingGroupFilter !== "all") d = d.filter((r) => r.pricingGroup === pricingGroupFilter)
if (filterInStock) d = d.filter((r) => r.stock > 0)
    if (filterSlowMoving) d = d.filter((r) => r.sales12m < 100)
    if (filterNegativeMargin) d = d.filter((r) => r.marginPct < 0)
    if (filterCompetitor) d = d.filter((r) => r.competitorPrice > 0 && r.competitorPrice < r.current)
if (filterBulk) d = d.filter((r) => r.bulk >= 50)
  return d
  }, [analyticsData, supplierFilter, pricingGroupFilter, filterInStock, filterSlowMoving, filterNegativeMargin, filterCompetitor, filterBulk])

  const hasActiveFilters = filterInStock || filterSlowMoving || filterNegativeMargin || filterCompetitor || filterBulk || supplierFilter !== "all" || pricingGroupFilter !== "all"

  const resetFilters = useCallback(() => {
    setFilterInStock(false)
    setFilterSlowMoving(false)
    setFilterNegativeMargin(false)
    setFilterCompetitor(false)
    setFilterBulk(false)
    setSupplierFilter("all")
    setPricingGroupFilter("all")
    setGlobalFilter("")
  }, [])

const table = useReactTable({
  data: filteredData,
  columns,
  state: { sorting, globalFilter, columnOrder, columnSizing, columnVisibility },
  onSortingChange: setSorting,
  onGlobalFilterChange: setGlobalFilter,
  onColumnOrderChange: handleColumnOrderChange,
  onColumnSizingChange: handleColumnSizingChange,
  onColumnVisibilityChange: handleColumnVisibilityChange,
  columnResizeMode: "onChange",
  enableColumnResizing: true,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows
  const rowCount = filteredRows.length

  // Calculate total table width for proper column resizing
  const totalWidth = table
    .getVisibleLeafColumns()
    .reduce((sum, col) => sum + col.getSize(), 0)

  // Aggregated metrics
  const metrics = useMemo(() => {
    const rows = filteredRows.map((r) => r.original)
    const totalRevenue = rows.reduce((s, r) => s + r.current * r.bulk, 0)
    const avgMargin = rows.length > 0 ? rows.reduce((s, r) => s + r.marginPct, 0) / rows.length : 0
    const totalStockValue = rows.reduce((s, r) => s + r.purchase * r.totalStock, 0)
    return { totalRevenue, avgMargin, totalStockValue }
  }, [filteredRows])

  const panelAnalytics = useMemo(() => ({
    totalRows: filteredData.length,
    parsedRows: filteredData.length,
    errors: 0,
    newItems: 0,
    updatedItems: 0,
  }), [filteredData.length])

  const contextMeta = useMemo(() => ({
    totalRows: filteredData.length,
    avgMargin: metrics.avgMargin,
    dateRange: dateRange && dateRange.from && dateRange.to
      ? `${fmtDate(dateRange.from)} — ${fmtDate(dateRange.to)}`
      : "All time",
  }), [filteredData.length, metrics.avgMargin, dateRange, fmtDate])

  // --- Control panel state (must be after analyticsData / filteredData / metrics) ---
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelLogs, setPanelLogs] = useState<string[]>([])
  const [panelProgress, setPanelProgress] = useState(0)
  const [panelIsProcessing, setPanelIsProcessing] = useState(false)
  const [panelIsUploading, setPanelIsUploading] = useState(false)
  const [panelIsEnriching, setPanelIsEnriching] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)

  const invoiceList: InvoiceListItem[] = useMemo(() => {
    const supps = [...new Set(analyticsData.map((r) => r.supplier))]
    return supps.map((s, i) => {
      const rows = analyticsData.filter((r) => r.supplier === s)
      const total = rows.reduce((sum, r) => sum + r.current * r.bulk, 0)
      return {
        invoice_id: `CTX-${String(i + 1).padStart(3, "0")}`,
        supplier: s,
        total_amount_document: total,
        created_at: new Date().toISOString(),
      }
    })
  }, [analyticsData])

  const ts = useCallback(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  }, [])

  const handlePanelRefresh = useCallback(() => {
    setPanelLogs((prev) => [...prev, `[${ts()}] Refreshing analytics data...`])
    setTimeout(() => setPanelLogs((prev) => [...prev, `[${ts()}] Refresh complete.`]), 500)
  }, [ts])

  const handlePanelEnrich = useCallback(() => {
    setPanelIsEnriching(true)
    setPanelLogs((prev) => [...prev, `[${ts()}] Enriching analytics context...`])
    setTimeout(() => {
      setPanelIsEnriching(false)
      setPanelLogs((prev) => [...prev, `[${ts()}] Enrichment complete.`])
    }, 1500)
  }, [ts])

  const handlePanelExport = useCallback(() => {
    setPanelLogs((prev) => [...prev, `[${ts()}] Exporting ${filteredData.length} rows...`])
    const headers = Object.keys(filteredData[0] || {}).join(",")
    const csvRows = [headers, ...filteredData.map((r) => Object.values(r).join(","))]
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setPanelLogs((prev) => [...prev, `[${ts()}] Export complete.`])
  }, [filteredData, ts])

  const handlePanelClear = useCallback(() => {
    setPanelLogs([])
    setPanelProgress(0)
    setSelectedInvoice(null)
    resetFilters()
  }, [resetFilters])

  const handleInvoiceChange = useCallback((id: string) => {
    setIsLoadingInvoice(true)
    setSelectedInvoice(id)
    const inv = invoiceList.find((i) => i.invoice_id === id)
    if (inv?.supplier) {
      setSupplierFilter(inv.supplier)
    }
    setPanelLogs((prev) => [...prev, `[${ts()}] Loaded context: ${id}`])
    setTimeout(() => setIsLoadingInvoice(false), 300)
  }, [invoiceList, ts])

  const handleRowClick = useCallback((row: AnalyticsRow) => {
    setSelectedRow((prev) => (prev?.id === row.id ? null : row))
  }, [])

  // Close detail panel when filter hides the selected row
  useEffect(() => {
    if (selectedRow && globalFilter) {
      const lf = globalFilter.toLowerCase()
      const match = Object.values(selectedRow).some((v) => String(v).toLowerCase().includes(lf))
      if (!match) setSelectedRow(null)
    }
  }, [globalFilter, selectedRow])

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setColumnOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string)
      const newIdx = prev.indexOf(over.id as string)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }, [])

  const visibleColumnIds = useMemo(() => {
    return columnOrder.filter((id) => columnVisibility[id] !== false)
  }, [columnOrder, columnVisibility])
  const handleDeleteInvoice = async (invoiceId: string) => {
  try {
    console.log("delete invoice:", invoiceId)

    await fetch(`/api/invoice/${invoiceId}`, {
      method: "DELETE",
    })

    // можно обновить список
    // handlePanelRefresh() если есть
  } catch (e) {
    console.error("Delete failed:", e)
  }
}

  return (
    <div className={`flex h-screen overflow-hidden bg-background workspace-scaled density-${density} scale-${uiScale}`}>
      {/* Control Panel */}
      <ControlPanel
        mode="analytics"
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        logs={panelLogs}
        progress={panelProgress}
        isProcessing={panelIsProcessing}
        isUploading={panelIsUploading}
        hasData={filteredData.length > 0}
        onParseFile={() => {}}
        onUploadFile={() => {}}
        onRefresh={handlePanelRefresh}
        onEnrich={handlePanelEnrich}
        onExport={handlePanelExport}
        onClear={handlePanelClear}
        analytics={panelAnalytics}
        invoiceList={invoiceList}
        selectedInvoice={selectedInvoice}
        onInvoiceChange={handleInvoiceChange}
        isLoadingInvoice={isLoadingInvoice}
        isEnriching={panelIsEnriching}
        contextMeta={contextMeta}
        onDeleteInvoice={handleDeleteInvoice}
      />

      {/* Main content - shifts right when panel is open */}
      <div
        className={`flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          panelOpen ? "ml-[360px]" : "ml-0"
        }`}
      >
      {/* Header - single row */}
      <header className="flex shrink-0 items-center border-b border-border px-3 py-1">
        {/* Left */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setPanelOpen((prev) => !prev)}
            aria-label="Toggle control panel"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <h1 className="text-sm font-semibold text-foreground">Analytics</h1>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={loadWarehouseData}
            disabled={isDataLoading}
          >
            {isDataLoading ? "Загрузка..." : isDataLoaded ? "Обновить" : "Показать склад"}
          </Button>
          <span className="font-mono text-[11px] text-muted-foreground">{isDataLoading ? "loading..." : `${rowCount} rows`}</span>
        </div>

        {/* Center: filters */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4">
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
          <Popover
            open={dateRangeOpen}
            onOpenChange={(open) => {
              setDateRangeOpen(open)
              if (open) setPendingRange(dateRange ?? undefined)
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-[11px] font-normal">
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                {dateLabel}
                {dateRange && (
                  <span
                    role="button"
                    aria-label="Clear date range"
                    className="ml-1 rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDateRange(null)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
              <div className="flex flex-col gap-3 p-4">
                <p className="text-xs font-medium text-foreground">Select date range</p>
                <MultiLevelCalendar
                  selected={pendingRange}
                  onSelect={setPendingRange}
                  numberOfMonths={2}
                  defaultMonth={pendingRange?.from ?? new Date()}
                  maxDate={today}
                />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    {pendingRange?.from
                      ? pendingRange.to
                        ? `${fmtDate(pendingRange.from)} — ${fmtDate(pendingRange.to)}`
                        : fmtDate(pendingRange.from)
                      : "All time"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs text-muted-foreground"
                      onClick={() => {
                        setDateRange(null)
                        setPendingRange(undefined)
                        setDateRangeOpen(false)
                      }}
                    >
                      Reset to All Time
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-4 text-xs"
                      disabled={!pendingRange?.from || !pendingRange?.to}
                      onClick={() => {
                        if (pendingRange?.from && pendingRange?.to) {
                          setDateRange({ from: pendingRange.from, to: pendingRange.to })
                        }
                        setDateRangeOpen(false)
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Suppliers</SelectItem>
              {suppliers.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pricingGroupFilter} onValueChange={setPricingGroupFilter}>
            <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue placeholder="Pricing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Groups</SelectItem>
              {pricingGroups.map((g) => <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[11px] text-muted-foreground" onClick={resetFilters}>
              <X className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>

        {/* Right: aggregated metrics */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Revenue</span>
            <span className="font-mono text-[11px] font-medium text-foreground">{metrics.totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg Margin</span>
            <span className={`font-mono text-[11px] font-medium ${metrics.avgMargin > 20 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{metrics.avgMargin.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Stock Val</span>
            <span className="font-mono text-[11px] font-medium text-foreground">{metrics.totalStockValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
<Button
  variant={drawerOpen ? "secondary" : "ghost"}
  size="sm"
  className="h-7 gap-1 px-2 text-[11px]"
  onClick={() => setDrawerOpen((p) => !p)}
  >
  {drawerOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
  Charts
  </Button>
  <span className="h-4 w-px bg-border" aria-hidden="true" />
  <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 shrink-0 p-0"
      aria-label="Change theme"
    >
      {mounted && (
        theme === "light" ? (
          <Sun className="h-3.5 w-3.5" />
        ) : theme === "soft" ? (
          <Sun className="h-3.5 w-3.5 text-amber-400" />
        ) : theme === "graphite" ? (
          <Monitor className="h-3.5 w-3.5" />
        ) : theme === "warm-dark" ? (
          <Moon className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Moon className="h-3.5 w-3.5" />
        )
      )}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="min-w-[160px]">
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

    <DropdownMenuSeparator />
    
    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
      Density
    </DropdownMenuLabel>
    <DropdownMenuItem
      onClick={() => handleDensityChange("comfortable")}
      className={`gap-2 text-xs ${density === "comfortable" ? "bg-accent" : ""}`}
    >
      <Maximize2 className="h-3.5 w-3.5" />
      Comfortable
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => handleDensityChange("compact")}
      className={`gap-2 text-xs ${density === "compact" ? "bg-accent" : ""}`}
    >
      <Minimize2 className="h-3.5 w-3.5" />
      Compact
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
      UI Scale
    </DropdownMenuLabel>
    <DropdownMenuItem
      onClick={() => handleScaleChange("90")}
      className={`gap-2 text-xs ${uiScale === "90" ? "bg-accent" : ""}`}
    >
      <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono">90</span>
      90%
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => handleScaleChange("100")}
      className={`gap-2 text-xs ${uiScale === "100" ? "bg-accent" : ""}`}
    >
      <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono">100</span>
      100%
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => handleScaleChange("110")}
      className={`gap-2 text-xs ${uiScale === "110" ? "bg-accent" : ""}`}
    >
      <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono">110</span>
      110%
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
  </div>
  </header>

      {/* Filter flags + column manager row */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1">
        <div className="flex items-center gap-1.5">
          <FilterToggle label="In Stock" active={filterInStock} onClick={() => setFilterInStock((p) => !p)} />
          <FilterToggle label="Slow Moving" active={filterSlowMoving} onClick={() => setFilterSlowMoving((p) => !p)} />
          <FilterToggle label="Negative Margin" active={filterNegativeMargin} onClick={() => setFilterNegativeMargin((p) => !p)} />
          <FilterToggle label="Competitor Available" active={filterCompetitor} onClick={() => setFilterCompetitor((p) => !p)} />
          <FilterToggle label="Bulk Only" active={filterBulk} onClick={() => setFilterBulk((p) => !p)} />
        </div>
        {/* Column manager */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground">
              <Columns3 className="h-3 w-3" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-0">
            <div className="max-h-72 overflow-y-auto overscroll-contain p-2">
              <div className="flex flex-col gap-0">
                {allColumnIds.map((colId) => {
                  const isVisible = columnVisibility[colId] !== false
                  return (
                    <label
                      key={colId}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={isVisible}
                        onCheckedChange={(checked) => {
                          setColumnVisibility((prev) => ({ ...prev, [colId]: !!checked }))
                        }}
                        className="h-3.5 w-3.5"
                      />
                      {columnLabels[colId] || colId}
                    </label>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Content: table + detail panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Table */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
<div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
  <table className="border-collapse" style={{ width: totalWidth, minWidth: "100%", tableLayout: "fixed" }}>
  <thead className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
  {table.getHeaderGroups().map((headerGroup) => (
  <tr key={headerGroup.id}>
  <SortableContext items={visibleColumnIds} strategy={horizontalListSortingStrategy}>
  {headerGroup.headers.map((header) => (
  <DraggableHeaderCell key={header.id} header={header} onAutoFit={handleAutoFit} />
  ))}
  </SortableContext>
  </tr>
  ))}
  </thead>
<tbody>
  {table.getRowModel().rows?.length ? (
  table.getRowModel().rows.map((row) => {
  const isSelected = selectedRow?.id === row.original.id
  return (
<tr
  key={row.id}
  className={`h-8 cursor-pointer transition-colors ${
  isSelected
  ? "bg-primary/10 hover:bg-primary/15"
  : "bg-background hover:bg-muted/50"
  }`}
  onClick={() => handleRowClick(row.original)}
  >
  <SortableContext items={visibleColumnIds} strategy={horizontalListSortingStrategy}>
  {row.getVisibleCells().map((cell) => (
  <DraggableCell key={cell.id} cell={cell} width={cell.column.getSize()} />
  ))}
  </SortableContext>
  </tr>
  )
  })
                ) : (
  <tr>
                    <td colSpan={columns.length} className="h-32 text-center border-b border-border">
                      {isDataLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Загрузка...</span>
                        </div>
                      ) : !isDataLoaded ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-muted-foreground">Нажмите &quot;Показать склад&quot;</span>
                        </div>
                      ) : analyticsData.length === 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-muted-foreground">Нет данных</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Нет результатов по текущим фильтрам</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DndContext>

        {/* Right detail panel - resizable */}
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
            selectedRow ? "" : "w-0"
          }`}
          style={selectedRow ? { width: `${rightPanelWidth}px` } : undefined}
        >
          {selectedRow && (
            <div className="relative flex h-full w-full">
              {/* Drag handle */}
              <div
                className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize border-l border-border bg-transparent transition-colors hover:bg-primary/20 active:bg-primary/30"
                {...rightHandleProps}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize detail panel"
              />
              <PartDetailsPanel
                row={selectedRow}
                onClose={() => setSelectedRow(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom analytics drawer */}
      <div
        className={`shrink-0 border-t border-border bg-card transition-[height] duration-300 ease-in-out ${
          drawerOpen ? "" : "h-0 overflow-hidden border-t-0"
        }`}
        style={drawerOpen ? { height: `${drawerHeight}vh` } : undefined}
      >
        {/* Drag handle */}
        <div
          className="flex h-3 shrink-0 cursor-ns-resize items-center justify-center hover:bg-muted/50 active:bg-muted"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize charts panel"
        >
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40" />
        </div>
        {/* Scrollable chart content */}
        <div className="h-[calc(100%-0.75rem)] overflow-auto p-3">
          <div className="flex h-full gap-3">
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Margin Distribution</span>
              <div className="flex flex-1 items-center justify-center">
                <span className="text-[10px] text-muted-foreground/40">Chart placeholder</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Stock Coverage Histogram</span>
              <div className="flex flex-1 items-center justify-center">
                <span className="text-[10px] text-muted-foreground/40">Chart placeholder</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Supplier Comparison</span>
              <div className="flex flex-1 items-center justify-center">
                <span className="text-[10px] text-muted-foreground/40">Chart placeholder</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
