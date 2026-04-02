"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Trash2, RotateCcw, Save, Play, Loader2, Truck, Check, Link2, Plane, Ship, Anchor, ChevronDown, ChevronUp, X, Sparkles, FileText } from "lucide-react"

// Helper to get transport type icon
function getTransportIcon(type: string | null, isSelected: boolean) {
  const className = `h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`
  const t = type?.toLowerCase()

  if (t === "air") return <Plane className={className} />
  if (t === "sea") return <Ship className={className} />
  if (t === "river") return <Anchor className={className} />
  if (t === "road" || t === "winter road") return <Truck className={className} />

  return <Truck className={className} />
}
import { toast } from "sonner"
import type { InvoiceRow } from "@/lib/mock-data"

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PricingRule {
  id: string
  fromPrice: string
  toPrice: string
  markupPct: string
  pricingGroup: string
}

const DEFAULT_RULES: PricingRule[] = [
  { id: "1", fromPrice: "0", toPrice: "10", markupPct: "45", pricingGroup: "Standard" },
  { id: "2", fromPrice: "10", toPrice: "50", markupPct: "35", pricingGroup: "Standard" },
  { id: "3", fromPrice: "50", toPrice: "200", markupPct: "25", pricingGroup: "Standard" },
  { id: "4", fromPrice: "200", toPrice: "1000", markupPct: "18", pricingGroup: "Premium" },
]

// ─── Recalculation engine ────────────────────────────────────────────────────
export function applyPricingRules(
  rows: InvoiceRow[],
  rules: PricingRule[]
): InvoiceRow[] {
  return rows.map((row) => {
    const cost = row.cost
    // Find matching rule by cost range
    const rule = rules.find((r) => {
      const from = parseFloat(r.fromPrice) || 0
      const to = parseFloat(r.toPrice) || Infinity
      return cost >= from && cost < to
    })
    if (!rule) return row
    const pct = parseFloat(rule.markupPct) || 0
    const newNow = Math.round(cost * (1 + pct / 100) * 100) / 100
    // Recalculate ship and deltaPercent based on new now
    const newShip = row.ship === 0 ? 0 : Math.round(newNow * (1 + 0.055) * 100) / 100 // ~5.5% over now
    const newDelta =
      row.ship === 0 ? -100 : newShip > 0 && newNow > 0
        ? Math.round(((newShip - newNow) / newNow) * 1000) / 10
        : 0
    return { ...row, now: newNow, ship: newShip, deltaPercent: newDelta }
  })
}

