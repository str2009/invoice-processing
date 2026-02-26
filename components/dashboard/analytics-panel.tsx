"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Package, TrendingUp, Warehouse, Weight, BarChart3 } from "lucide-react"
import type { InvoiceRow } from "@/lib/mock-data"

interface AnalyticsPanelProps {
  row: InvoiceRow
  onClose: () => void
}

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

export function AnalyticsPanel({ row, onClose }: AnalyticsPanelProps) {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const margin = row.now > 0 ? ((row.now - row.cost) / row.now) * 100 : 0
  const totalValue = row.cost * row.qty
  const shipDelta = row.ship > 0 && row.now > 0 ? ((row.ship - row.now) / row.now) * 100 : null

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Part analytics"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Part Details</h2>
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

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          {/* Identity */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Identity
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="font-mono text-sm font-semibold text-foreground">
                {row.partCode}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.manufacturer}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
                {row.partName}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {row.productGroup}
              </p>
            </div>
          </div>

          {/* Pricing */}
          <div>
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
                className={
                  row.ship === 0
                    ? "text-muted-foreground/40"
                    : row.ship > row.now
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                }
              />
              <div className="border-t border-border/50" />
              <InfoRow
                label="Margin"
                value={`${margin.toFixed(1)}%`}
                className={
                  margin > 40
                    ? "text-emerald-600 dark:text-emerald-400"
                    : margin > 20
                      ? "text-foreground"
                      : "text-amber-600 dark:text-amber-400"
                }
              />
              {shipDelta !== null && (
                <>
                  <div className="border-t border-border/50" />
                  <InfoRow
                    label="Ship vs Now"
                    value={`${shipDelta > 0 ? "+" : ""}${shipDelta.toFixed(1)}%`}
                    className={
                      shipDelta > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  />
                </>
              )}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
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
                className={row.stock < 20 ? "text-amber-600 dark:text-amber-400" : ""}
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

          {/* Physical */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Physical
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
              <InfoRow label="Weight" value={`${row.weight.toFixed(1)} kg`} />
              <div className="border-t border-border/50" />
              <InfoRow
                label="Total weight"
                value={`${(row.weight * row.qty).toFixed(1)} kg`}
              />
            </div>
          </div>

          {/* Sales */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sales
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
              <InfoRow label="12-month sales" value={row.sales12m.toLocaleString()} />
              <div className="border-t border-border/50" />
              <InfoRow
                label="Monthly avg"
                value={Math.round(row.sales12m / 12).toLocaleString()}
              />
              {row.stock > 0 && row.sales12m > 0 && (
                <>
                  <div className="border-t border-border/50" />
                  <InfoRow
                    label="Stock coverage"
                    value={`${((row.stock / (row.sales12m / 12)) * 30).toFixed(0)} days`}
                    className={
                      (row.stock / (row.sales12m / 12)) * 30 < 30
                        ? "text-amber-600 dark:text-amber-400"
                        : ""
                    }
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
