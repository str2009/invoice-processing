"use client"

import { useState, useMemo, useCallback } from "react"
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
import { Plus, Trash2, RotateCcw, Save, Play } from "lucide-react"
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
  onApplyScenario: (rows: InvoiceRow[]) => void
  onResetScenario: () => void
  isScenarioActive: boolean
}

export function SimulationPanel({
  data,
  onApplyScenario,
  onResetScenario,
  isScenarioActive,
}: SimulationPanelProps) {
  const [activeTab, setActiveTab] = useState("pricing")

  // Default vs Scenario pricing rules
  const [defaultRules, setDefaultRules] = useState<PricingRule[]>(DEFAULT_RULES)
  const [scenarioRules, setScenarioRules] = useState<PricingRule[]>(DEFAULT_RULES)

  // Confirmation dialog for save
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  // Shipping state
  const [costPerKgNormal, setCostPerKgNormal] = useState("8.50")
  const [costPerKgBulky, setCostPerKgBulky] = useState("12.00")
  const [totalDeliveryCost, setTotalDeliveryCost] = useState("450.00")
  const [distributionMethod, setDistributionMethod] = useState("weight")

  // Whether scenario differs from default
  const isModified = useMemo(
    () => !rulesEqual(scenarioRules, defaultRules),
    [scenarioRules, defaultRules]
  )

  // Live preview: recalculated data
  const previewData = useMemo(
    () => applyPricingRules(data, scenarioRules),
    [data, scenarioRules]
  )

  // Summary metrics
  const summary = useMemo(() => {
    const origTotal = data.reduce((s, r) => s + r.now * r.qty, 0)
    const origCostTotal = data.reduce((s, r) => s + r.cost * r.qty, 0)
    const newTotal = previewData.reduce((s, r) => s + r.now * r.qty, 0)
    const origMargin = origCostTotal > 0 ? ((origTotal - origCostTotal) / origTotal) * 100 : 0
    const newMargin = origCostTotal > 0 ? ((newTotal - origCostTotal) / newTotal) * 100 : 0
    const diff = newTotal - origTotal
    return { origTotal, newTotal, origMargin, newMargin, diff }
  }, [data, previewData])

  // Rule CRUD
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

  const removeRule = useCallback((id: string) => {
    setScenarioRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateRule = useCallback(
    (id: string, field: keyof PricingRule, value: string) => {
      setScenarioRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      )
    },
    []
  )

  // Actions
  const handleApply = useCallback(() => {
    onApplyScenario(previewData)
  }, [onApplyScenario, previewData])

  const handleReset = useCallback(() => {
    setScenarioRules([...defaultRules])
    onResetScenario()
  }, [defaultRules, onResetScenario])

  const handleSaveGlobal = useCallback(() => {
    // Save scenario as new defaults
    setDefaultRules([...scenarioRules])
    setShowSaveDialog(false)
    // Show success toast
    setShowSaveSuccess(true)
    setTimeout(() => setShowSaveSuccess(false), 3000)
    // Apply as current view
    onApplyScenario(previewData)
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
                        <SelectItem value="Standard" className="text-xs">Standard</SelectItem>
                        <SelectItem value="Premium" className="text-xs">Premium</SelectItem>
                        <SelectItem value="Economy" className="text-xs">Economy</SelectItem>
                        <SelectItem value="Bulk" className="text-xs">Bulk</SelectItem>
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
                  onClick={handleReset}
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
        <TabsContent value="shipping" className="mt-0 flex-1 overflow-auto p-4">
          <div className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Cost per kg (Normal)
              </label>
              <Input
                value={costPerKgNormal}
                onChange={(e) => setCostPerKgNormal(e.target.value)}
                className="h-8 font-mono text-xs"
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Cost per kg (Bulky)
              </label>
              <Input
                value={costPerKgBulky}
                onChange={(e) => setCostPerKgBulky(e.target.value)}
                className="h-8 font-mono text-xs"
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Delivery Cost
              </label>
              <Input
                value={totalDeliveryCost}
                onChange={(e) => setTotalDeliveryCost(e.target.value)}
                className="h-8 font-mono text-xs"
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Distribution Method
              </label>
              <Select value={distributionMethod} onValueChange={setDistributionMethod}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight" className="text-xs">By Weight</SelectItem>
                  <SelectItem value="quantity" className="text-xs">By Quantity</SelectItem>
                  <SelectItem value="value" className="text-xs">By Value</SelectItem>
                </SelectContent>
              </Select>
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
