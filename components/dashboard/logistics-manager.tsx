"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plane, Ship, Anchor, Truck, Check, Link2, Plus, Lock, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShipmentData = {
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
  comment: string
  manager: string
}

export type ShipmentListItem = {
  shipment_id: string
  transport_company: string | null
  transport_invoice_number: string | null
  transport_date: string | null
  transport_type: string | null
}

export type ShipmentInvoice = {
  invoice_id: string
  supplier: string | null
  date: string | null
  amount: number | null
}

const EMPTY_SHIPMENT: ShipmentData = {
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
  comment: "",
  manager: "",
}

// ─── Icon Helper ─────────────────────────────────────────────────────────────

function getTransportIcon(type: string | null, isSelected: boolean) {
  const className = `h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`
  const t = type?.toLowerCase()
  
  if (t === "air") return <Plane className={className} />
  if (t === "sea") return <Ship className={className} />
  if (t === "river") return <Anchor className={className} />
  
  return <Truck className={className} />
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface LogisticsManagerProps {
  invoiceIds: string[]
  onShipmentSaved?: (shipmentId: string, data: ShipmentData) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LogisticsManager({ invoiceIds, onShipmentSaved }: LogisticsManagerProps) {
  // Form state
  const [formData, setFormData] = useState<ShipmentData>(EMPTY_SHIPMENT)
  const [status, setStatus] = useState<"draft" | "finalized">("draft")
  
  // Shipment list state
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [isLoadingShipments, setIsLoadingShipments] = useState(false)
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
  const [shipmentInvoices, setShipmentInvoices] = useState<ShipmentInvoice[]>([])
  const [isLoadingShipmentInvoices, setIsLoadingShipmentInvoices] = useState(false)
  const [shipmentFilter, setShipmentFilter] = useState<"all" | "unlinked" | "recent">("all")
  const [shipmentSearch, setShipmentSearch] = useState("")
  
  // Action states
  const [isSaving, setIsSaving] = useState(false)
  const [isAttaching, setIsAttaching] = useState(false)

  // Computed values
  const costPerKgRaw = useMemo(() => {
    const cost = parseFloat(formData.totalCost) || 0
    const weight = parseFloat(formData.weight) || 0
    if (weight === 0) return 0
    return Math.round((cost / weight) * 100) / 100
  }, [formData.totalCost, formData.weight])

  const densityAuto = useMemo(() => {
    const weight = parseFloat(formData.weight) || 0
    const volume = parseFloat(formData.volume) || 0
    if (volume === 0) return 0
    return Math.round((weight / volume) * 100) / 100
  }, [formData.weight, formData.volume])

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!formData.company) errors.push("Company is required")
    if (!formData.type) errors.push("Transport type is required")
    if (!formData.totalCost || parseFloat(formData.totalCost) <= 0) errors.push("Total cost must be > 0")
    if (!formData.weight || parseFloat(formData.weight) <= 0) errors.push("Weight must be > 0")
    return errors
  }, [formData])

  const isFormValid = validationErrors.length === 0

  // Filter shipments
  const filteredShipments = useMemo(() => {
    if (!shipmentSearch.trim()) return shipments
    const q = shipmentSearch.toLowerCase()
    return shipments.filter(s =>
      s.transport_company?.toLowerCase().includes(q) ||
      s.transport_invoice_number?.toString().toLowerCase().includes(q) ||
      s.transport_type?.toLowerCase().includes(q)
    )
  }, [shipments, shipmentSearch])

  // ─── Load Shipments ────────────────────────────────────────────────────────

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

  useEffect(() => {
    loadShipments(shipmentFilter)
  }, [shipmentFilter, loadShipments])

  // ─── Load Shipment Details ─────────────────────────────────────────────────

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
          setFormData({
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
            comment: details.comment || "",
            manager: "",
          })
          setStatus("finalized") // Existing shipments are finalized
        }

        // Load linked invoices
        const invoicesRes = await fetch(`/api/shipment/${selectedShipmentId}/invoices`)
        if (invoicesRes.ok) {
          const rawData = await invoicesRes.json()
          const invoices = Array.isArray(rawData) ? rawData : []
          setShipmentInvoices(invoices)
        }
      } catch (e) {
        console.error("Failed to load shipment data:", e)
      } finally {
        setIsLoadingShipmentInvoices(false)
      }
    }
    
    loadShipmentData()
  }, [selectedShipmentId])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleNewShipment = useCallback(() => {
    setSelectedShipmentId(null)
    setFormData(EMPTY_SHIPMENT)
    setShipmentInvoices([])
    setStatus("draft")
  }, [])

  const handleSaveShipment = useCallback(async () => {
    if (!isFormValid) return
    
    setIsSaving(true)
    const toastId = toast.loading("Saving shipment...")
    
    try {
      const res = await fetch("/api/shipment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transport_company: formData.company ?? null,
          transport_type: formData.type ?? null,
          transport_invoice_number: formData.invoiceNumber ?? null,
          transport_date: formData.transportDate ?? null,
          received_date: formData.receivedDate ?? null,
          total_shipping_cost: Number(formData.totalCost || 0),
          total_weight: Number(formData.weight || 0),
          total_volume: Number(formData.volume || 0),
          density: Number(formData.density || densityAuto || 0),
          packages_count: Number(formData.packages || 0),
          comment: formData.comment ?? null,
        }),
      })
      
      const json = await res.json()
      
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Failed to save shipment", { id: toastId })
        return
      }
      
      toast.success("Shipment saved", { id: toastId })
      setStatus("finalized")
      
      // Reload shipments and select the new one
      await loadShipments(shipmentFilter)
      if (json.shipment?.shipment_id) {
        setSelectedShipmentId(json.shipment.shipment_id)
        onShipmentSaved?.(json.shipment.shipment_id, formData)
      }
      
    } catch {
      toast.error("Failed to save shipment", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }, [isFormValid, formData, densityAuto, shipmentFilter, loadShipments, onShipmentSaved])

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

  const updateField = useCallback((field: keyof ShipmentData, value: string) => {
    if (status === "finalized") return
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [status])

  const isReadonly = status === "finalized"

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 h-full">
      {/* ════════════════ LEFT: Shipment Selector ════════════════ */}
      <div className="flex flex-col border border-border rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Shipments
            </span>
            {isLoadingShipments && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <Button variant="outline" size="sm" onClick={handleNewShipment} className="h-6 px-2 text-[10px]">
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
              className={cn(
                "flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
                shipmentFilter === filter
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="shrink-0 px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search..."
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
              className="w-full h-7 pl-7 pr-2 text-[11px] bg-muted/50 border border-border rounded-md placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Shipment list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
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
                  className={cn(
                    "flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                  )}
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
                      <span className={cn(
                        "px-1.5 py-0.5 text-[9px] font-medium uppercase rounded",
                        ship.transport_type.toLowerCase() === "air" ? "bg-sky-500/20 text-sky-400" :
                        ship.transport_type.toLowerCase() === "sea" ? "bg-blue-500/20 text-blue-400" :
                        ship.transport_type.toLowerCase() === "river" ? "bg-cyan-500/20 text-cyan-400" :
                        "bg-amber-500/20 text-amber-400"
                      )}>
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

        {/* Linked invoices */}
        {selectedShipmentId && (
          <div className="shrink-0 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Linked Invoices
              </span>
              {isLoadingShipmentInvoices ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <span className={cn(
                  "ml-auto font-mono text-[10px] tabular-nums",
                  shipmentInvoices.length > 0 ? "text-primary" : "text-muted-foreground/50"
                )}>
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
            
            <div className="max-h-20 overflow-y-auto">
              {shipmentInvoices.length === 0 && !isLoadingShipmentInvoices ? (
                <p className="px-3 py-2 text-center text-[10px] italic text-muted-foreground/40">
                  No invoices linked
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  {shipmentInvoices.slice(0, 3).map((inv) => (
                    <div key={inv.invoice_id} className="flex items-center gap-2 px-3 py-1">
                      <Check className="h-3 w-3 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">
                        {inv.invoice_id}
                      </span>
                    </div>
                  ))}
                  {shipmentInvoices.length > 3 && (
                    <div className="px-3 py-1 text-center text-[10px] text-muted-foreground/60">
                      +{shipmentInvoices.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>

            {invoiceIds.length > 0 && (
              <div className="border-t border-border/50 px-3 py-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAttaching}
                  onClick={handleAttachInvoices}
                  className="h-7 w-full gap-1.5 text-[10px]"
                >
                  {isAttaching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Attach {invoiceIds.length} invoice(s)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════ RIGHT: Shipment Form ════════════════ */}
      <div className="flex flex-col border border-border rounded-lg bg-card overflow-hidden">
        {/* Header with status */}
        <div className="shrink-0 flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {selectedShipmentId ? "Edit Shipment" : "New Shipment"}
            </span>
            {isReadonly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-medium uppercase">
                <Lock className="h-3 w-3" />
                Finalized
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Cost per kg (raw):</span>
            <span className="font-mono font-medium text-foreground">{costPerKgRaw.toFixed(2)} ₽</span>
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* ─── Column 1: Company & Transport ─── */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                Transport Details
              </h4>
              
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Company *</Label>
                <Select value={formData.company} onValueChange={(v) => updateField("company", v)} disabled={isReadonly}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aviamir">Aviamir</SelectItem>
                    <SelectItem value="cdek">CDEK</SelectItem>
                    <SelectItem value="boxberry">Boxberry</SelectItem>
                    <SelectItem value="pochtarossii">Pochta Rossii</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Type *</Label>
                <Select value={formData.type} onValueChange={(v) => updateField("type", v)} disabled={isReadonly}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="sea">Sea</SelectItem>
                    <SelectItem value="river">River</SelectItem>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="winter">Winter Road</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Invoice Number</Label>
                <Input
                  value={formData.invoiceNumber}
                  onChange={(e) => updateField("invoiceNumber", e.target.value)}
                  placeholder="e.g. INV-2024-001"
                  className="h-8 text-xs"
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Transport Date</Label>
                <Input
                  type="date"
                  value={formData.transportDate}
                  onChange={(e) => updateField("transportDate", e.target.value)}
                  className="h-8 text-xs"
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Received Date</Label>
                <Input
                  type="date"
                  value={formData.receivedDate}
                  onChange={(e) => updateField("receivedDate", e.target.value)}
                  className="h-8 text-xs"
                  disabled={isReadonly}
                />
              </div>
            </div>

            {/* ─── Column 2: Cost & Weight ─── */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                Cost & Weight
              </h4>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Total Cost * (₽)</Label>
                <Input
                  type="number"
                  value={formData.totalCost}
                  onChange={(e) => updateField("totalCost", e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs text-right font-mono"
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Packages</Label>
                <Input
                  type="number"
                  value={formData.packages}
                  onChange={(e) => updateField("packages", e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs text-right font-mono"
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Weight * (kg)</Label>
                <Input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs text-right font-mono"
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Volume (m³)</Label>
                <Input
                  type="number"
                  value={formData.volume}
                  onChange={(e) => updateField("volume", e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs text-right font-mono"
                  disabled={isReadonly}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Density (kg/m³)</Label>
                <Input
                  type="number"
                  value={formData.density || densityAuto.toFixed(2)}
                  onChange={(e) => updateField("density", e.target.value)}
                  placeholder="Auto"
                  className="h-8 text-xs text-right font-mono bg-muted/50"
                  disabled={isReadonly}
                />
              </div>

              {/* Cost per kg display */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cost per kg (raw)</span>
                  <span className="font-mono font-semibold text-primary">{costPerKgRaw.toFixed(2)} ₽</span>
                </div>
              </div>
            </div>

            {/* ─── Column 3: Manager & Notes ─── */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                Additional Info
              </h4>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Manager</Label>
                <Select value={formData.manager} onValueChange={(v) => updateField("manager", v)} disabled={isReadonly}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ivanov">Ivanov A.</SelectItem>
                    <SelectItem value="petrov">Petrov B.</SelectItem>
                    <SelectItem value="sidorov">Sidorov C.</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Comment</Label>
                <Textarea
                  value={formData.comment}
                  onChange={(e) => updateField("comment", e.target.value)}
                  placeholder="Notes about this shipment..."
                  className="h-24 text-xs resize-none"
                  disabled={isReadonly}
                />
              </div>

              {/* Validation errors */}
              {!isFormValid && status === "draft" && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <p className="text-[10px] font-medium uppercase text-destructive mb-1">Required fields:</p>
                  <ul className="space-y-0.5">
                    {validationErrors.map((err) => (
                      <li key={err} className="text-[10px] text-destructive/80">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {selectedShipmentId ? (
                <span>Editing shipment #{selectedShipmentId.slice(0, 8)}...</span>
              ) : (
                <span>Create a new shipment to attach invoices</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {status === "finalized" ? (
                <Button variant="outline" onClick={handleNewShipment} className="h-9 px-4 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  New Shipment
                </Button>
              ) : (
                <Button
                  onClick={handleSaveShipment}
                  disabled={!isFormValid || isSaving}
                  className="h-9 px-6 text-xs"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Shipment"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