function rulesEqual(a: PricingRule[], b: PricingRule[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (r, i) =>
      r.fromPrice === b[i].fromPrice &&
      r.toPrice === b[i].toPrice &&
      r.markupPct === b[i].markupPct &&
      r.pricingGroup === b[i].pricingGroup
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
interface SimulationPanelProps {
  data: InvoiceRow[]
  invoiceIds: string[]
  onApplyScenario: (rows: InvoiceRow[]) => void
  onResetScenario: () => void
  isScenarioActive: boolean
  onSetSelectedInvoices?: (ids: string[]) => void
  onEnrich?: () => void
  onEnrichSelected?: (ids: string[]) => void
  isEnriching?: boolean
  selectedInvoice?: string | null
  onUpdateMoot?: (updates: Map<string | number, number>) => void
  onClearMoot?: () => void
  onUpdateShip?: (updates: Map<string | number, number>) => void
}

// ─── Column Resize Handle Component ───
interface ResizeHandleProps {
  onResize: (delta: number) => void
  onAutoFit: () => void
}

function ResizeHandle({ onResize, onAutoFit }: ResizeHandleProps) {
  const startXRef = useRef(0)
  const currentWidthRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX
    currentWidthRef.current = 0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const totalDelta = moveEvent.clientX - startXRef.current
      const incrementalDelta = totalDelta - currentWidthRef.current
      currentWidthRef.current = totalDelta
      onResize(incrementalDelta)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAutoFit()
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
      style={{ marginRight: "-2px" }}
    />
  )
}

// ─── Grid Panel Component with Resize + Collapse ───
interface GridPanelProps {
  id: string
  title: string
  colStart: number
  colSpan: number
  maxColSpan: number
  collapsed: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  headerExtra?: React.ReactNode
  onResize: (deltaCols: number) => void
  onToggleCollapse: () => void
  onRemove?: () => void
  canRemove?: boolean
}

function GridPanel({
  id, title, colStart, colSpan, maxColSpan, collapsed, icon, children, headerExtra,
  onResize, onToggleCollapse, onRemove, canRemove
}: GridPanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const resizeStartRef = useRef(0)
  const initialColSpanRef = useRef(colSpan)
  const COLUMN_WIDTH = 80 // Approximate width per grid column

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = e.clientX
    initialColSpanRef.current = colSpan

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - resizeStartRef.current
      const deltaCols = Math.round(deltaX / COLUMN_WIDTH)
      // Clamp to min 2, max allowed (based on available space)
      const newColSpan = Math.max(2, Math.min(maxColSpan, initialColSpanRef.current + deltaCols))
      if (newColSpan !== colSpan) {
        onResize(newColSpan - colSpan)
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  // Use explicit grid-column positioning: start / span N
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : 1,
    gridColumn: `${colStart} / span ${colSpan}`,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-card border border-border rounded-xl flex flex-col ${collapsed ? "h-[44px]" : "min-h-[200px] max-h-[calc(100vh-200px)]"
        } ${isDragging ? "shadow-xl ring-2 ring-primary/30" : ""}`}
    >
      {/* Draggable Header */}
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 flex items-center justify-between border-b border-border px-3 py-2.5 cursor-grab active:cursor-grabbing select-none hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/50">
            {colSpan}col
          </span>
        </div>
        <div className="flex items-center gap-1">
          {headerExtra}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="p-1 hover:bg-muted rounded transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          {canRemove && onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 hover:bg-destructive/20 rounded transition-colors"
              title="Remove panel"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content (hidden when collapsed) */}
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      )}

      {/* Resize Handle on Right Edge */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors rounded-r-xl"
        style={{ marginRight: "-3px" }}
      />
    </div>
  )
}

// ─── Panel Config Interface (12-Column Grid with Explicit Positioning) ───
interface PanelConfig {
  id: string
  type: "shipments" | "metrics" | "actions" | "invoices" | "empty"
  colSpan: number
  collapsed: boolean
}

// Helper to calculate colStart for each panel based on order
function calculatePanelPositions(panels: PanelConfig[]): Map<string, number> {
  const positions = new Map<string, number>()
  let currentCol = 1
  for (const panel of panels) {
    positions.set(panel.id, currentCol)
    currentCol += panel.colSpan
  }
  return positions
}

// ─── Metric Widget Interface ───
interface MetricWidget {
  id: string
  label: string
  value: string | number
  highlight?: boolean
  color?: string
}

// ─── Sortable Metric Block Component ───
function SortableMetricBlock({ id, label, value, highlight, color }: MetricWidget) {
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
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex flex-col gap-0.5 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing
        bg-muted/40 hover:bg-muted/60 border border-border/50
        transition-colors select-none
        ${isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}
        ${highlight ? "bg-primary/10 border-primary/30" : ""}
      `}
    >
      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-medium">
        {label}
      </span>
      <span className={`font-mono text-[13px] font-semibold ${color || "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

export function SimulationPanel({
  data,
  invoiceIds,
  onApplyScenario,
  onResetScenario,
  isScenarioActive,
  onSetSelectedInvoices,
  onEnrich,
  onEnrichSelected,
  isEnriching = false,
  selectedInvoice,
  onUpdateMoot,
  onClearMoot,
  onUpdateShip,
}: SimulationPanelProps) {

  const [activeTab, setActiveTab] = useState("shipping")
  const [mode, setMode] = useState<"normal" | "hybrid">("hybrid")
  const [normalPrice, setNormalPrice] = useState("115")

  // ─── Draggable Metrics Widget Order ───
  const defaultMetricOrder = [
    "totalCost", "costPerKg", "weightRaw", "catalogWt", "bulkyPriceKg",
    "packages", "volume", "density", "bulkyWt", "normalShip", "bulkyShip",
    "costPerKgRaw", "goodsPerKg", "manager",
    "test1", "test2", "test3", "test4"
  ]
  const [metricOrder, setMetricOrder] = useState<string[]>(defaultMetricOrder)

  // ─── 12-Column Grid Panel System for Pricing Manager ───
  const defaultPanels: PanelConfig[] = [
    { id: "shipments", type: "shipments", colSpan: 3, collapsed: false },
    { id: "metrics", type: "metrics", colSpan: 4, collapsed: false },
    { id: "actions", type: "actions", colSpan: 2, collapsed: false },
    { id: "invoices", type: "invoices", colSpan: 2, collapsed: false },
    { id: "empty-1", type: "empty", colSpan: 1, collapsed: false },
  ]

  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pricing_manager_layout_v2")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
          }
        } catch { }
      }
    }
    return defaultPanels
  })

  // Persist panel layout
  useEffect(() => {
    localStorage.setItem("pricing_manager_layout_v2", JSON.stringify(panels))
  }, [panels])

  // Panel drag handler (reorder)
  const handlePanelDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPanels((items) => {
        const oldIndex = items.findIndex(p => p.id === active.id)
        const newIndex = items.findIndex(p => p.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  // Panel resize handler (snap to grid columns, respect 12-col limit)
  const handlePanelResize = useCallback((panelId: string, newColSpan: number) => {
    setPanels((items) => {
      // Calculate total columns used by OTHER panels
      const otherPanelsTotal = items.reduce((sum, p) =>
        p.id === panelId ? sum : sum + p.colSpan, 0
      )
      // Max this panel can be is 12 - others, min is 2
      const maxAllowed = Math.max(2, 12 - otherPanelsTotal)
      const clampedSpan = Math.max(2, Math.min(maxAllowed, newColSpan))

      return items.map(p =>
        p.id === panelId ? { ...p, colSpan: clampedSpan } : p
      )
    })
  }, [])

  // Toggle panel collapse
  const togglePanelCollapse = useCallback((panelId: string) => {
    setPanels((items) => items.map(p =>
      p.id === panelId ? { ...p, collapsed: !p.collapsed } : p
    ))
  }, [])

  // Add new empty panel
  const addEmptyPanel = useCallback(() => {
    const newId = `empty-${Date.now()}`
    setPanels((items) => [...items, { id: newId, type: "empty", colSpan: 2, collapsed: false }])
  }, [])

  // Remove panel (only empty panels can be removed)
  const removePanel = useCallback((panelId: string) => {
    setPanels((items) => items.filter(p => p.id !== panelId))
  }, [])

  // Panel IDs for sortable context
  const panelIds = useMemo(() => panels.map(p => p.id), [panels])

  // Calculate panel positions (colStart for each panel)
  const panelPositions = useMemo(() => calculatePanelPositions(panels), [panels])

  // Calculate max colSpan for each panel (remaining space + current)
  const panelMaxColSpans = useMemo(() => {
    const maxSpans = new Map<string, number>()
    const totalUsed = panels.reduce((sum, p) => sum + p.colSpan, 0)
    const freeSpace = 12 - totalUsed

    for (const panel of panels) {
      // This panel can expand into free space
      maxSpans.set(panel.id, panel.colSpan + freeSpace)
    }
    return maxSpans
  }, [panels])

  // ─── DnD Sensors ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleMetricDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setMetricOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])
  const weightStats = useMemo(() => {
    let totalWeight = 0
    let missingWeight = false

    data.forEach((row) => {
      const weight = Number(row.weight ?? 0)
      const qty = Number(row.qty ?? 0)

      if (!weight) {
        missingWeight = true
        return
      }

      totalWeight += weight * qty
    })

    return {
      totalWeight,
      missingWeight,
    }
  }, [data])


  // Default vs Scenario pricing rules
  const [defaultRules, setDefaultRules] = useState<PricingRule[]>([])
  const [scenarioRules, setScenarioRules] = useState<PricingRule[]>([])

  // Confirmation dialog for save
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  // Shipping state
  const [costPerKgNormal, setCostPerKgNormal] = useState("8.50")
  const [costPerKgBulky, setCostPerKgBulky] = useState("12.00")
  const [totalDeliveryCost, setTotalDeliveryCost] = useState("450.00")
  const [distributionMethod, setDistributionMethod] = useState("weight")

  // ─── Resizable Column Widths for Shipments List ───
  const SHIPMENT_COL_MINS = { company: 100, number: 50, date: 80, type: 70 }
  const SHIPMENT_COL_MAX_COMPANY = 280
  const [shipmentColWidths, setShipmentColWidths] = useState(() => {
    // Try to load from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shipments_column_widths")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch { }
      }
    }
    return { company: 160, number: 60, date: 100, type: 80 }
  })

  // Persist widths to localStorage
  useEffect(() => {
    localStorage.setItem("shipments_column_widths", JSON.stringify(shipmentColWidths))
  }, [shipmentColWidths])

  // Refs for measuring content width
  const shipmentListRef = useRef<HTMLDivElement>(null)

  // Column resize handler
  const handleColumnResize = useCallback((col: keyof typeof shipmentColWidths, delta: number) => {
    setShipmentColWidths((prev: typeof shipmentColWidths) => {
      const newWidth = Math.max(SHIPMENT_COL_MINS[col], prev[col] + delta)
      // Apply max for company column
      const clampedWidth = col === "company" ? Math.min(newWidth, SHIPMENT_COL_MAX_COMPANY) : newWidth
      return { ...prev, [col]: clampedWidth }
    })
  }, [])

  // AutoFit column to content
  const handleAutoFitColumn = useCallback((col: keyof typeof shipmentColWidths) => {
    if (!shipmentListRef.current) return

    // Find all cells for this column
    const cells = shipmentListRef.current.querySelectorAll(`[data-col="${col}"]`)
    let maxWidth = 0

    cells.forEach((cell) => {
      // Create a temporary span to measure text width
      const span = document.createElement("span")
      span.style.visibility = "hidden"
      span.style.position = "absolute"
      span.style.whiteSpace = "nowrap"
      span.style.font = window.getComputedStyle(cell).font
      span.textContent = cell.textContent
      document.body.appendChild(span)
      maxWidth = Math.max(maxWidth, span.offsetWidth)
      document.body.removeChild(span)
    })

    // Add padding (20px) and clamp
    const finalWidth = Math.max(SHIPMENT_COL_MINS[col], maxWidth + 20)
    const clampedWidth = col === "company" ? Math.min(finalWidth, SHIPMENT_COL_MAX_COMPANY) : finalWidth

    setShipmentColWidths((prev: typeof shipmentColWidths) => ({ ...prev, [col]: clampedWidth }))
  }, [])

  // Grid template for shipments - 4 columns with fixed widths, left-aligned
  // Equal spacing between columns via gap-3
  // Widths: Company(1fr) | #(45px) | Date(80px) | Type(50px)
  const shipmentGridTemplate = `1fr 45px 80px 50px`

  // -------------------- Shipping form types --------------------

  type ShippingForm = {
    company: string
    type: string
    invoiceNumber: string
    reference: string
    transportDate: string
    receivedDate: string
    totalCost: string
    packages: string
    weight: string
    volume: string
    density: string
    goodsTotalValue: string
    goodsValuePerKg: string
    comment: string
    manager: string
    warehouse: string
  }

  const EMPTY_SHIPPING: ShippingForm = {
    company: "",
    type: "",
    invoiceNumber: "",
    reference: "",
    transportDate: "",
    receivedDate: "",
    totalCost: "",
    packages: "",
    weight: "",
    volume: "",
    density: "",
    goodsTotalValue: "",
    goodsValuePerKg: "",
    comment: "",
    manager: "",
    warehouse: "",
  }

  // -------------------- Shipping UI state --------------------

  const [shippingForm, setShippingForm] = useState<ShippingForm>(EMPTY_SHIPPING)
  const [savedShipping, setSavedShipping] = useState<ShippingForm | null>(null)

  // -------------------- Shipment management state --------------------
  type ShipmentListItem = {
    shipment_id: string
    transport_company: string | null
    transport_invoice_number: string | null
    transport_date: string | null
    transport_type: string | null
    invoice_count?: number
  }

  type ShipmentInvoice = {
    invoice_id: string
    supplier: string | null
    date: string | null
    amount: number | null
  }

  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [isLoadingShipments, setIsLoadingShipments] = useState(false)
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
  const [shipmentInvoices, setShipmentInvoices] = useState<ShipmentInvoice[]>([])

  // Pricing Manager: selected invoice and its items
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<any[]>([])
  const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = useState(false)

  // MOOT Calculation state
  const [isCalculatingMoot, setIsCalculatingMoot] = useState(false)
  const [mootResults, setMootResults] = useState<{
    calculated: number
    skipped: number
    skippedReasons: { noWeight: number; noPrice: number; noRule: number }
  } | null>(null)
  const [mootPrices, setMootPrices] = useState<Map<string | number, number>>(new Map())



  const [isLoadingShipmentInvoices, setIsLoadingShipmentInvoices] = useState(false)

  // ─── Helper: Find markup from pricing rules based on cost and group ───
  const getMarkupFromRules = (cost: number, group: string): { markup: number; rule: PricingRule | null } => {
    // Map row.productGroup to pricing_group in rules
    // "parts" → "Запчасти", "fluids" → "Масло"
    let pricingGroup = "Запчасти" // default
    if (group === "fluids" || group === "oil" || group === "Масло") {
      pricingGroup = "Масло"
    } else if (group === "parts" || group === "Запчасти") {
      pricingGroup = "Запчасти"
    }

    // Find matching rule by pricing_group and cost range
    const matchedRule = scenarioRules.find((rule) => {
      const fromPrice = parseFloat(rule.fromPrice) || 0
      const toPrice = parseFloat(rule.toPrice) || Infinity
      const ruleGroup = rule.pricingGroup

      // Check if group matches and cost is within range [from, to)
      return ruleGroup === pricingGroup && cost >= fromPrice && cost < toPrice
    })

    if (!matchedRule) {
      return { markup: -1, rule: null } // -1 indicates no rule found
    }

    // Convert markup_pct to decimal (e.g., 105 → 1.05)
    const markupPct = parseFloat(matchedRule.markupPct) || 0
    const markup = markupPct / 100

    return { markup, rule: matchedRule }
  }

  // ─── MOOT Calculation Function (uses data prop - same source as main table) ───
  const calculateMoot = (costPerKgValue: number, bulkyPriceValue: number) => {
    // Validate data exists
    if (!data || data.length === 0) {
      toast.error("Нет данных для расчёта")
      setMootResults({ calculated: 0, skipped: 0, skippedReasons: { noWeight: 0, noPrice: 0, noRule: 0 } })
      return
    }

    // Validate pricing exists
    if (costPerKgValue <= 0) {
      toast.error("Ошибка: нет ₽/kg")
      setMootResults({ calculated: 0, skipped: data.length, skippedReasons: { noWeight: 0, noPrice: 0, noRule: 0 } })
      return
    }

    setIsCalculatingMoot(true)

    let calculated = 0
    let skippedNoWeight = 0
    let skippedNoPrice = 0
    let skippedNoRule = 0
    const newMootPrices = new Map<string | number, number>()
    const newShipValues = new Map<string | number, number>()

    data.forEach((item) => {
      const itemId = item.id || item.sku || item.article
      const weight = Number(item.weight ?? 0)
      // Use 'cost' field (actual purchase price in data)
      const cost = Number(item.cost ?? item.price ?? item.purchase_price ?? 0)
      const isBulky = item.isBulky || item.is_bulky || item.bulky || false
      const group = item.productGroup || item.group || "parts"

      // Calculate delivery cost per unit (Ship value)
      const pricePerKg = isBulky ? bulkyPriceValue : costPerKgValue
      const delivery = weight * pricePerKg
      const ship = Math.round(delivery * 100) / 100 // Round to 2 decimals

      // Always store Ship value if weight > 0
      if (weight > 0) {
        newShipValues.set(itemId, ship)
      }

      // Validation: skip MOOT if no weight
      if (weight <= 0) {
        skippedNoWeight++
        return
      }

      // Validation: skip MOOT if no cost (purchase price)
      if (cost <= 0) {
        skippedNoPrice++
        return
      }

      // Get markup from pricing rules based on cost and group
      const { markup, rule } = getMarkupFromRules(cost, group)

      // Debug logging for first few items
      if (calculated < 3) {
        console.log("[v0] MOOT calc:", {
          cost,
          group,
          matchedRule: rule,
          markupPct: rule?.markupPct,
          markup,
          delivery,
          formula: `${cost} * (1 + ${markup}) + ${delivery.toFixed(2)}`
        })
      }

      // Skip if no matching rule found
      if (markup < 0 || !rule) {
        console.warn(`[v0] No pricing rule for cost=${cost}, group=${group}`)
        skippedNoRule++
        return
      }

      // Final MOOT price = cost * (1 + markup) + delivery
      // markup is from pricing_rules (e.g., 105 → 1.05)
      const finalPrice = cost * (1 + markup) + delivery

      newMootPrices.set(itemId, Math.round(finalPrice))
      calculated++
    })

    setMootPrices(newMootPrices)
    setMootResults({
      calculated,
      skipped: skippedNoWeight + skippedNoPrice + skippedNoRule,
      skippedReasons: { noWeight: skippedNoWeight, noPrice: skippedNoPrice, noRule: skippedNoRule }
    })

    // Update Ship values in parent (writes to "ship" column)
    if (onUpdateShip && newShipValues.size > 0) {
      onUpdateShip(newShipValues)
    }

    // Update MOOT values in parent (writes to "moot" column)
    if (onUpdateMoot && newMootPrices.size > 0) {
      onUpdateMoot(newMootPrices)
    }

    // Brief delay to show loading state, then show toast
    setTimeout(() => {
      setIsCalculatingMoot(false)
      if (calculated > 0) {
        toast.success(`Готово: ${calculated} строк обработано`)
      } else if (skippedNoWeight + skippedNoPrice > 0) {
        toast.warning(`Пропущено: ${skippedNoWeight + skippedNoPrice} строк`)
      }
    }, 400)
  }

  const [shipmentFilter, setShipmentFilter] = useState<"all" | "unlinked" | "recent">("all")
  const [isAttaching, setIsAttaching] = useState(false)
  const [isCreatingShipment, setIsCreatingShipment] = useState(false)
  const [shipmentSearch, setShipmentSearch] = useState("")

  // Filter shipments by search query
  const filteredShipments = useMemo(() => {
    if (!shipmentSearch.trim()) return shipments
    const q = shipmentSearch.toLowerCase()
    return shipments.filter(s =>
      s.transport_company?.toLowerCase().includes(q) ||
      s.transport_invoice_number?.toString().toLowerCase().includes(q) ||
      s.transport_type?.toLowerCase().includes(q)
    )
  }, [shipments, shipmentSearch])

  // Load shipments when shipping tab is active
  const loadShipments = useCallback(async (filter: "all" | "unlinked" | "recent" = "all") => {
    setIsLoadingShipments(true)
    try {
      const res = await fetch(`/api/shipment/list?filter=${filter}`)
      if (res.ok) {
        const data = await res.json()
        setShipments(data)
      }
    } catch (e) {
      console.error("Failed to load shipments:", e)
    } finally {
      setIsLoadingShipments(false)
    }
  }, [])

  // Load shipments on tab change or filter change (for both Shipping Model and Pricing Manager)
  useEffect(() => {
    if (activeTab === "shipping" || activeTab === "pricing-manager") {
      loadShipments(shipmentFilter)
    }
  }, [activeTab, shipmentFilter, loadShipments])

  // Load shipment details when selected
  useEffect(() => {
    if (!selectedShipmentId) {
      setShipmentInvoices([])
      return
    }

    const loadShipmentData = async () => {
      setIsLoadingShipmentInvoices(true)
      try {
        // Load shipment details
        const detailsRes = await fetch(`/api/shipment/${selectedShipmentId}`)
        if (detailsRes.ok) {
          const details = await detailsRes.json()
          // Fill form with shipment data
          setShippingForm({
            company: details.transport_company || "",
            type: details.transport_type || "",
            invoiceNumber: details.transport_invoice_number || "",
            reference: "",
            transportDate: details.transport_date || "",
            receivedDate: details.received_date || "",
            totalCost: String(details.total_shipping_cost || ""),
            packages: String(details.packages_count || ""),
            weight: String(details.total_weight || ""),
            volume: String(details.total_volume || ""),
            density: String(details.density || ""),
            goodsTotalValue: String(details.goods_total_value || ""),
            goodsValuePerKg: String(details.goods_value_per_kg || ""),
            comment: details.comment || "",
            manager: "",
            warehouse: "",
          })
        }

        // Load linked invoices
        const invoicesRes = await fetch(`/api/shipment/${selectedShipmentId}/invoices`)

        if (invoicesRes.ok) {
          const rawData = await invoicesRes.json()
          const invoices = Array.isArray(rawData) ? rawData : []

          setShipmentInvoices(invoices)

          // Update selected invoices in parent
          if (onSetSelectedInvoices && invoices.length > 0) {
            onSetSelectedInvoices(invoices.map((inv: ShipmentInvoice) => inv.invoice_id))
          }
        } else {
          setShipmentInvoices([])
        }
      } catch (e) {
        console.error("Failed to load shipment data:", e)
      } finally {
        setIsLoadingShipmentInvoices(false)
      }
    }

    loadShipmentData()
  }, [selectedShipmentId, onSetSelectedInvoices])

  // Auto-select invoice if only one exists
  useEffect(() => {
    if (shipmentInvoices.length === 1 && !selectedInvoiceId) {
      setSelectedInvoiceId(shipmentInvoices[0].invoice_id)
    }
    // Clear selection when shipment changes
    if (shipmentInvoices.length === 0) {
      setSelectedInvoiceId(null)
      setInvoiceItems([])
    }
  }, [shipmentInvoices, selectedInvoiceId])

  // Load invoice items when invoice is selected
  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceItems([])
      setMootResults(null)
      setMootPrices(new Map())
      return
    }

    // Clear results when invoice changes
    setMootResults(null)
    setMootPrices(new Map())

    const loadInvoiceItems = async () => {
      setIsLoadingInvoiceItems(true)
      try {
        const res = await fetch(`/api/invoice-items?invoiceId=${selectedInvoiceId}`)
        if (res.ok) {
          const data = await res.json()
          setInvoiceItems(Array.isArray(data) ? data : [])
        } else {
          setInvoiceItems([])
        }
      } catch (e) {
        console.error("Failed to load invoice items:", e)
        setInvoiceItems([])
      } finally {
        setIsLoadingInvoiceItems(false)
      }
    }

    loadInvoiceItems()
  }, [selectedInvoiceId])

  // Attach invoices to shipment
  const handleAttachInvoices = useCallback(async () => {
    if (!selectedShipmentId || !invoiceIds.length) return

    setIsAttaching(true)
    const toastId = toast.loading("Attaching invoices...")

    try {
      const res = await fetch("/api/shipment/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_id: selectedShipmentId,
          invoice_ids: invoiceIds,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to attach invoices", { id: toastId })
        return
      }

      toast.success(`${invoiceIds.length} invoice(s) attached`, { id: toastId })

      // Reload shipment invoices
      const invoicesRes = await fetch(`/api/shipment/${selectedShipmentId}/invoices`)
      if (invoicesRes.ok) {
        const rawData = await invoicesRes.json()
        const invoices = Array.isArray(rawData) ? rawData : []
        setShipmentInvoices(invoices)
      }
    } catch {
      toast.error("Failed to attach invoices", { id: toastId })
    } finally {
      setIsAttaching(false)
    }
  }, [selectedShipmentId, invoiceIds])

  // Clear form for new shipment entry
  const handleNewShipment = useCallback(() => {
    setSelectedShipmentId(null)
    setShippingForm(EMPTY_SHIPPING)
    setShipmentInvoices([])
  }, [])

  // -------------------- Invoice vs Goods check --------------------

  const invoiceTotal = data.reduce(
    (sum, row) => sum + Number(row.cost || 0) * Number(row.qty || 0),
    0
  )

  const goodsTotal = Number(shippingForm.goodsTotalValue || 0)

  const isMismatch =
    Math.abs(invoiceTotal - goodsTotal) > 0.01

  const normalCargoPrice = Number(normalPrice) || 0

  const model = useMemo(() => {
    let normalWeight = 0
    let bulkyWeight = 0
    let missingWeight = false

    const totalCost = Number(shippingForm.totalCost) || 0

    data.forEach((row) => {
      const weight = Number(row.weight ?? 0)
      const qty = Number(row.qty ?? 0)

      if (!weight) {
        missingWeight = true
        return
      }

      // In Normal mode, treat ALL items as normal (no bulky separation)
      if (mode === "normal") {
        normalWeight += weight * qty
      } else {
        // Hybrid mode: separate bulky and normal
        if (row.isBulky) {
          bulkyWeight += weight * qty
        } else {
          normalWeight += weight * qty
        }
      }
    })

    // Normal mode: all shipping goes to normal, no bulky calculations
    if (mode === "normal") {
      return {
        normalWeight,
        bulkyWeight: 0,
        normalShipping: totalCost, // All cost is normal shipping
        bulkyShipping: 0,
        bulkyPrice: 0,
        missingWeight,
      }
    }

    // Hybrid mode: calculate bulky separately
    const normalShipping = normalWeight * normalCargoPrice
    const bulkyShipping = Math.max(0, totalCost - normalShipping) // Prevent negative

    const bulkyPrice =
      bulkyWeight > 0
        ? Math.max(0, bulkyShipping / bulkyWeight) // Prevent negative
        : 0

    return {
      normalWeight,
      bulkyWeight,
      normalShipping,
      bulkyShipping,
      bulkyPrice,
      missingWeight,
    }
  }, [data, shippingForm.totalCost, normalCargoPrice, mode])

  const hasBulky = model.bulkyWeight > 0

  const [isSavingShipping, setIsSavingShipping] = useState(false)
  const [isLoadingShipping, setIsLoadingShipping] = useState(false)

  // -------------------- Validation --------------------

  const requiredFields: (keyof ShippingForm)[] = [
    "company",
    "type",
    "invoiceNumber",
    "transportDate",
    "receivedDate",
    "totalCost",
    "packages",
    "weight",
    "volume",
    "density",
    "goodsTotalValue",
  ]

  const validationErrors = useMemo(() => {
    return requiredFields
      .filter((key) => {
        const value = shippingForm[key]

        if (value === null || value === undefined) return true

        if (typeof value === "string") return value.trim() === ""

        return false
      })
      .map((key) => `${key} is required`)
  }, [shippingForm])

  const isFormValid = validationErrors.length === 0

  // Create shipment WITHOUT attaching invoices (defined after model)
  const handleCreateShipment = useCallback(async () => {
    if (!isFormValid) return

    setIsCreatingShipment(true)
    const toastId = toast.loading("Creating shipment...")

    try {
      const res = await fetch("/api/shipment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transport_company: shippingForm.company ?? null,
          transport_type: shippingForm.type ?? null,
          transport_invoice_number: shippingForm.invoiceNumber ?? null,
          transport_date: shippingForm.transportDate ?? null,
          received_date: shippingForm.receivedDate ?? null,
          total_shipping_cost: Number(shippingForm.totalCost || 0),
          total_weight: Number(shippingForm.weight || 0),
          total_volume: Number(shippingForm.volume || 0),
          density: Number(shippingForm.density || 0),
          packages_count: Number(shippingForm.packages || 0),
          comment: shippingForm.comment ?? null,
          goods_total_value: Number(shippingForm.goodsTotalValue || 0),
          goods_value_per_kg: shippingForm.goodsValuePerKg === "" ? null : Number(shippingForm.goodsValuePerKg),
          pricing_mode: mode, // "normal" or "hybrid"
          normal_weight: Number(model.normalWeight || 0),
          bulky_weight: mode === "normal" ? 0 : Number(model.bulkyWeight || 0),
          normal_shipping: Number(model.normalShipping || 0),
          bulky_shipping: mode === "normal" ? 0 : Number(model.bulkyShipping || 0),
          catalog_weight: Number(weightStats.totalWeight || 0),
          bulky_price: mode === "normal" ? 0 : Number(model.bulkyPrice || 0),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Failed to create shipment", { id: toastId })
        return
      }

      toast.success("Shipment created (no invoices attached)", { id: toastId })

      // Reload shipment list and switch to ALL tab
      setShipmentFilter("all")
      await loadShipments("all")

      // Select the newly created shipment
      if (json.shipment?.shipment_id) {
        setSelectedShipmentId(json.shipment.shipment_id)
      }

    } catch {
      toast.error("Failed to create shipment", { id: toastId })
    } finally {
      setIsCreatingShipment(false)
    }
  }, [isFormValid, shippingForm, model, weightStats, loadShipments])

  const isShippingModified = useMemo(() => {
    if (!savedShipping) {
      return Object.values(shippingForm).some(
        (v) => String(v ?? "").trim() !== ""
      )
    }

    return JSON.stringify(shippingForm) !== JSON.stringify(savedShipping)
  }, [shippingForm, savedShipping])
  // -------------------- Load shipping --------------------
  useEffect(() => {
    let cancelled = false

    async function loadPricingRules() {
      try {
        const res = await fetch("/api/pricing-rules")

        if (!res.ok) {
          throw new Error("Failed to load pricing rules")
        }

        const data = await res.json()

        const formatted: PricingRule[] = data.map((r: any) => ({
          id: r.id,
          fromPrice: String(r.from_price),
          toPrice: String(r.to_price),
          markupPct: String(r.markup_pct),
          // Map Supabase pricing_group to UI format
          pricingGroup: r.pricing_group === "parts"
            ? "Запчасти"
            : r.pricing_group === "fluids"
              ? "Масло"
              : r.pricing_group,
        }))

        console.log("[v0] Loaded pricing rules:", formatted)

        if (!cancelled) {
          setDefaultRules(formatted)
          setScenarioRules(formatted)
        }
      } catch (err) {
        console.error("Pricing rules load error:", err)
      }
    }

    loadPricingRules()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!invoiceIds.length) return

    let cancelled = false

    const load = async () => {
      setIsLoadingShipping(true)

      try {
        const res = await fetch(`/api/invoice/${invoiceIds[0]}/shipping`)

        if (!res.ok) return

        const json = await res.json()

        const s = json?.shipping ?? null

        if (cancelled) return

        if (s) {
          setShippingForm(s)
          setSavedShipping(s)
        } else {
          setShippingForm(EMPTY_SHIPPING)
          setSavedShipping(null)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoadingShipping(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [invoiceIds])

  // -------------------- Reset --------------------
  const isModified = useMemo(
    () => !rulesEqual(scenarioRules, defaultRules),
    [scenarioRules, defaultRules]
  )

  const handleResetShipping = useCallback(() => {
    setShippingForm(savedShipping ?? EMPTY_SHIPPING)
  }, [savedShipping])

  // -------------------- Save --------------------

  const handleSaveShipping = useCallback(async () => {
    // Normalize invoiceIds to always be an array of strings
    const normalizedInvoiceIds = Array.isArray(invoiceIds)
      ? invoiceIds.map(i => typeof i === "string" ? i : (i as any).invoice_id)
      : []

    // Block submit if no invoices selected
    if (normalizedInvoiceIds.length === 0) {
      toast.error("No invoices selected")
      return
    }

    if (!isFormValid) return

    const toastId = toast.loading("Saving shipment...")

    const prevSaved = savedShipping
    setSavedShipping(shippingForm)

    setIsSavingShipping(true)

    try {
      const res = await fetch("/api/shipment/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceIds: normalizedInvoiceIds,
          shippingData: {
            transport_company: shippingForm.company ?? null,
            transport_type: shippingForm.type ?? null,
            transport_invoice_number: shippingForm.invoiceNumber ?? null,
            transport_date: shippingForm.transportDate ?? null,
            received_date: shippingForm.receivedDate ?? null,
            total_shipping_cost: Number(shippingForm.totalCost || 0),
            total_weight: Number(shippingForm.weight || 0),
            total_volume: Number(shippingForm.volume || 0),
            density: Number(shippingForm.density || 0),
            packages_count: Number(shippingForm.packages || 0),
            comment: shippingForm.comment ?? null,
            goods_total_value: Number(shippingForm.goodsTotalValue || 0),
            goods_value_per_kg: shippingForm.goodsValuePerKg === "" ? null : Number(shippingForm.goodsValuePerKg),
            pricing_mode: mode, // "normal" or "hybrid"
            normal_weight: Number(model.normalWeight || 0),
            bulky_weight: mode === "normal" ? 0 : Number(model.bulkyWeight || 0),
            normal_shipping: Number(model.normalShipping || 0),
            bulky_shipping: mode === "normal" ? 0 : Number(model.bulkyShipping || 0),
            catalog_weight: Number(weightStats.totalWeight || 0),
            bulky_price: Number(model.bulkyPrice || 0),
          },
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Failed to save shipment", { id: toastId })
        throw new Error(json?.error || "Failed to save shipment")
      }

      toast.success(`Shipment saved for ${normalizedInvoiceIds.length} invoice(s)`, { id: toastId })

    } catch {
      toast.error("Error saving shipment", { id: toastId })

      // откат если ошибка
      setSavedShipping(prevSaved)
    } finally {
      setIsSavingShipping(false)
    }
  }, [
    invoiceIds,
    isFormValid,
    savedShipping,
    shippingForm,
    isShippingModified,
    model,
    weightStats,
  ])
  // ─── Pricing rules actions & calculations ──────────────────────────────────

  // добавить н��вое правило
  const addRule = useCallback(() => {
    setScenarioRules((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        fromPrice: "",
        toPrice: "",
        markupPct: "",
        pricingGroup: "Standard",
      },
    ])
  }, [])

  // удалить правило
  const removeRule = useCallback((id: string) => {
    setScenarioRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // обновить поле правила
  const updateRule = useCallback(
    (id: string, field: keyof PricingRule, value: string) => {
      setScenarioRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      )
    },
    []
  )

  // расчет общего веса по каталогу (weight * qty)
  const catalogWeight = useMemo(() => {
    if (!data || !data.length) return 0

    return data.reduce((sum, row) => {
      const weight = Number(row.weight ?? 0)
      const qty = Number(row.qty ?? row.quantity ?? 0)

      return sum + weight * qty
    }, 0)
  }, [data])

  // проверка отсутствующего веса
  const missingCatalogWeight = useMemo(() => {
    return data.some((row) => !Number(row.weight))
  }, [data])

  const goodsValuePerKg = useMemo(() => {
    const total = Number(shippingForm.goodsTotalValue || 0)
    const weight = Number(shippingForm.weight || 0)

    if (!weight) return ""

    return (total / weight).toFixed(2)
  }, [shippingForm.goodsTotalValue, shippingForm.weight])

  // Cost per kg (raw) = total_cost / weight
  const costPerKgRaw = useMemo(() => {
    const totalCost = Number(shippingForm.totalCost || 0)
    const weight = Number(shippingForm.weight || 0)

    if (!weight) return "0.00"

    return (totalCost / weight).toFixed(2)
  }, [shippingForm.totalCost, shippingForm.weight])

  // Sync normalPrice with costPerKgRaw when mode is "normal"
  useEffect(() => {
    if (mode === "normal") {
      setNormalPrice(costPerKgRaw)
    }
  }, [mode, costPerKgRaw])

  // перерасчёт строк по правилам
  const previewData = useMemo(
    () => applyPricingRules(data, scenarioRules),
    [data, scenarioRules]
  )

  // агрегированная сводка
  const summary = useMemo(() => {
    const origTotal = data.reduce((s, r) => s + r.now * r.qty, 0)
    const origCostTotal = data.reduce((s, r) => s + r.cost * r.qty, 0)
    const newTotal = previewData.reduce((s, r) => s + r.now * r.qty, 0)

    const origMargin =
      origCostTotal > 0 ? ((origTotal - origCostTotal) / origTotal) * 100 : 0

    const newMargin =
      origCostTotal > 0 ? ((newTotal - origCostTotal) / newTotal) * 100 : 0

    const diff = newTotal - origTotal

    return { origTotal, newTotal, origMargin, newMargin, diff }
  }, [data, previewData])

  // применить сценарий
  const handleApply = useCallback(() => {
    onApplyScenario(previewData)
  }, [onApplyScenario, previewData])

  // сбросить pricing rules
  const handleResetPricing = useCallback(() => {
    setScenarioRules([...defaultRules])
    onResetScenario()
  }, [defaultRules, onResetScenario])

  // сохранить правила как глобальные
  const handleSaveGlobal = useCallback(async () => {
    try {
      const res = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rules: scenarioRules,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to save pricing rules")
      }

      setDefaultRules([...scenarioRules])
      setShowSaveDialog(false)
      setShowSaveSuccess(true)

      setTimeout(() => setShowSaveSuccess(false), 3000)

      onApplyScenario(previewData)

    } catch (err) {
      console.error("Save pricing rules error:", err)
    }
  }, [scenarioRules, previewData, onApplyScenario])

  // Row highlight: check if rule changed for a given cost value
  const isRowModified = useCallback(
    (cost: number) => {
      const findRule = (rules: PricingRule[]) =>
        rules.find((r) => {
          const from = parseFloat(r.fromPrice) || 0
          const to = parseFloat(r.toPrice) || Infinity
          return cost >= from && cost < to
        })
      const defRule = findRule(defaultRules)
      const scnRule = findRule(scenarioRules)
      if (!defRule && !scnRule) return false
      if (!defRule || !scnRule) return true
      return defRule.markupPct !== scnRule.markupPct
    },
    [defaultRules, scenarioRules]
  )

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4">
          <TabsList className="h-8 bg-transparent p-0">
            <TabsTrigger
              value="pricing"
              className="h-7 rounded-none border-b-2 border-transparent px-3 py-1 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Pricing Rules
            </TabsTrigger>
            <TabsTrigger
              value="shipping"
              className="h-7 rounded-none border-b-2 border-transparent px-3 py-1 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Shipping Model
            </TabsTrigger>
            <TabsTrigger
              value="pricing-manager"
              className="h-7 rounded-none border-b-2 border-transparent px-3 py-1 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Pricing Manager
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="h-7 rounded-none border-b-2 border-transparent px-3 py-1 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Summary Impact
            </TabsTrigger>
          </TabsList>

          {/* Scenario indicator */}
          {(isModified || isScenarioActive) && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {isModified ? "Modified from Default" : "Scenario Active"}
              </span>
            </div>
          )}
        </div>

        {/* ─── Pricing Rules Tab ─── */}
        <TabsContent value="pricing" className="mt-0 flex-1 overflow-auto p-4">
          <div className="flex gap-6">
            {/* Left: compact rule grid (max 50%) */}
            <div className="flex w-full max-w-[440px] shrink-0 flex-col gap-1.5">
              {/* Header row */}
              <div className="grid grid-cols-[90px_90px_60px_140px_36px] gap-1.5 px-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">From</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">To</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">%</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Group</span>
                <span className="w-[36px]" />
              </div>
              {/* Rule rows */}
              {scenarioRules.map((rule) => {
                const defRule = defaultRules.find((d) => d.id === rule.id)
                const changed =
                  !defRule ||
                  defRule.fromPrice !== rule.fromPrice ||
                  defRule.toPrice !== rule.toPrice ||
                  defRule.markupPct !== rule.markupPct ||
                  defRule.pricingGroup !== rule.pricingGroup
                return (
                  <div
                    key={rule.id}
                    className={`grid grid-cols-[90px_90px_60px_140px_36px] gap-1.5 rounded-sm ${changed ? "bg-amber-500/5 ring-1 ring-amber-500/20" : ""
                      }`}
                  >
                    <Input
                      value={rule.fromPrice}
                      onChange={(e) => updateRule(rule.id, "fromPrice", e.target.value)}
                      className="h-7 font-mono text-xs"
                      placeholder="0.00"
                    />
                    <Input
                      value={rule.toPrice}
                      onChange={(e) => updateRule(rule.id, "toPrice", e.target.value)}
                      className="h-7 font-mono text-xs"
                      placeholder="0.00"
                    />
                    <Input
                      value={rule.markupPct}
                      onChange={(e) => updateRule(rule.id, "markupPct", e.target.value)}
                      className="h-7 font-mono text-xs"
                      placeholder="0"
                    />
                    <Select
                      value={rule.pricingGroup}
                      onValueChange={(v) => updateRule(rule.id, "pricingGroup", v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Запчасти">Запчасти</SelectItem>
                        <SelectItem value="Масло">Масло</SelectItem>
                        <SelectItem value="Economy">Economy</SelectItem>
                        <SelectItem value="Bulk">Bulk</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-[36px] p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRule(rule.id)}
                      aria-label="Remove rule"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
              <Button
                variant="outline"
                size="sm"
                className="mt-1 h-7 w-fit gap-1.5 text-xs"
                onClick={addRule}
              >
                <Plus className="h-3 w-3" />
                Add Rule
              </Button>

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleApply}
                  disabled={!isModified && !isScenarioActive}
                >
                  <Play className="h-3 w-3" />
                  Apply to Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleResetPricing}
                  disabled={!isModified && !isScenarioActive}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={!isModified}
                >
                  <Save className="h-3 w-3" />
                  Save as Global Default
                </Button>
              </div>
            </div>

            {/* Right: live preview summary */}
            {isModified && (
              <div className="flex min-w-0 flex-1 flex-col gap-3 border-l border-border pl-6">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Live Preview
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <PreviewCard label="Original Total" value={summary.origTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  <PreviewCard label="Scenario Total" value={summary.newTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} highlight />
                  <PreviewCard label="Original Margin" value={`${summary.origMargin.toFixed(1)}%`} />
                  <PreviewCard label="Scenario Margin" value={`${summary.newMargin.toFixed(1)}%`} highlight />
                  <PreviewCard
                    label="Difference"
                    value={`${summary.diff >= 0 ? "+" : ""}${summary.diff.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    highlight={summary.diff !== 0}
                    positive={summary.diff > 0}
                    negative={summary.diff < 0}
                  />
                  <PreviewCard label="Rows Affected" value={`${data.filter((r) => isRowModified(r.cost)).length} / ${data.length}`} />
                </div>
              </div>
            )}
          </div>
        </TabsContent>
        {/* ─── Shipping Model Tab ��── */}
        <TabsContent value="shipping" className="mt-0 flex-1 overflow-hidden p-4">

          <div className="grid grid-cols-5 gap-3 h-full">

            {/* ───────────── COLUMN 0 — SHIPMENT SELECTOR ───────────── */}
            <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Shipments
                  </span>
                  {isLoadingShipments && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewShipment}
                  className="h-6 px-2 text-[10px]"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>

              {/* Filter tabs */}
              <div className="shrink-0 flex border-b border-border">
                {(["all", "unlinked", "recent"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setShipmentFilter(filter)}
                    className={`flex-1 py-0.5 text-[9px] font-medium uppercase tracking-wider transition-colors ${shipmentFilter === filter
                      ? "text-primary border-b border-primary"
                      : "text-muted-foreground/60 hover:text-muted-foreground"
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="shrink-0 px-3 py-2 border-b border-border">
                <input
                  type="text"
                  placeholder="Search company, number, type..."
                  value={shipmentSearch}
                  onChange={(e) => setShipmentSearch(e.target.value)}
                  className="w-full h-7 px-2 text-[11px] bg-muted/50 border border-border rounded-md placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Shipment list with scrolling */}
              <div ref={shipmentListRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  {filteredShipments.length === 0 && !isLoadingShipments ? (
                    <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
                      {shipmentSearch ? "No matching shipments" : "No shipments found"}
                    </p>
                  ) : (
                    filteredShipments.map((ship) => {
                      const isSelected = selectedShipmentId === ship.shipment_id
                      const invoiceCount = isSelected ? shipmentInvoices.length : (ship.invoice_count ?? 0)
                      const hasInvoices = invoiceCount > 0
                      return (
                        <div
                          key={ship.shipment_id}
                          onClick={() => setSelectedShipmentId(isSelected ? null : ship.shipment_id)}
                          className={`grid grid-cols-4 gap-2 items-center px-2 py-1.5 border-b border-border/40 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                          } ${!hasInvoices && !isSelected ? "border-l-2 border-l-amber-500/40" : ""}`}
                        >
                          {/* COL 1: Company with status dot */}
                          <div className="flex items-center gap-1 min-w-0" title={hasInvoices ? `${invoiceCount} invoice(s) linked` : "No invoices linked"}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasInvoices ? "bg-green-500" : "bg-amber-500"}`} />
                            <span className="shrink-0">{getTransportIcon(ship.transport_type, isSelected)}</span>
                            <span className="text-[10px] font-medium text-foreground truncate">
                              {ship.transport_company || "Unknown"}
                            </span>
                          </div>
                          {/* COL 2: Invoice # */}
                          <span className="text-[10px] font-mono text-muted-foreground/80 truncate">
                            {ship.transport_invoice_number || "—"}
                          </span>
                          {/* COL 3: Date */}
                          <span className="text-[10px] tabular-nums text-muted-foreground/70 truncate">
                            {ship.transport_date || "—"}
                          </span>
                          {/* COL 4: Type */}
                          <span className={`text-[9px] font-semibold uppercase ${ship.transport_type?.toLowerCase() === "air" ? "text-sky-400" :
                            ship.transport_type?.toLowerCase() === "sea" ? "text-blue-400" :
                              ship.transport_type?.toLowerCase() === "river" ? "text-cyan-400" :
                                "text-amber-400"
                            }`}>
                            {ship.transport_type || "—"}
                          </span>
                        </div>
                      )
                    })
                  )}
              </div>

            </div>

            {/* ───────────── COLUMN 1 — DELIVERY INFO ───────────── */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 h-full overflow-y-auto">

              {/* Row 1: Company, Type */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company" compact>
                  <Select
                    value={shippingForm.company}
                    onValueChange={(v) =>
                      setShippingForm((p) => ({ ...p, company: v }))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aviamir">Aviamir</SelectItem>
                      <SelectItem value="greenline">Green Line</SelectItem>
                      <SelectItem value="transriver">Trans River</SelectItem>
                      <SelectItem value="northcargo">North Cargo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Type" compact>
                  <Select
                    value={shippingForm.type}
                    onValueChange={(v) =>
                      setShippingForm((p) => ({ ...p, type: v }))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="air">Air</SelectItem>
                      <SelectItem value="sea">Sea</SelectItem>
                      <SelectItem value="river">River</SelectItem>
                      <SelectItem value="winter">Winter Road</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Row 2: Invoice №, Manager */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice №" compact>
                  <Input
                    value={shippingForm.invoiceNumber}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        invoiceNumber: e.target.value,
                      }))
                    }
                    className="h-7 text-xs font-mono"
                  />
                </Field>

                <Field label="Manager" compact>
                  <Select
                    value={shippingForm.manager}
                    onValueChange={(v) =>
                      setShippingForm((p) => ({ ...p, manager: v }))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ivan">Ivan Petrov</SelectItem>
                      <SelectItem value="maria">Maria Sokolova</SelectItem>
                      <SelectItem value="alexey">Alexey Ivanov</SelectItem>
                      <SelectItem value="elena">Elena Kozlova</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Row 3: Transport Date, Received Date */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Transport Date" compact>
                  <Input
                    type="date"
                    value={shippingForm.transportDate}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        transportDate: e.target.value,
                      }))
                    }
                    className="h-7 text-xs"
                  />
                </Field>

                <Field label="Received Date" compact>
                  <Input
                    type="date"
                    value={shippingForm.receivedDate}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        receivedDate: e.target.value,
                      }))
                    }
                    className="h-7 text-xs"
                  />
                </Field>
              </div>

              {/* Row 4: Reference (full width) */}
              <Field label="Reference" compact>
                <Input
                  value={shippingForm.reference}
                  onChange={(e) =>
                    setShippingForm((p) => ({
                      ...p,
                      reference: e.target.value,
                    }))
                  }
                  className="h-7 text-xs"
                />
              </Field>

              {/* Row 5: Comment (full width, resizable) */}
              <Field label="Comment" compact>
                <textarea
                  value={shippingForm.comment}
                  onChange={(e) =>
                    setShippingForm((p) => ({
                      ...p,
                      comment: e.target.value,
                    }))
                  }
                  className="w-full min-h-[60px] rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-y"
                />
              </Field>

            </div>

            {/* ───────────── COLUMN 2 — CARGO ───────────── */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 h-full overflow-y-auto">

              <div className="grid grid-cols-2 gap-6">

                <Field label="Total Cost">
                  <Input
                    value={shippingForm.totalCost}
                    onChange={(e) => {
                      setShippingForm((p) => ({
                        ...p,
                        totalCost: e.target.value,
                      }))

                    }}

                    className="h-8 text-xs font-mono"
                  />
                </Field>

                <Field label="Packages">
                  <Input
                    type="number"
                    value={shippingForm.packages}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        packages: e.target.value,
                      }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </Field>

                <Field label="Weight (kg)">
                  <Input
                    value={shippingForm.weight}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        weight: e.target.value,
                      }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </Field>

                <Field label="Volume (m³)">
                  <Input
                    value={shippingForm.volume}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        volume: e.target.value,
                      }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </Field>

                <Field label="Density">
                  <Input
                    value={shippingForm.density}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        density: e.target.value,
                      }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </Field>

                <Field label="Goods Total Value">
                  <Input
                    value={shippingForm.goodsTotalValue}
                    onChange={(e) =>
                      setShippingForm((p) => ({
                        ...p,
                        goodsTotalValue: e.target.value,
                      }))
                    }
                    className={`h-8 text-xs font-mono ${isMismatch ? "border-red-500 text-red-600" : "border-border"
                      }`}
                  />
                </Field>

                <Field label="Cost per kg (raw)">
                  <Input
                    value={`${costPerKgRaw} ₽ / kg`}
                    readOnly
                    className="h-8 text-xs font-mono bg-muted/50"
                  />
                </Field>

                <Field label="Goods Value per kg">
                  <Input
                    value={goodsValuePerKg}
                    readOnly
                    className="h-8 text-xs font-mono"
                  />
                </Field>

              </div>

            </div>

            {/* ───────────── COLUMN 3 — CONTROL ───────────── */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 h-full overflow-y-auto">

              {/* Create Shipment Button - does NOT attach invoices */}
              <Button
                className="w-full h-8 text-xs"
                disabled={isCreatingShipment || !isFormValid}
                onClick={handleCreateShipment}
              >
                {isCreatingShipment ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-3 w-3" />
                    Create Shipment
                  </>
                )}
              </Button>

              {/* Attach Invoices Button - separate action */}
              {selectedShipmentId && invoiceIds.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full h-8 text-xs"
                  disabled={isAttaching}
                  onClick={handleAttachInvoices}
                >
                  {isAttaching ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Attaching...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-3 w-3" />
                      Attach {invoiceIds.length} Invoice(s)
                    </>
                  )}
                </Button>
              )}

              {!isFormValid && (
                <div className="text-xs text-red-500 space-y-1">
                  {validationErrors.map((e) => (
                    <div key={e}>• {e}</div>
                  ))}
                </div>
              )}

              {/* Status indicator */}
              {selectedShipmentId && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${shipmentInvoices.length > 0 ? "bg-green-500" : "bg-amber-500"}`} />
                  {shipmentInvoices.length > 0
                    ? `${shipmentInvoices.length} invoice(s) linked`
                    : "No invoices linked"}
                </div>
              )}

            </div>

            {/* ───────────── COLUMN 4 — NOTE ───────────── */}
            <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="shrink-0 flex items-center gap-2 border-b border-border px-4 py-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Note
                </span>
              </div>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-3 text-[11px] text-muted-foreground space-y-3">
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">Инструкция для менеджеров:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Выберите поставку из списка слева или создайте новую</li>
                    <li>Заполните данные о перевозке (компания, тип, дата)</li>
                    <li>Укажите стоимость и параметры груза</li>
                    <li>Привяжите инвойсы к поставке</li>
                    <li>Нажмите "Create Shipment" для сохранения</li>
                  </ol>
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">Типы доставки:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li><span className="text-sky-400 font-medium">AIR</span> — авиа</li>
                    <li><span className="text-blue-400 font-medium">SEA</span> — морская</li>
                    <li><span className="text-cyan-400 font-medium">RIVER</span> — речная</li>
                    <li><span className="text-amber-400 font-medium">WINTER</span> — зимняя</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">Статусы:</p>
                  <ul className="space-y-0.5 pl-1">
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Инвойсы привязаны
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Инвойсы не привязаны
                    </li>
                  </ul>
                </div>
              </div>
            </div>

          </div>

        </TabsContent>

        {/* ─── Pricing Manager Tab (12-Column Grid Layout) ─── */}
        <TabsContent value="pricing-manager" className="mt-0 flex-1 overflow-auto p-0">
          <div className="relative flex h-full">
            {/* Left Edge Trigger - expands on hover */}
            <div className="group shrink-0 w-[8px] hover:w-[140px] transition-all duration-200 ease-out bg-transparent hover:bg-card border-r border-transparent hover:border-border hover:shadow-md">
              {/* Collapsed state - subtle indicator */}
              <div className="absolute inset-y-0 left-0 w-[8px] flex items-center justify-center opacity-0 group-hover:opacity-0 transition-opacity">
                <div className="h-12 w-[3px] rounded-full bg-muted-foreground/20" />
              </div>
              {/* Expanded state - panel controls */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 p-2 flex flex-col gap-2">
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 px-1">
                  Layout
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addEmptyPanel}
                  className="h-7 text-[10px] gap-1 w-full justify-start"
                >
                  <Plus className="h-3 w-3" />
                  Add Panel
                </Button>
                <span className="text-[9px] text-muted-foreground/50 px-1 tabular-nums">
                  {panels.reduce((sum, p) => sum + p.colSpan, 0)}/12 cols
                </span>
              </div>
            </div>

            {/* Main Grid Area */}
            <div className="flex-1 p-4 overflow-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePanelDragEnd}
              >
                <SortableContext items={panelIds} strategy={horizontalListSortingStrategy}>
                  {/* 12-Column Grid - NO wrapping, explicit positioning */}
                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: "repeat(12, 1fr)",
                      gridAutoFlow: "column",
                    }}
                  >
                    {panels.map((panel) => {
                      // ─��─────────── SHIPMENTS PANEL ─────────────
                      if (panel.type === "shipments") {
                        return (
                          <GridPanel
                            key={panel.id}
                            id={panel.id}
                            title="Shipments"
                            colStart={panelPositions.get(panel.id) || 1}
                            colSpan={panel.colSpan}
                            maxColSpan={panelMaxColSpans.get(panel.id) || 12}
                            collapsed={panel.collapsed}
                            icon={<Truck className="h-3.5 w-3.5 text-muted-foreground" />}
                            headerExtra={isLoadingShipments ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : undefined}
                            onResize={(delta) => handlePanelResize(panel.id, panel.colSpan + delta)}
                            onToggleCollapse={() => togglePanelCollapse(panel.id)}
                          >
                            {/* Filter tabs */}
                            <div className="shrink-0 flex border-b border-border">
                              {(["all", "unlinked", "recent"] as const).map((filter) => (
                                <button
                                  key={filter}
                                  onClick={() => setShipmentFilter(filter)}
                                  className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${shipmentFilter === filter
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-muted-foreground/60 hover:text-muted-foreground"
                                    }`}
                                >
                                  {filter}
                                </button>
                              ))}
                            </div>

                            {/* Search input */}
                            <div className="shrink-0 px-3 py-2 border-b border-border">
                              <input
                                type="text"
                                placeholder="Search company, number, type..."
                                value={shipmentSearch}
                                onChange={(e) => setShipmentSearch(e.target.value)}
                                className="w-full h-7 px-2 text-[11px] bg-muted/50 border border-border rounded-md placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>

                            {/* Shipment list with resizable columns */}
                            <div className="flex flex-col">
                              {/* Header row - flex wrap for responsive */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border bg-muted/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-2 py-1.5">
                                <div className="flex items-center gap-3 flex-1 min-w-[120px]">
                                  <span className="flex-1">Company</span>
                                  <span className="w-[45px] text-left">#</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="w-[80px] text-left">Date</span>
                                  <span className="w-[50px] text-left">Type</span>
                                </div>
                              </div>

                              {/* Scrollable rows */}
                              <div className="max-h-[200px] overflow-y-auto overscroll-contain">
                                {filteredShipments.length === 0 && !isLoadingShipments ? (
                                  <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
                                    {shipmentSearch ? "No matching shipments" : "No shipments found"}
                                  </p>
                                ) : (
                                  filteredShipments.map((ship) => {
                                    const isSelected = selectedShipmentId === ship.shipment_id
                                    const invoiceCount = isSelected ? shipmentInvoices.length : (ship.invoice_count ?? 0)
                                    const hasInvoices = invoiceCount > 0
                                    return (
                                      <div
                                        key={ship.shipment_id}
                                        onClick={() => setSelectedShipmentId(isSelected ? null : ship.shipment_id)}
                                        className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 py-1.5 border-b border-border/40 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                                          } ${!hasInvoices && !isSelected ? "border-l-2 border-l-amber-500/40" : ""}`}
                                      >
                                        {/* Row 1: Company + Number (flex-1 so it takes available space) */}
                                        <div className="flex items-center gap-3 flex-1 min-w-[120px]">
                                          <div className="flex items-center gap-1.5 min-w-0 flex-1" title={hasInvoices ? `${invoiceCount} invoice(s) linked` : "No invoices linked"}>
                                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasInvoices ? "bg-green-500" : "bg-amber-500"}`} />
                                            <span className="shrink-0">{getTransportIcon(ship.transport_type, isSelected)}</span>
                                            <span className="text-[11px] font-medium text-foreground truncate">
                                              {ship.transport_company || "Unknown"}
                                            </span>
                                          </div>
                                          <span className="text-[11px] font-mono text-muted-foreground/80 w-[45px] text-left">
                                            {ship.transport_invoice_number || "—"}
                                          </span>
                                        </div>
                                        {/* Row 2 (wraps when narrow): Date + Type */}
                                        <div className="flex items-center gap-3">
                                          <span className="text-[11px] tabular-nums text-muted-foreground/70 w-[80px] text-left">
                                            {ship.transport_date || "—"}
                                          </span>
                                          <span className={`text-[10px] font-semibold uppercase w-[50px] text-left ${ship.transport_type?.toLowerCase() === "air" ? "text-sky-400" :
                                            ship.transport_type?.toLowerCase() === "sea" ? "text-blue-400" :
                                              ship.transport_type?.toLowerCase() === "river" ? "text-cyan-400" :
                                                "text-amber-400"
                                            }`}>
                                            {ship.transport_type || "—"}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            </div>

                          </GridPanel>
                        )
                      }

                      // ───────────── METRICS PANEL ─────────────
                      if (panel.type === "metrics") {
                        return (
                          <GridPanel
                            key={panel.id}
                            id={panel.id}
                            title="Metrics"
                            colStart={panelPositions.get(panel.id) || 1}
                            colSpan={panel.colSpan}
                            maxColSpan={panelMaxColSpans.get(panel.id) || 12}
                            collapsed={panel.collapsed}
                            onResize={(delta) => handlePanelResize(panel.id, panel.colSpan + delta)}
                            onToggleCollapse={() => togglePanelCollapse(panel.id)}
                          >
                            {!selectedShipmentId ? (
                              <div className="flex-1 flex items-center justify-center p-4">
                                <p className="text-sm text-muted-foreground/60 italic text-center">
                                  Select a shipment to view metrics
                                </p>
                              </div>
                            ) : (
                              <div className="p-2">
                                {/* Fixed Mode Selector */}
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
                                  <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Mode</span>
                                  <select
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value as "normal" | "hybrid")}
                                    className="border rounded px-2 py-1 text-[12px] bg-background font-semibold"
                                  >
                                    <option value="normal">Normal</option>
                                    <option value="hybrid">Hybrid</option>
                                  </select>
                                  {mode === "hybrid" && (
                                    <div className="flex items-center gap-1 ml-2">
                                      <span className="text-[10px] text-muted-foreground/70">Override ₽/kg:</span>
                                      <Input
                                        value={normalPrice}
                                        onChange={(e) => setNormalPrice(e.target.value)}
                                        className="h-6 w-20 font-mono text-[12px] bg-background px-1.5 text-right font-semibold"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Draggable Metric Widgets Grid */}
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={handleMetricDragEnd}
                                >
                                  <SortableContext items={metricOrder} strategy={rectSortingStrategy}>
                                    <div
                                      className="grid gap-2"
                                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
                                    >
                                      {metricOrder.map((metricId) => {
                                        const metricData: Record<string, MetricWidget> = {
                                          totalCost: { id: "totalCost", label: "Total Cost", value: `${Number(shippingForm.totalCost || 0).toLocaleString("ru-RU")} ₽`, highlight: true },
                                          costPerKg: { id: "costPerKg", label: "Cost ₽/kg", value: costPerKgRaw, highlight: true, color: "text-primary" },
                                          weightRaw: { id: "weightRaw", label: "Weight (raw)", value: `${shippingForm.weight || "0"} kg` },
                                          catalogWt: { id: "catalogWt", label: "Catalog wt", value: `${weightStats.totalWeight.toFixed(1)} kg` },
                                          bulkyPriceKg: { id: "bulkyPriceKg", label: "Bulky ₽/kg", value: mode === "normal" ? "—" : Math.round(model.bulkyPrice).toLocaleString("ru-RU"), color: mode === "hybrid" && model.bulkyPrice > 0 ? "text-amber-500" : undefined },
                                          packages: { id: "packages", label: "Packages", value: shippingForm.packages || "0" },
                                          volume: { id: "volume", label: "Volume (m³)", value: shippingForm.volume || "0" },
                                          density: { id: "density", label: "Density", value: shippingForm.density || "0" },
                                          bulkyWt: { id: "bulkyWt", label: "Bulky wt", value: mode === "normal" ? "—" : `${model.bulkyWeight.toFixed(2)} kg` },
                                          normalShip: { id: "normalShip", label: "Normal ship", value: `${Math.round(model.normalShipping).toLocaleString("ru-RU")} ₽` },
                                          bulkyShip: { id: "bulkyShip", label: "Bulky ship", value: mode === "normal" ? "—" : `${Math.round(model.bulkyShipping).toLocaleString("ru-RU")} ₽` },
                                          costPerKgRaw: { id: "costPerKgRaw", label: "Cost ₽/kg (raw)", value: costPerKgRaw },
                                          goodsPerKg: { id: "goodsPerKg", label: "Goods ₽/kg", value: goodsValuePerKg || "0" },
                                          manager: { id: "manager", label: "Manager", value: shippingForm.manager || "—" },
                                          test1: {
                                            id: "test1",
                                            label: "Normal wt",
                                            value: mode === "hybrid"
                                              ? `${Math.max(0, (Number(shippingForm.weight) || 0) - model.bulkyWeight).toFixed(2)} kg`
                                              : "—"
                                          },
                                          test2: { id: "test2", label: "Test 2", value: "456" },
                                          test3: { id: "test3", label: "Test 3", value: "789" },
                                          test4: { id: "test4", label: "Test 4", value: "000" },
                                        }
                                        const metric = metricData[metricId]
                                        if (!metric) return null
                                        return <SortableMetricBlock key={metric.id} {...metric} />
                                      })}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                              </div>
                            )}
                          </GridPanel>
                        )
                      }

                      // ────────��──── ACTIONS PANEL ─────────────
                      if (panel.type === "actions") {
                        return (
                          <GridPanel
                            key={panel.id}
                            id={panel.id}
                            title="Actions"
                            colStart={panelPositions.get(panel.id) || 1}
                            colSpan={panel.colSpan}
                            maxColSpan={panelMaxColSpans.get(panel.id) || 12}
                            collapsed={panel.collapsed}
                            headerExtra={<span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                            onResize={(delta) => handlePanelResize(panel.id, panel.colSpan + delta)}
                            onToggleCollapse={() => togglePanelCollapse(panel.id)}
                          >
                            <div className="flex-1 flex flex-col gap-1.5 p-2.5">
                              {/* Active rows indicator - uses data prop (same as main table) */}
                              <div className="text-[9px] text-muted-foreground/70 mb-1">
                                {data.length > 0 ? (
                                  <span className="text-green-500">{data.length} строк в таблице</span>
                                ) : (
                                  <span className="text-muted-foreground/50">Нет данных</span>
                                )}
                              </div>

                              {/* Enrich Button - same styling as Control Panel */}
                              <Button
                                size="sm"
                                onClick={() => {
                                  // Same logic as Control Panel Enrich button
                                  if (invoiceIds.length > 0) {
                                    onEnrichSelected?.(invoiceIds)
                                  } else if (selectedInvoice) {
                                    onEnrich?.()
                                  } else {
                                    toast.error("Выберите инвойс")
                                  }
                                }}
                                disabled={isEnriching || (invoiceIds.length === 0 && !selectedInvoice)}
                                className="h-8 gap-1.5 rounded-md px-3 text-[11px] w-full"
                              >
                                {isEnriching ? (
                                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 shrink-0" />
                                )}
                                {isEnriching ? "Enriching..." : "Enrich"}
                              </Button>

                              <div className="border-t border-border/40 my-1" />

                              {/* Предварительная цена Button */}
                              <Button
                                variant="default"
                                size="sm"
                                className={`h-7 text-[10px] w-full justify-center gap-1 transition-all ${isCalculatingMoot ? "opacity-70 cursor-progress" : ""
                                  }`}
                                onClick={() => {
                                  // Get pricing from current mode/metrics
                                  const costPerKg = mode === "hybrid" && normalPrice
                                    ? parseFloat(normalPrice)
                                    : parseFloat(costPerKgRaw) || 0
                                  const bulkyPriceKg = model.bulkyPrice || costPerKg

                                  // Pass pricing to calculation function
                                  calculateMoot(costPerKg, bulkyPriceKg)
                                }}
                                disabled={isCalculatingMoot}
                              >
                                {isCalculatingMoot ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Расчёт...
                                  </>
                                ) : (
                                  "Предварительная цена"
                                )}
                              </Button>

                              {/* Clear MOOT Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] w-full mt-1"
                                onClick={onClearMoot}
                                disabled={!onClearMoot}
                              >
                                Очистить MOOT
                              </Button>

                              {/* MOOT Results Feedback */}
                              {mootResults && !isCalculatingMoot && (
                                <div className="text-[9px] text-muted-foreground mt-1 space-y-0.5">
                                  {mootResults.calculated > 0 ? (
                                    <div className="text-green-500">
                                      Рассчитано: {mootResults.calculated} поз.
                                    </div>
                                  ) : mootResults.skipped > 0 && mootResults.skippedReasons.noWeight === 0 && mootResults.skippedReasons.noPrice === 0 && mootResults.skippedReasons.noRule === 0 ? (
                                    <div className="text-red-500">
                                      Ошибка: нет ₽/kg
                                    </div>
                                  ) : null}
                                  {mootResults.skipped > 0 && (mootResults.skippedReasons.noWeight > 0 || mootResults.skippedReasons.noPrice > 0 || mootResults.skippedReasons.noRule > 0) && (
                                    <div className="text-amber-500">
                                      Пропущено: {mootResults.skipped}
                                      {mootResults.skippedReasons.noWeight > 0 && (
                                        <span className="block text-[8px]">
                                          ��� нет веса: {mootResults.skippedReasons.noWeight}
                                        </span>
                                      )}
                                      {mootResults.skippedReasons.noPrice > 0 && (
                                        <span className="block text-[8px]">
                                          — нет закупочной цены: {mootResults.skippedReasons.noPrice}
                                        </span>
                                      )}
                                      {mootResults.skippedReasons.noRule > 0 && (
                                        <span className="block text-[8px]">
                                          — нет правила: {mootResults.skippedReasons.noRule}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </GridPanel>
                        )
                      }

                      // ───────────── INVOICES PANEL ─────────────
                      if (panel.type === "invoices") {
                        return (
                          <GridPanel
                            key={panel.id}
                            id={panel.id}
                            title="Invoices"
                            colStart={panelPositions.get(panel.id) || 1}
                            colSpan={panel.colSpan}
                            maxColSpan={panelMaxColSpans.get(panel.id) || 12}
                            collapsed={panel.collapsed}
                            headerExtra={
                              <>
                                {isLoadingShipmentInvoices && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                <span className={`font-mono text-[10px] tabular-nums ${shipmentInvoices.length > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                                  {shipmentInvoices.length} linked
                                </span>
                              </>
                            }
                            onResize={(delta) => handlePanelResize(panel.id, panel.colSpan + delta)}
                            onToggleCollapse={() => togglePanelCollapse(panel.id)}
                          >
                            <div className="flex-1 overflow-y-auto">
                              {!selectedShipmentId ? (
                                <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
                                  Select a shipment first
                                </p>
                              ) : shipmentInvoices.length === 0 && !isLoadingShipmentInvoices ? (
                                <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
                                  No invoices linked to this shipment
                                </p>
                              ) : (
                                <div className="divide-y divide-border/40">
                                  {shipmentInvoices.map((inv) => {
                                    const isSelected = selectedInvoiceId === inv.invoice_id
                                    return (
                                      <div
                                        key={inv.invoice_id}
                                        onClick={() => setSelectedInvoiceId(isSelected ? null : inv.invoice_id)}
                                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                                          }`}
                                      >
                                        <Check className={`h-3 w-3 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`} />
                                        <div className="min-w-0 flex-1">
                                          <div className={`font-mono text-[11px] font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                            {inv.invoice_id}
                                          </div>
                                        </div>
                                        {isSelected && isLoadingInvoiceItems && (
                                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </GridPanel>
                        )
                      }

                      // ───────────── NOTE_1 PANEL (Instructions for Pricing Manager) ─────────────
                      if (panel.type === "empty") {
                        return (
                          <GridPanel
                            key={panel.id}
                            id={panel.id}
                            title="Note"
                            icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                            colStart={panelPositions.get(panel.id) || 1}
                            colSpan={panel.colSpan}
                            maxColSpan={panelMaxColSpans.get(panel.id) || 12}
                            collapsed={panel.collapsed}
                            onResize={(delta) => handlePanelResize(panel.id, panel.colSpan + delta)}
                            onToggleCollapse={() => togglePanelCollapse(panel.id)}
                            onRemove={() => removePanel(panel.id)}
                            canRemove={true}
                          >
                            <div className="flex-1 overflow-y-auto p-3 text-[11px] text-muted-foreground space-y-3">
                              <div className="space-y-1.5">
                                <p className="font-medium text-foreground">Инструкция для менеджера:</p>
                                <ol className="list-decimal list-inside space-y-1 pl-1">
                                  <li>Выберите поставку из списка SHIPMENTS</li>
                                  <li>Проверьте метрики в блоке METRICS</li>
                                  <li>Выберите режим расчёта (Hybrid/Override)</li>
                                  <li>Используйте Enrich для обогащения данных</li>
                                  <li>Рассчитайте предварительную цену</li>
                                  <li>Привяжите инвойсы к поставке</li>
                                </ol>
                              </div>
                              <div className="space-y-1.5">
                                <p className="font-medium text-foreground">Режимы расчёта:</p>
                                <ul className="list-disc list-inside space-y-0.5 pl-1">
                                  <li><span className="text-primary font-medium">Hybrid</span> — авто + ручные корректировки</li>
                                  <li><span className="text-sky-400 font-medium">Override</span> — фиксированная цена P/kg</li>
                                </ul>
                              </div>
                              <div className="space-y-1.5">
                                <p className="font-medium text-foreground">Действия:</p>
                                <ul className="space-y-0.5 pl-1">
                                  <li className="flex items-center gap-1.5">
                                    <span className="text-green-500 font-medium">Enrich</span> — обогатить данные
                                  </li>
                                  <li className="flex items-center gap-1.5">
                                    <span className="text-amber-400 font-medium">Предварительная цена</span> — расчёт MOOT
                                  </li>
                                  <li className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground font-medium">Очистить MOOT</span> — сброс расчётов
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </GridPanel>
                        )
                      }

                      return null
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              {/* ─── Invoice Items Table ─── */}
              {selectedInvoiceId && (
                <div className="mt-4 bg-card border border-border rounded-xl">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Invoice Items
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/70">
                        {selectedInvoiceId}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {invoiceItems.length} item(s)
                    </span>
                  </div>

                  {isLoadingInvoiceItems ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : invoiceItems.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
                      No items found for this invoice
                    </p>
                  ) : (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">SKU</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Weight</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Price</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                            <th className="px-3 py-2 text-right font-medium text-primary">MOOT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {invoiceItems.map((item, idx) => {
                            const itemId = item.id || item.sku || item.article
                            const mootPrice = mootPrices.get(itemId)
                            const hasNoWeight = !Number(item.weight ?? 0)
                            const hasNoPrice = !Number(item.price ?? item.purchase_price ?? 0)
                            const isSkipped = hasNoWeight || hasNoPrice

                            return (
                              <tr
                                key={item.id || idx}
                                className={`hover:bg-muted/30 transition-colors ${isSkipped && mootResults ? "bg-amber-500/5" : ""
                                  }`}
                              >
                                <td className="px-3 py-2 font-mono text-foreground">{item.sku || item.article || "—"}</td>
                                <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{item.name || item.product_name || "—"}</td>
                                <td className="px-3 py-2 text-right font-mono text-foreground">{item.quantity || item.qty || 0}</td>
                                <td className={`px-3 py-2 text-right font-mono ${hasNoWeight && mootResults ? "text-amber-500" : "text-muted-foreground"}`}>
                                  {item.weight ? `${item.weight} kg` : "—"}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono ${hasNoPrice && mootResults ? "text-amber-500" : "text-foreground"}`}>
                                  {item.price ? `${Number(item.price).toLocaleString("ru-RU")} ₽` : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-medium text-foreground">
                                  {item.total ? `${Number(item.total).toLocaleString("ru-RU")} ₽` : "—"}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-medium ${mootPrice ? "text-primary animate-pulse" : "text-muted-foreground/40"
                                  }`}>
                                  {mootPrice ? `${mootPrice.toLocaleString("ru-RU")} ₽` : "—"}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── Summary Impact Tab ─── */}
        <TabsContent value="summary" className="mt-0 flex-1 overflow-auto p-4">
          <div className="grid max-w-2xl grid-cols-3 gap-4 lg:grid-cols-5">
            <SummaryCard label="Total Before" value={summary.origTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unit="USD" />
            <SummaryCard
              label="Total After"
              value={isModified || isScenarioActive ? summary.newTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "\u2014"}
              unit={isModified || isScenarioActive ? "USD" : undefined}
              muted={!isModified && !isScenarioActive}
            />
            <SummaryCard label="Margin Before" value={summary.origMargin.toFixed(1)} unit="%" />
            <SummaryCard
              label="Margin After"
              value={isModified || isScenarioActive ? summary.newMargin.toFixed(1) : "\u2014"}
              unit={isModified || isScenarioActive ? "%" : undefined}
              muted={!isModified && !isScenarioActive}
            />
            <SummaryCard
              label="Difference"
              value={
                isModified || isScenarioActive
                  ? `${summary.diff >= 0 ? "+" : ""}${summary.diff.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "\u2014"
              }
              muted={!isModified && !isScenarioActive}
            />
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button
              size="sm"
              className="h-8 gap-2 text-xs"
              disabled={!isModified}
              onClick={handleApply}
            >
              <Play className="h-3.5 w-3.5" />
              Apply to Invoice
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {isModified
                ? `Preview: ${data.filter((r) => isRowModified(r.cost)).length} rows will be recalculated.`
                : "Configure pricing rules and shipping model, then apply to see impact."}
            </span>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Save Confirmation Dialog ─── */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite Global Default Pricing Rules?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to overwrite the global default pricing rules?
              These rules affect all future calculations in the system.
              If you only want to simulate changes for this invoice, use &quot;Apply to Invoice&quot; instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveGlobal}
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              Yes, Overwrite Defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Success Toast ─── */}
      {showSaveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-lg dark:bg-emerald-950/80 dark:text-emerald-200">
          Global pricing rules updated.
        </div>
      )}
    </>
  )
}

// ─── Sub-components ─────────────────────────��────────��───────────────────────

function PreviewCard({
  label,
  value,
  highlight,
  positive,
  negative,
}: {
  label: string
  value: string
  highlight?: boolean
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/30 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${positive
          ? "text-emerald-600 dark:text-emerald-400"
          : negative
            ? "text-red-600 dark:text-red-400"
            : highlight
              ? "text-foreground"
              : "text-muted-foreground"
          }`}
      >
        {value}
      </span>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  unit,
  muted,
}: {
  label: string
  value: string
  unit?: string
  muted?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-mono text-lg font-semibold tabular-nums ${muted ? "text-muted-foreground/40" : "text-foreground"
            }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        )}
      </div>
    </div>
  )
}
function Field({
  label,
  children,
  compact = false,
}: {
  label: string
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col ${compact ? "gap-0.5" : "gap-1.5"}`}>
      <label className={`font-medium uppercase tracking-wider text-muted-foreground ${compact ? "text-[9px]" : "text-[10px]"}`}>
        {label}
      </label>
      {children}
    </div>
  )
}
