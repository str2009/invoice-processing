"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plane, Ship, Anchor, Truck, Calculator, Save, RotateCcw, ChevronUp, ChevronDown, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { InvoiceRow } from "@/lib/mock-data"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PricingRule {
  id: string
  fromPrice: string
  toPrice: string
  markupPct: string
  pricingGroup: string
}

export type ShipmentSummary = {
  shipmentId: string | null
  company: string
  type: string
  invoiceNumber: string
  transportDate: string
  totalCost: number
  weight: number
  costPerKgRaw: number
}

export type ItemPricing = {
  id: string
  partCode: string
  partName: string
  manufacturer: string
  purchasePrice: number
  weight: number
  qty: number
  shippingCost: number       // auto: weight * qty * costPerKgUsed
  recommendedPrice: number   // auto: purchasePrice + shippingCost + markup
  mootAuto: number          // auto-calculated MOOT
  mootManual: number | null // user override
  mootFinal: number         // = mootManual ?? mootAuto
  mootReason: string        // reason for manual override
}

const DEFAULT_RULES: PricingRule[] = [
  { id: "1", fromPrice: "0", toPrice: "10", markupPct: "45", pricingGroup: "Standard" },
  { id: "2", fromPrice: "10", toPrice: "50", markupPct: "35", pricingGroup: "Standard" },
  { id: "3", fromPrice: "50", toPrice: "200", markupPct: "25", pricingGroup: "Standard" },
  { id: "4", fromPrice: "200", toPrice: "1000", markupPct: "18", pricingGroup: "Premium" },
]

const MOOT_REASONS = [
  { value: "", label: "Select reason..." },
  { value: "cheap_purchase", label: "Cheap purchase" },
  { value: "clearance", label: "Clearance sale" },
  { value: "analog", label: "Analog available" },
  { value: "competition", label: "Competition price" },
  { value: "manual", label: "Manual adjustment" },
]

// ─── Icon Helper ─────────────────────────────────────────────────────────────

