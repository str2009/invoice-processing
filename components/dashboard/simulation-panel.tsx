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
import { Plus, Trash2, RotateCcw, Save, Play, Loader2 } from "lucide-react"
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
}

export function SimulationPanel({
  data,
  invoiceIds,
  onApplyScenario,
  onResetScenario,
  isScenarioActive,
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
    console.error("SHIPMENT ERROR: No invoices selected")
    return
  }

  if (!isFormValid) return

  

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
      console.error("SHIPMENT ERROR:", json)
      toast.error("Failed to save shipment")
      throw new Error(json?.error || JSON.stringify(json) || "Failed to save shipment")
    }

    toast.success(`Shipment saved for ${normalizedInvoiceIds.length} invoice(s)`)

  } catch {
    toast.error("Error saving shipment")

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

  <div className="grid grid-cols-4 gap-8">

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

        <Field label="Goods Value per kg">
          <Input
            value={goodsValuePerKg}
            readOnly
            className="h-8 text-xs font-mono"
          />
        </Field>

      </div>

    </div>

    {/* ───────────── COLUMN 3 — MODEL ──────────���── */}
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
            Normal cargo price
          </div>
          <Input
            value={normalPrice}
            onChange={(e) => setNormalPrice(e.target.value)}
            className="h-8 font-mono text-xs"
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

    {/* ───────────── COLUMN 4 — CONTROL ───────────── */}
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">

<Button
  className="w-full h-8 text-xs"
  disabled={isSavingShipping || !isFormValid || !invoiceIds.length}
  onClick={handleSaveShipping}
  >
  {isSavingShipping ? (
    <>
      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
      Saving...
    </>
  ) : invoiceIds.length <= 1 ? (
    "Save Shipping"
  ) : (
    `Save Shipping (${invoiceIds.length})`
  )}
  </Button>

      {!isFormValid && (
        <div className="text-xs text-red-500 space-y-1">
          {validationErrors.map((e) => (
            <div key={e}>• {e}</div>
          ))}
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
