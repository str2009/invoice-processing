"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
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
import { Plus, Trash2, RotateCcw, Save, Play, Loader2, Truck, Check, Link2, Plane, Ship, Anchor } from "lucide-react"

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
}

export function SimulationPanel({
  data,
  invoiceIds,
  onApplyScenario,
  onResetScenario,
  isScenarioActive,
  onSetSelectedInvoices,
}: SimulationPanelProps) {
  
  const [activeTab, setActiveTab] = useState("shipping")
  const [mode, setMode] = useState<"normal" | "hybrid">("hybrid")
const [normalPrice, setNormalPrice] = useState("115")
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
const [isLoadingShipmentInvoices, setIsLoadingShipmentInvoices] = useState(false)


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
    return
  }
  
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

    if (row.isBulky) {
      bulkyWeight += weight * qty
    } else {
      normalWeight += weight * qty
    }
  })

  const normalShipping = normalWeight * normalCargoPrice
  const bulkyShipping = totalCost - normalShipping

  const bulkyPrice =
    bulkyWeight > 0
      ? bulkyShipping / bulkyWeight
      : 0

  return {
    normalWeight,
    bulkyWeight,
    normalShipping,
    bulkyShipping,
    bulkyPrice,
    missingWeight,
  }
}, [data, shippingForm.totalCost, normalCargoPrice])

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
        normal_weight: Number(model.normalWeight || 0),
        bulky_weight: Number(model.bulkyWeight || 0),
        normal_shipping: Number(model.normalShipping || 0),
        bulky_shipping: Number(model.bulkyShipping || 0),
        catalog_weight: Number(weightStats.totalWeight || 0),
        bulky_price: Number(model.bulkyPrice || 0),
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
        pricingGroup: r.pricing_group,
      }))

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
          normal_weight: Number(model.normalWeight || 0),
          bulky_weight: Number(model.bulkyWeight || 0),
          normal_shipping: Number(model.normalShipping || 0),
          bulky_shipping: Number(model.bulkyShipping || 0),
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
                    className={`grid grid-cols-[90px_90px_60px_140px_36px] gap-1.5 rounded-sm ${
                      changed ? "bg-amber-500/5 ring-1 ring-amber-500/20" : ""
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
{/* ─── Shipping Model Tab ─── */}
<TabsContent value="shipping" className="mt-0 flex-1 overflow-auto p-6">

  <div className="grid grid-cols-5 gap-6">

  {/* ───────────── COLUMN 0 — SHIPMENT SELECTOR ───────────── */}
  <div className="bg-card border border-border rounded-xl flex flex-col max-h-[calc(100vh-200px)]">
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
          className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            shipmentFilter === filter
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

    {/* Shipment list - fixed height ~4 rows */}
    <div className="max-h-[220px] overflow-y-auto overscroll-contain pr-1">
      {filteredShipments.length === 0 && !isLoadingShipments ? (
        <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
          {shipmentSearch ? "No matching shipments" : "No shipments found"}
        </p>
      ) : (
        filteredShipments.map((ship) => {
          const isSelected = selectedShipmentId === ship.shipment_id
          return (
            <div
              key={ship.shipment_id}
              onClick={() => setSelectedShipmentId(isSelected ? null : ship.shipment_id)}
              className={`flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 cursor-pointer transition-colors ${
                isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
              }`}
            >
              {/* LEFT: Icon + Company + Invoice # */}
              <div className="flex items-center gap-2 min-w-0">
                {getTransportIcon(ship.transport_type, isSelected)}
                <div className="truncate">
                  <span className="text-[11px] font-medium text-foreground">
                    {ship.transport_company || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 ml-2">
                    {ship.transport_invoice_number || "—"}
                  </span>
                </div>
              </div>
              {/* RIGHT: Badge + Date */}
              <div className="flex items-center gap-2 shrink-0">
                {ship.transport_type && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-medium uppercase rounded ${
                    ship.transport_type.toLowerCase() === "air" ? "bg-sky-500/20 text-sky-400" :
                    ship.transport_type.toLowerCase() === "sea" ? "bg-blue-500/20 text-blue-400" :
                    ship.transport_type.toLowerCase() === "river" ? "bg-cyan-500/20 text-cyan-400" :
                    "bg-amber-500/20 text-amber-400"
                  }`}>
                    {ship.transport_type}
                  </span>
                )}
                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                  {ship.transport_date || "—"}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>

    {/* Linked invoices section */}
    {selectedShipmentId && (
      <div className="shrink-0 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Linked Invoices
          </span>
          {isLoadingShipmentInvoices ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className={`ml-auto font-mono text-[10px] tabular-nums ${shipmentInvoices.length > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
              {shipmentInvoices.length === 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Unlinked
                </span>
              ) : (
                `${shipmentInvoices.length} linked`
              )}
            </span>
          )}
        </div>
        
        <div className="max-h-24 overflow-y-auto">
          {shipmentInvoices.length === 0 && !isLoadingShipmentInvoices ? (
            <p className="px-3 py-2 text-center text-[10px] italic text-muted-foreground/40">
              No invoices linked
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {shipmentInvoices.slice(0, 5).map((inv) => (
                <div key={inv.invoice_id} className="flex items-center gap-2 px-3 py-1">
                  <Check className="h-3 w-3 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">
                    {inv.invoice_id}
                  </span>
                </div>
              ))}
              {shipmentInvoices.length > 5 && (
                <div className="px-3 py-1 text-center text-[10px] text-muted-foreground/60">
                  +{shipmentInvoices.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attach button */}
        {invoiceIds.length > 0 && (
          <div className="border-t border-border/50 px-3 py-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isAttaching}
              onClick={handleAttachInvoices}
              className="h-7 w-full gap-1.5 text-[10px]"
            >
              {isAttaching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2 className="h-3 w-3" />
              )}
              Attach {invoiceIds.length} invoice(s)
            </Button>
          </div>
        )}
      </div>
    )}
  </div>

    {/* ───────────── COLUMN 1 — DELIVERY INFO ───────────── */}
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">

      <div className="grid grid-cols-2 gap-6">

        <Field label="Company">
          <Select
            value={shippingForm.company}
            onValueChange={(v) =>
              setShippingForm((p) => ({ ...p, company: v }))
            }
          >
            <SelectTrigger className="h-8 text-xs">
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

        <Field label="Type">
          <Select
            value={shippingForm.type}
            onValueChange={(v) =>
              setShippingForm((p) => ({ ...p, type: v }))
            }
          >
            <SelectTrigger className="h-8 text-xs">
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

        <Field label="Invoice №">
          <Input
            value={shippingForm.invoiceNumber}
            onChange={(e) =>
              setShippingForm((p) => ({
                ...p,
                invoiceNumber: e.target.value,
              }))
            }
            className="h-8 text-xs font-mono"
          />
        </Field>

        <Field label="Reference">
          <Input
            value={shippingForm.reference}
            onChange={(e) =>
              setShippingForm((p) => ({
                ...p,
                reference: e.target.value,
              }))
            }
            className="h-8 text-xs"
          />
        </Field>

        <Field label="Transport Date">
          <Input
            type="date"
            value={shippingForm.transportDate}
            onChange={(e) =>
              setShippingForm((p) => ({
                ...p,
                transportDate: e.target.value,
              }))
            }
            className="h-8 text-xs"
          />
        </Field>

        <Field label="Received Date">
          <Input
            type="date"
            value={shippingForm.receivedDate}
            onChange={(e) =>
              setShippingForm((p) => ({
                ...p,
                receivedDate: e.target.value,
              }))
            }
            className="h-8 text-xs"
          />
        </Field>

      </div>

      <Field label="Comment">
        <textarea
          value={shippingForm.comment}
          onChange={(e) =>
            setShippingForm((p) => ({
              ...p,
              comment: e.target.value,
            }))
          }
          className="w-full min-h-[90px] rounded-md border border-border bg-background px-3 py-2 text-xs resize-none"
        />
      </Field>

    </div>

    {/* ───────────── COLUMN 2 — CARGO ───────────── */}
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">

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
            className={`h-8 text-xs font-mono ${
              isMismatch ? "border-red-500 text-red-600" : "border-border"
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

    {/* ─���─────────── COLUMN 3 — MODEL ──────────���── */}
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">Mode</div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "normal" | "hybrid")}
            className="w-full border rounded-md px-2 py-1 text-xs"
          >
            <option value="normal">Normal</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Normal cargo price {mode === "normal" && <span className="text-muted-foreground/60">(auto)</span>}
          </div>
          <Input
            value={mode === "normal" ? `${normalPrice} ₽ / kg` : normalPrice}
            onChange={(e) => setNormalPrice(e.target.value)}
            readOnly={mode === "normal"}
            className={`h-8 font-mono text-xs ${mode === "normal" ? "bg-muted/50 cursor-not-allowed" : ""}`}
          />
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Normal weight
          </div>
          <div className="text-sm font-medium">
            {model.normalWeight.toFixed(2)} kg
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Bulky weight
          </div>
          <div className="text-sm">
            {model.bulkyWeight.toFixed(2)} kg
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Normal shipping
          </div>
          <div className="text-sm font-medium">
            {model.normalShipping.toLocaleString("ru-RU")} ₽
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Bulky shipping
          </div>
          <div className="text-sm">
            {Math.round(model.bulkyShipping).toLocaleString("ru-RU")} ₽
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Catalog weight
          </div>
          <div className="text-sm font-semibold">
            {weightStats.totalWeight.toFixed(2)} kg
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Bulky price
          </div>
          <div className="text-sm">
            {Math.round(model.bulkyPrice).toLocaleString("ru-RU")} ₽ / kg
          </div>
        </div>

      </div>
    </div>

    {/* ─────�����─────── COLUMN 4 — CONTROL ───────────── */}
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">

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

  </div>

</TabsContent>

        {/* ─── Pricing Manager Tab (Compact Pricing UI) ─── */}
        <TabsContent value="pricing-manager" className="mt-0 flex-1 overflow-auto p-6">
          <div className="grid grid-cols-4 gap-6">

            {/* ───────────── COLUMN 0 — SHIPMENT SELECTOR (Always visible) ───────────── */}
            <div className="bg-card border border-border rounded-xl flex flex-col max-h-[calc(100vh-200px)]">
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
              </div>

              {/* Filter tabs */}
                <div className="shrink-0 flex border-b border-border">
                  {(["all", "unlinked", "recent"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setShipmentFilter(filter)}
                      className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        shipmentFilter === filter
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

                {/* Shipment list */}
                <div className="max-h-[220px] overflow-y-auto overscroll-contain pr-1">
                  {filteredShipments.length === 0 && !isLoadingShipments ? (
                    <p className="px-4 py-6 text-center text-[11px] italic text-muted-foreground/40">
                      {shipmentSearch ? "No matching shipments" : "No shipments found"}
                    </p>
                  ) : (
                    filteredShipments.map((ship) => {
                      const isSelected = selectedShipmentId === ship.shipment_id
                      return (
                        <div
                          key={ship.shipment_id}
                          onClick={() => setSelectedShipmentId(isSelected ? null : ship.shipment_id)}
                          className={`flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getTransportIcon(ship.transport_type, isSelected)}
                            <div className="truncate">
                              <span className="text-[11px] font-medium text-foreground">
                                {ship.transport_company || "Unknown"}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 ml-2">
                                {ship.transport_invoice_number || "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {ship.transport_type && (
                              <span className={`px-1.5 py-0.5 text-[9px] font-medium uppercase rounded ${
                                ship.transport_type.toLowerCase() === "air" ? "bg-sky-500/20 text-sky-400" :
                                ship.transport_type.toLowerCase() === "sea" ? "bg-blue-500/20 text-blue-400" :
                                ship.transport_type.toLowerCase() === "river" ? "bg-cyan-500/20 text-cyan-400" :
                                "bg-amber-500/20 text-amber-400"
                              }`}>
                                {ship.transport_type}
                              </span>
                            )}
                            <span className="text-[10px] tabular-nums text-muted-foreground/60">
                              {ship.transport_date || "—"}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Linked invoices section */}
                {selectedShipmentId && (
                  <div className="shrink-0 border-t border-border bg-muted/30">
                    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Linked Invoices
                      </span>
                      {isLoadingShipmentInvoices ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <span className={`ml-auto font-mono text-[10px] tabular-nums ${shipmentInvoices.length > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                          {shipmentInvoices.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Unlinked
                            </span>
                          ) : (
                            `${shipmentInvoices.length} linked`
                          )}
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-24 overflow-y-auto">
                      {shipmentInvoices.length === 0 && !isLoadingShipmentInvoices ? (
                        <p className="px-3 py-2 text-center text-[10px] italic text-muted-foreground/40">
                          No invoices linked
                        </p>
                      ) : (
                        <div className="divide-y divide-border/30">
                          {shipmentInvoices.slice(0, 5).map((inv) => (
                            <div key={inv.invoice_id} className="flex items-center gap-2 px-3 py-1">
                              <Check className="h-3 w-3 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">
                                {inv.invoice_id}
                              </span>
                            </div>
                          ))}
                          {shipmentInvoices.length > 5 && (
                            <div className="px-3 py-1 text-center text-[10px] text-muted-foreground/60">
                              +{shipmentInvoices.length - 5} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* ───────────── COLUMN 2 — SUMMARY + PRICING (conditional) ───────────── */}
            {!selectedShipmentId ? (
              <div className="col-span-2 flex items-center justify-center bg-card border border-border rounded-xl">
                <p className="text-sm text-muted-foreground/60 italic">
                  Select a shipment to review pricing context.
                </p>
              </div>
            ) : (
              <div className="col-span-2 space-y-4">
                {/* ─── SHIPMENT SUMMARY (compact text display) ─── */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {getTransportIcon(shippingForm.type, true)}
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Shipment Summary
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground/70">Company</span>
                      <div className="font-medium text-foreground">{shippingForm.company || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground/70">Type</span>
                      <div className="font-medium text-foreground capitalize">{shippingForm.type || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground/70">Transport Date</span>
                      <div className="font-medium text-foreground">{shippingForm.transportDate || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground/70">Weight</span>
                      <div className="font-medium font-mono text-foreground">{shippingForm.weight || "0"} kg</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground/70">Total Cost</span>
                      <div className="font-medium font-mono text-foreground">{Number(shippingForm.totalCost || 0).toLocaleString("ru-RU")} ₽</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground/70">Cost per kg (raw)</span>
                      <div className="font-medium font-mono text-primary">{costPerKgRaw} ₽ / kg</div>
                    </div>
                  </div>
                </div>

                {/* ─── PRICING CONTROLS ─── */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pricing Controls
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-1">Mode</div>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as "normal" | "hybrid")}
                        className="w-full border rounded-md px-2 py-1.5 text-xs bg-background"
                      >
                        <option value="normal">Normal</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-1">
                        Cost per kg (used) {mode === "normal" && <span className="text-muted-foreground/60">(auto)</span>}
                      </div>
                      <Input
                        value={mode === "normal" ? `${costPerKgRaw} ₽ / kg` : normalPrice}
                        onChange={(e) => setNormalPrice(e.target.value)}
                        readOnly={mode === "normal"}
                        className={`h-8 font-mono text-xs ${mode === "normal" ? "bg-muted/50 cursor-not-allowed" : "bg-background"}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ───────────── COLUMN 3 — INVOICES ───────────── */}
            <div className="bg-card border border-border rounded-xl flex flex-col max-h-[calc(100vh-200px)]">
              <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Invoices
                  </span>
                  {isLoadingShipmentInvoices && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                <span className={`font-mono text-[10px] tabular-nums ${shipmentInvoices.length > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                  {shipmentInvoices.length} linked
                </span>
              </div>

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
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
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
            </div>

          </div>

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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {invoiceItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 font-mono text-foreground">{item.sku || item.article || "—"}</td>
                          <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{item.name || item.product_name || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">{item.quantity || item.qty || 0}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{item.weight ? `${item.weight} kg` : "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">{item.price ? `${Number(item.price).toLocaleString("ru-RU")} ₽` : "—"}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-foreground">{item.total ? `${Number(item.total).toLocaleString("ru-RU")} ₽` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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

// ─── Sub-components ──────────────────────────────────────────────────────────

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
        className={`font-mono text-sm font-semibold tabular-nums ${
          positive
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
          className={`font-mono text-lg font-semibold tabular-nums ${
            muted ? "text-muted-foreground/40" : "text-foreground"
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
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