function getTransportIcon(type: string | null) {
  const className = "h-4 w-4 text-muted-foreground"
  const t = type?.toLowerCase()
  
  if (t === "air") return <Plane className={className} />
  if (t === "sea") return <Ship className={className} />
  if (t === "river") return <Anchor className={className} />
  
  return <Truck className={className} />
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PricingManagerProps {
  data: InvoiceRow[]
  shipment: ShipmentSummary | null
  onSavePricing?: (items: ItemPricing[]) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PricingManager({ data, shipment, onSavePricing }: PricingManagerProps) {
  // Pricing mode
  const [mode, setMode] = useState<"normal" | "hybrid">("normal")
  const [costPerKgUsed, setCostPerKgUsed] = useState<string>("")
  
  // Pricing rules
  const [rules, setRules] = useState<PricingRule[]>(DEFAULT_RULES)
  
  // Item-level overrides
  const [manualOverrides, setManualOverrides] = useState<Record<string, { mootManual: number | null; mootReason: string }>>({})
  
  // Table state
  const [sortColumn, setSortColumn] = useState<string>("partCode")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [isSaving, setIsSaving] = useState(false)

  // Effective cost per kg
  const effectiveCostPerKg = useMemo(() => {
    if (mode === "normal") {
      return shipment?.costPerKgRaw ?? 0
    }
    return parseFloat(costPerKgUsed) || shipment?.costPerKgRaw || 0
  }, [mode, costPerKgUsed, shipment?.costPerKgRaw])

  // Calculate pricing for all items
  const pricedItems = useMemo((): ItemPricing[] => {
    return data.map((row) => {
      const weight = row.weight || 0
      const qty = row.qty || 1
      const purchasePrice = row.cost || 0
      
      // Shipping cost per unit
      const shippingCost = weight * effectiveCostPerKg
      
      // Find matching markup rule
      const rule = rules.find((r) => {
        const from = parseFloat(r.fromPrice) || 0
        const to = parseFloat(r.toPrice) || Infinity
        return purchasePrice >= from && purchasePrice < to
      })
      const markupPct = rule ? parseFloat(rule.markupPct) || 0 : 20
      
      // Recommended price = purchase + shipping + markup
      const basePrice = purchasePrice + shippingCost
      const recommendedPrice = Math.round(basePrice * (1 + markupPct / 100) * 100) / 100
      
      // MOOT calculations
      const mootAuto = Math.round(recommendedPrice * 100) / 100
      const override = manualOverrides[row.id]
      const mootManual = override?.mootManual ?? null
      const mootFinal = mootManual ?? mootAuto
      const mootReason = override?.mootReason ?? ""
      
      return {
        id: row.id,
        partCode: row.partCode,
        partName: row.partName,
        manufacturer: row.manufacturer,
        purchasePrice,
        weight,
        qty,
        shippingCost: Math.round(shippingCost * 100) / 100,
        recommendedPrice,
        mootAuto,
        mootManual,
        mootFinal,
        mootReason,
      }
    })
  }, [data, effectiveCostPerKg, rules, manualOverrides])

  // Sorted items
  const sortedItems = useMemo(() => {
    return [...pricedItems].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof ItemPricing]
      let bVal: any = b[sortColumn as keyof ItemPricing]
      
      if (typeof aVal === "string") aVal = aVal.toLowerCase()
      if (typeof bVal === "string") bVal = bVal.toLowerCase()
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [pricedItems, sortColumn, sortDirection])

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalItems = pricedItems.length
    const totalShippingCost = pricedItems.reduce((sum, item) => sum + (item.shippingCost * item.qty), 0)
    const totalMootValue = pricedItems.reduce((sum, item) => sum + (item.mootFinal * item.qty), 0)
    const manualOverrideCount = pricedItems.filter(item => item.mootManual !== null).length
    
    return {
      totalItems,
      totalShippingCost: Math.round(totalShippingCost * 100) / 100,
      totalMootValue: Math.round(totalMootValue * 100) / 100,
      manualOverrideCount,
    }
  }, [pricedItems])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }, [sortColumn])

  const handleMootManualChange = useCallback((id: string, value: string) => {
    const numValue = value === "" ? null : parseFloat(value)
    setManualOverrides(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        mootManual: numValue,
        mootReason: prev[id]?.mootReason ?? "",
      }
    }))
  }, [])

  const handleMootReasonChange = useCallback((id: string, reason: string) => {
    setManualOverrides(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        mootManual: prev[id]?.mootManual ?? null,
        mootReason: reason,
      }
    }))
  }, [])

  const handleResetOverrides = useCallback(() => {
    setManualOverrides({})
    toast.success("All manual overrides reset")
  }, [])

  const handleSavePricing = useCallback(async () => {
    setIsSaving(true)
    try {
      // Here you would save to API
      await new Promise(resolve => setTimeout(resolve, 500))
      onSavePricing?.(pricedItems)
      toast.success("Pricing saved successfully")
    } catch {
      toast.error("Failed to save pricing")
    } finally {
      setIsSaving(false)
    }
  }, [pricedItems, onSavePricing])

  // Column header component
  const SortableHeader = ({ column, label, className }: { column: string; label: string; className?: string }) => (
    <button
      onClick={() => handleSort(column)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      {label}
      {sortColumn === column && (
        sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ════════════════ TOP: Shipment Summary & Mode ════════════════ */}
      <div className="shrink-0 border-b border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-6">
          {/* Shipment summary */}
          <div className="flex items-center gap-6">
            {shipment ? (
              <>
                <div className="flex items-center gap-3">
                  {getTransportIcon(shipment.type)}
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      {shipment.company || "Unknown carrier"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {shipment.invoiceNumber || "No invoice"} • {shipment.transportDate || "—"}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 px-4 border-l border-border">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">Total Cost</div>
                    <div className="text-xs font-mono font-medium">{shipment.totalCost.toLocaleString()} ₽</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">Weight</div>
                    <div className="text-xs font-mono font-medium">{shipment.weight} kg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">Cost/kg (raw)</div>
                    <div className="text-xs font-mono font-medium text-primary">{shipment.costPerKgRaw.toFixed(2)} ₽</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-xs">No shipment selected. Select or create a shipment in Logistics tab.</span>
              </div>
            )}
          </div>

          {/* Mode selector & Cost per kg */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground uppercase">Mode:</Label>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setMode("normal")}
                  className={cn(
                    "px-3 py-1 text-[10px] font-medium transition-colors",
                    mode === "normal"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Normal
                </button>
                <button
                  onClick={() => setMode("hybrid")}
                  className={cn(
                    "px-3 py-1 text-[10px] font-medium transition-colors border-l border-border",
                    mode === "hybrid"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Hybrid
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">
                Cost/kg (used):
              </Label>
              <Input
                type="number"
                value={mode === "normal" ? (shipment?.costPerKgRaw?.toFixed(2) ?? "") : costPerKgUsed}
                onChange={(e) => setCostPerKgUsed(e.target.value)}
                disabled={mode === "normal"}
                placeholder={shipment?.costPerKgRaw?.toFixed(2) ?? "0.00"}
                className={cn(
                  "h-7 w-20 text-xs text-right font-mono",
                  mode === "normal" && "bg-muted/50 cursor-not-allowed"
                )}
              />
              <span className="text-[10px] text-muted-foreground">₽</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════ MIDDLE: Pricing Table ════════════════ */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card border-b border-border z-10">
            <tr>
              <th className="text-left px-3 py-2 w-28">
                <SortableHeader column="partCode" label="Part Code" />
              </th>
              <th className="text-left px-3 py-2">
                <SortableHeader column="partName" label="Part Name" />
              </th>
              <th className="text-left px-3 py-2 w-24">
                <SortableHeader column="manufacturer" label="Mfr" />
              </th>
              <th className="text-right px-3 py-2 w-20">
                <SortableHeader column="purchasePrice" label="Purchase" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2 w-16">
                <SortableHeader column="weight" label="Weight" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2 w-20">
                <SortableHeader column="shippingCost" label="Ship Cost" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2 w-24">
                <SortableHeader column="recommendedPrice" label="Recommend" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2 w-20 bg-muted/30">
                <SortableHeader column="mootAuto" label="MOOT Auto" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2 w-24 bg-amber-500/10">
                <span className="text-[10px] font-medium uppercase tracking-wider text-amber-500">MOOT Manual</span>
              </th>
              <th className="text-right px-3 py-2 w-20 bg-primary/10">
                <SortableHeader column="mootFinal" label="MOOT Final" className="justify-end text-primary" />
              </th>
              <th className="text-left px-3 py-2 w-32">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Reason</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                  No items to price. Select invoices to begin.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-mono text-[11px]">{item.partCode}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={item.partName}>{item.partName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.manufacturer}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{item.purchasePrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{item.weight}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{item.shippingCost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-medium">{item.recommendedPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums bg-muted/30">{item.mootAuto.toFixed(2)}</td>
                  <td className="px-3 py-2 bg-amber-500/10">
                    <Input
                      type="number"
                      value={item.mootManual ?? ""}
                      onChange={(e) => handleMootManualChange(item.id, e.target.value)}
                      placeholder="—"
                      className="h-6 w-full text-[11px] text-right font-mono border-amber-500/30 focus:border-amber-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold bg-primary/10 text-primary">
                    {item.mootFinal.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={item.mootReason}
                      onValueChange={(v) => handleMootReasonChange(item.id, v)}
                      disabled={item.mootManual === null}
                    >
                      <SelectTrigger className={cn(
                        "h-6 text-[10px]",
                        item.mootManual === null && "opacity-50"
                      )}>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOOT_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value} className="text-[10px]">
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ════════════════ BOTTOM: Summary & Actions ════════════════ */}
      <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Stats */}
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted-foreground">Items:</span>
              <span className="font-medium ml-1">{summaryStats.totalItems}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Shipping:</span>
              <span className="font-mono font-medium ml-1">{summaryStats.totalShippingCost.toLocaleString()} ₽</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total MOOT Value:</span>
              <span className="font-mono font-medium text-primary ml-1">{summaryStats.totalMootValue.toLocaleString()} ₽</span>
            </div>
            <div>
              <span className="text-muted-foreground">Manual Overrides:</span>
              <span className={cn(
                "font-medium ml-1",
                summaryStats.manualOverrideCount > 0 ? "text-amber-500" : "text-muted-foreground"
              )}>
                {summaryStats.manualOverrideCount}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetOverrides}
              disabled={summaryStats.manualOverrideCount === 0}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Overrides
            </Button>
            <Button
              size="sm"
              onClick={handleSavePricing}
              disabled={isSaving || !shipment}
              className="h-8 px-4 text-xs gap-1.5"
            >
              {isSaving ? (
                <Calculator className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Pricing
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
