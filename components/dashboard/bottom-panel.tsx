"use client"

import { useState, useCallback, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Package, Calculator, GripHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { LogisticsManager, type ShipmentData } from "./logistics-manager"
import { PricingManager, type ShipmentSummary, type ItemPricing } from "./pricing-manager"
import type { InvoiceRow } from "@/lib/mock-data"

// ─── Props ───────────────────────────────────────────────────────────────────

interface BottomPanelProps {
  data: InvoiceRow[]
  invoiceIds: string[]
  onApplyScenario: (rows: InvoiceRow[]) => void
  onResetScenario: () => void
  isScenarioActive: boolean
  onSetSelectedInvoices?: (ids: string[]) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BottomPanel({
  data,
  invoiceIds,
  onApplyScenario,
  onResetScenario,
  isScenarioActive,
  onSetSelectedInvoices,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<"logistics" | "pricing">("logistics")
  const [panelHeight, setPanelHeight] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  
  // Shipment data shared between tabs
  const [activeShipment, setActiveShipment] = useState<ShipmentSummary | null>(null)

  // ─── Resizable Panel Logic ─────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight
      const newHeight = windowHeight - e.clientY
      // Clamp between 200 and 80% of window height
      setPanelHeight(Math.max(200, Math.min(newHeight, windowHeight * 0.8)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleShipmentSaved = useCallback((shipmentId: string, data: ShipmentData) => {
    // Convert ShipmentData to ShipmentSummary for pricing tab
    const cost = parseFloat(data.totalCost) || 0
    const weight = parseFloat(data.weight) || 0
    
    setActiveShipment({
      shipmentId,
      company: data.company,
      type: data.type,
      invoiceNumber: data.invoiceNumber,
      transportDate: data.transportDate,
      totalCost: cost,
      weight,
      costPerKgRaw: weight > 0 ? Math.round((cost / weight) * 100) / 100 : 0,
    })
  }, [])

  const handleSavePricing = useCallback((items: ItemPricing[]) => {
    // Apply pricing changes to rows
    const updatedRows = data.map(row => {
      const pricedItem = items.find(item => item.id === row.id)
      if (!pricedItem) return row
      
      return {
        ...row,
        now: pricedItem.mootFinal,
        ship: pricedItem.mootFinal * 1.055, // ~5.5% markup for ship price
        deltaPercent: Math.round(((pricedItem.mootFinal * 1.055 - pricedItem.mootFinal) / pricedItem.mootFinal) * 1000) / 10,
      }
    })
    
    onApplyScenario(updatedRows)
  }, [data, onApplyScenario])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-background border-t border-border"
      style={{ height: panelHeight }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "h-2 flex items-center justify-center cursor-ns-resize bg-muted/50 hover:bg-muted border-b border-border transition-colors group",
          isDragging && "bg-primary/20"
        )}
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "logistics" | "pricing")}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="shrink-0 w-full justify-start h-10 rounded-none border-b border-border bg-muted/30 px-4">
          <TabsTrigger
            value="logistics"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          >
            <Package className="h-4 w-4" />
            <span>Logistics Manager</span>
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          >
            <Calculator className="h-4 w-4" />
            <span>Pricing Manager</span>
            {isScenarioActive && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/20 text-amber-500 rounded">
                ACTIVE
              </span>
            )}
          </TabsTrigger>
          
          {/* Tab info */}
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            {activeTab === "logistics" ? (
              <span>Enter shipment details and attach invoices</span>
            ) : (
              <span>Set pricing mode and adjust MOOT values</span>
            )}
            <span className="font-mono">{invoiceIds.length} invoice(s) selected</span>
          </div>
        </TabsList>

        <TabsContent value="logistics" className="flex-1 m-0 overflow-hidden p-4">
          <LogisticsManager
            invoiceIds={invoiceIds}
            onShipmentSaved={handleShipmentSaved}
          />
        </TabsContent>

        <TabsContent value="pricing" className="flex-1 m-0 overflow-hidden">
          <PricingManager
            data={data}
            shipment={activeShipment}
            onSavePricing={handleSavePricing}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
