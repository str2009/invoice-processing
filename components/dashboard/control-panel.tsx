"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileSpreadsheet,
  Play,
  RefreshCw,
  Sparkles,
  X,
  Loader2,
  Download,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Terminal,
  Upload,
  FolderOpen,
  SquareStack,
  Calculator,
  TrendingUp,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { InvoiceListItem } from "@/lib/mock-data"

interface ControlPanelProps {
  mode?: "invoice" | "analytics"
  isOpen: boolean
  onClose: () => void
  logs: string[]
  progress: number
  isProcessing: boolean
  isUploading: boolean
  hasData: boolean
  onParseFile: () => void
  onUploadFile: (file: File) => void
  onRefresh: () => void
  onEnrich: () => void
  onExport: () => void
  onClear: () => void
  analytics: {
    totalRows: number
    parsedRows: number
    errors: number
    newItems: number
    updatedItems: number
  }
  invoiceList: InvoiceListItem[]
  selectedInvoice: string | null
  onInvoiceChange: (invoiceId: string) => void
  isLoadingInvoice: boolean
  isEnriching: boolean
  contextMeta?: {
    totalRows: number
    avgMargin: number
    dateRange: string
  }
  /** Saved mode: called with selected invoice IDs to load merged batch */
  onWorkWithSelected?: (ids: string[]) => void
  /** Saved mode: recalculate costs for selected invoices */
  onRecalculate?: (ids: string[]) => void
  /** Saved mode: update market data for selected invoices */
  onUpdateMarket?: (ids: string[]) => void
}

export function ControlPanel({
  mode = "invoice",
  isOpen,
  onClose,
  logs,
  progress,
  isProcessing,
  isUploading,
  hasData,
  onUploadFile,
  onRefresh,
  onEnrich,
  onExport,
  onClear,
  analytics,
  invoiceList,
  selectedInvoice,
  onInvoiceChange,
  isLoadingInvoice,
  isEnriching,
  contextMeta,
  onWorkWithSelected,
  onRecalculate,
  onUpdateMarket,
}: ControlPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [logCollapsed, setLogCollapsed] = useState(false)
  // Panel tab: "upload" or "saved" (invoice mode only)
  const [panelTab, setPanelTab] = useState<"upload" | "saved">("upload")
  // Multi-select state for Saved Invoices mode
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) setFile(droppedFile)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) setFile(selectedFile)
    },
    []
  )

  const currentInvoice = invoiceList.find(
    (inv) => inv.invoice_id === selectedInvoice
  )

  // Multi-select helpers
  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(invoiceList.map((i) => i.invoice_id)))
  }, [invoiceList])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Dynamic summary for selected invoices
  const selectionSummary = useMemo(() => {
    const selected = invoiceList.filter((i) => selectedIds.has(i.invoice_id))
    return {
      count: selected.length,
      totalAmount: selected.reduce(
        (sum, inv) => sum + (inv.total_amount_document ?? 0),
        0
      ),
    }
  }, [invoiceList, selectedIds])

  const hasSelection = selectedIds.size > 0

  const formatTotal = (val: number | null) =>
    val != null
      ? Number(val).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "\u2014"

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[320px] flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Sticky Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Control Panel
        </span>
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

      {/* Mode switcher (invoice mode only) */}
      {mode === "invoice" && (
        <div className="shrink-0 border-b border-border px-4 py-2">
          <div className="flex h-7 rounded-md border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setPanelTab("upload")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-medium uppercase tracking-wider transition-colors ${
                panelTab === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("saved")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-medium uppercase tracking-wider transition-colors ${
                panelTab === "saved"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              <FolderOpen className="h-3 w-3" />
              Saved Invoices
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* UPLOAD MODE or ANALYTICS MODE                   */}
      {/* ═══════════════════════════════════════════════ */}
      {(mode === "analytics" || panelTab === "upload") && (
        <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-0 px-4 py-3">
            {/* 1. Context / Saved Invoices dropdown */}
            <section>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {mode === "analytics" ? "Context" : "Saved Invoices"}
                </span>
                {isLoadingInvoice && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <InvoiceSearchDropdown
                invoiceList={invoiceList}
                selectedInvoice={selectedInvoice}
                onInvoiceChange={onInvoiceChange}
                currentInvoice={currentInvoice}
                mode={mode}
                contextMeta={contextMeta}
              />
            </section>

            <div className="my-3 border-b border-border" />

            {/* 2. File Selection (upload mode only) */}
            {mode === "invoice" && (
              <section>
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Select Invoice File
                </span>
                <label
                  htmlFor="file-upload-drawer"
                  className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-2 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-transparent hover:border-muted-foreground/30 hover:bg-muted/10"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground/60">
                    Drop CSV/XLSX or click
                  </span>
                  <input
                    id="file-upload-drawer"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="sr-only"
                    onChange={handleFileSelect}
                  />
                </label>
                {file && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3 w-3 shrink-0 text-primary" />
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {file.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/40">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove file"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* 3. Action Button Grid */}
            <section className="mt-3">
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </span>
              <div className="grid grid-cols-2 gap-3">
                {/* Process — only in upload mode */}
                {mode === "invoice" && (
                  <Button
                    size="sm"
                    onClick={() => file && onUploadFile(file)}
                    disabled={!file || isUploading || isProcessing}
                    className="h-8 gap-1.5 rounded-md px-3 text-[11px]"
                  >
                    <Play className="h-3 w-3 shrink-0" />
                    {isUploading ? "Processing..." : "Process"}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={onEnrich}
                  disabled={isEnriching || !hasData}
                  className="h-8 gap-1.5 rounded-md px-3 text-[11px]"
                >
                  {isEnriching ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 shrink-0" />
                  )}
                  {isEnriching ? "Enriching..." : "Enrich"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={!hasData}
                  className="h-8 gap-1.5 rounded-md px-3 text-[11px]"
                >
                  <RefreshCw className="h-3 w-3 shrink-0" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClear}
                  disabled={!hasData}
                  className="h-8 gap-1.5 rounded-md px-3 text-[11px] text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 shrink-0" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExport}
                  disabled={!hasData}
                  className="h-8 gap-1.5 rounded-md border-emerald-600/30 px-3 text-[11px] text-emerald-700 hover:bg-emerald-600/10 hover:text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                >
                  <Download className="h-3 w-3 shrink-0" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="h-8 gap-1.5 rounded-md px-3 text-[11px]"
                >
                  <SlidersHorizontal className="h-3 w-3 shrink-0" />
                  Simulate
                </Button>
              </div>
            </section>

            {/* Invoice upload mode: Progress + Log + Summary */}
            {mode === "invoice" && (
              <>
                <div className="my-3 border-b border-border" />

                {/* Progress */}
                <section>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Progress
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-foreground">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-1" />
                </section>

                <div className="my-3 border-b border-border" />

                {/* Processing Log */}
                <section>
                  <button
                    type="button"
                    onClick={() => setLogCollapsed((p) => !p)}
                    className="mb-1 flex w-full items-center gap-1 text-left"
                  >
                    <Terminal className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Log
                    </span>
                    {logCollapsed ? (
                      <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground/40" />
                    ) : (
                      <ChevronUp className="ml-auto h-3 w-3 text-muted-foreground/40" />
                    )}
                  </button>
                  {!logCollapsed && (
                    <ScrollArea className="h-[100px] rounded border border-border bg-background/50 px-2.5 py-1.5">
                      <div className="flex flex-col gap-px">
                        {logs.length === 0 ? (
                          <p className="text-[10px] italic text-muted-foreground/30">
                            Waiting for input...
                          </p>
                        ) : (
                          logs.map((log, i) => (
                            <p
                              key={i}
                              className={`font-mono text-[10px] leading-relaxed ${
                                log.includes("error") || log.includes("Error")
                                  ? "text-destructive"
                                  : log.includes("complete") || log.includes("OK")
                                    ? "text-primary"
                                    : "text-muted-foreground/70"
                              }`}
                            >
                              {log}
                            </p>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </section>

                <div className="my-3 border-b border-border" />

                {/* Summary Stats */}
                <section>
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Summary
                  </span>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                    <StatItem label="Rows" value={analytics.totalRows} />
                    <StatItem label="Parsed" value={analytics.parsedRows} />
                    <StatItem
                      label="Errors"
                      value={analytics.errors}
                      variant="destructive"
                    />
                    <StatItem
                      label="New"
                      value={analytics.newItems}
                      variant="info"
                    />
                    <StatItem
                      label="Updated"
                      value={analytics.updatedItems}
                      variant="success"
                    />
                  </div>
                </section>
              </>
            )}

            {/* Analytics mode: Analytics Settings */}
            {mode === "analytics" && (
              <>
                <div className="my-3 border-b border-border" />
                <AnalyticsSettings />
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* SAVED INVOICES MODE                             */}
      {/* ═══════════════════════════════════════════════ */}
      {mode === "invoice" && panelTab === "saved" && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Top controls */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-6 px-2 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={!hasSelection}
              className="h-6 px-2 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Clear Selection
            </Button>
            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/50">
              {invoiceList.length} total
            </span>
          </div>

          {/* Scrollable invoice list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {invoiceList.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11px] italic text-muted-foreground/40">
                No saved invoices found
              </p>
            ) : (
              invoiceList.map((inv) => {
                const isChecked = selectedIds.has(inv.invoice_id)
                return (
                  <button
                    key={inv.invoice_id}
                    type="button"
                    onClick={() => toggleId(inv.invoice_id)}
                    className={`flex w-full items-start gap-2.5 border-b border-border/40 px-4 py-2 text-left transition-colors ${
                      isChecked
                        ? "bg-accent/30"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex h-4 shrink-0 items-center pt-0.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleId(inv.invoice_id)}
                        className="h-3.5 w-3.5 rounded-[3px] border-muted-foreground/30"
                      />
                    </div>
                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 truncate font-mono text-[11px] font-medium leading-tight text-foreground">
                          {inv.invoice_id}
                        </span>
                        {/* Status — text only */}
                        <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                          raw
                        </span>
                      </div>
                      <span className="min-w-0 truncate text-[10px] leading-tight text-muted-foreground/70">
                        {inv.supplier ?? "No supplier"}
                      </span>
                    </div>
                    {/* Amount */}
                    <span className="shrink-0 pt-0.5 font-mono text-[10px] tabular-nums leading-tight text-muted-foreground/60">
                      {formatTotal(inv.total_amount_document)}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Sticky summary + actions footer */}
          <div className="shrink-0 border-t border-border bg-card px-4 py-3">
            {/* Dynamic summary */}
            <div className="mb-3">
              {hasSelection ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Selected
                    </span>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                      {selectionSummary.count}{" "}
                      <span className="font-normal text-muted-foreground">
                        invoice{selectionSummary.count !== 1 ? "s" : ""}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-muted-foreground/60">
                      Total amount
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-foreground">
                      {formatTotal(selectionSummary.totalAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-[10px] italic text-muted-foreground/40">
                  No invoices selected
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                disabled={!hasSelection}
                onClick={() =>
                  onWorkWithSelected?.(Array.from(selectedIds))
                }
                className="h-8 w-full gap-1.5 text-[11px]"
              >
                <SquareStack className="h-3 w-3 shrink-0" />
                Work With Selected
              </Button>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasSelection}
                  onClick={() =>
                    onRecalculate?.(Array.from(selectedIds))
                  }
                  className="h-7 gap-1.5 text-[10px]"
                >
                  <Calculator className="h-3 w-3 shrink-0" />
                  Recalculate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasSelection}
                  onClick={() =>
                    onUpdateMarket?.(Array.from(selectedIds))
                  }
                  className="h-7 gap-1.5 text-[10px]"
                >
                  <TrendingUp className="h-3 w-3 shrink-0" />
                  Update Market
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

/* ─── Analytics Settings Panel ─── */

function AnalyticsSettings() {
  const [warehouse, setWarehouse] = useState("main")
  const [calcMode, setCalcMode] = useState("automatic")
  const [demandMode, setDemandMode] = useState("current")

  const [currency, setCurrency] = useState("USD")
  const [onlyMZ, setOnlyMZ] = useState(false)
  const [onlyStock, setOnlyStock] = useState(false)
  const [supplier, setSupplier] = useState("all")
  const [scopeAnalogs, setScopeAnalogs] = useState(true)
  const [scopeOriginals, setScopeOriginals] = useState(true)
  const [scopeSynonyms, setScopeSynonyms] = useState(false)
  const [scopeWeb, setScopeWeb] = useState(false)
  const [priority, setPriority] = useState("price")

  const [periodFrom, setPeriodFrom] = useState("")
  const [periodTo, setPeriodTo] = useState("")
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [company, setCompany] = useState("all")
  const [group, setGroup] = useState("all")
  const [salesWarehouse, setSalesWarehouse] = useState("all")
  const [mzTz, setMzTz] = useState("mz")
  const [aggregation, setAggregation] = useState("monthly")
  const [totals, setTotals] = useState("sum")

  return (
    <section>
      <span className="mb-3 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Analytics Settings
      </span>

      {/* A) Stock & Reorder */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Stock & Reorder</SectionLabel>
        <FieldRow label="Warehouse">
          <MiniSelect value={warehouse} onValueChange={setWarehouse}>
            <SelectItem value="main">Main Warehouse</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="transit">In Transit</SelectItem>
            <SelectItem value="all">All Warehouses</SelectItem>
          </MiniSelect>
        </FieldRow>
        <FieldRow label="Calculation Mode">
          <RadioGroup value={calcMode} onValueChange={setCalcMode} className="flex flex-col gap-1">
            <RadioOption value="automatic" label="Automatic" />
            <RadioOption value="product_card" label="From product card" />
          </RadioGroup>
        </FieldRow>
        <FieldRow label="Demand Mode">
          <RadioGroup value={demandMode} onValueChange={setDemandMode} className="flex flex-col gap-1">
            <RadioOption value="current" label="Current season" />
            <RadioOption value="high" label="High demand" />
            <RadioOption value="low" label="Low demand" />
          </RadioGroup>
        </FieldRow>
      </div>

      <div className="my-3 border-b border-border/50" />

      {/* B) Pricing */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Pricing</SectionLabel>
        <FieldRow label="Currency">
          <MiniSelect value={currency} onValueChange={setCurrency}>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="UAH">UAH</SelectItem>
            <SelectItem value="RUB">RUB</SelectItem>
          </MiniSelect>
        </FieldRow>
        <div className="flex flex-col gap-1.5 pl-0.5">
          <MiniCheckbox checked={onlyMZ} onCheckedChange={(v) => setOnlyMZ(!!v)} label="Only items with MZ > 0" />
          <MiniCheckbox checked={onlyStock} onCheckedChange={(v) => setOnlyStock(!!v)} label="Only items with stock <= TZ" />
        </div>
        <FieldRow label="Supplier">
          <MiniSelect value={supplier} onValueChange={setSupplier}>
            <SelectItem value="all">All Suppliers</SelectItem>
            <SelectItem value="supplier_a">Supplier A</SelectItem>
            <SelectItem value="supplier_b">Supplier B</SelectItem>
            <SelectItem value="supplier_c">Supplier C</SelectItem>
          </MiniSelect>
        </FieldRow>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground/60">Search Scope</span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pl-0.5 pt-0.5">
            <MiniCheckbox checked={scopeAnalogs} onCheckedChange={(v) => setScopeAnalogs(!!v)} label="Analogs" />
            <MiniCheckbox checked={scopeOriginals} onCheckedChange={(v) => setScopeOriginals(!!v)} label="Originals" />
            <MiniCheckbox checked={scopeSynonyms} onCheckedChange={(v) => setScopeSynonyms(!!v)} label="Synonyms" />
            <MiniCheckbox checked={scopeWeb} onCheckedChange={(v) => setScopeWeb(!!v)} label="Web analogs" />
          </div>
        </div>
        <FieldRow label="Priority">
          <MiniSelect value={priority} onValueChange={setPriority}>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="delivery">Delivery Time</SelectItem>
            <SelectItem value="quality">Quality Rating</SelectItem>
            <SelectItem value="stock">Stock Availability</SelectItem>
          </MiniSelect>
        </FieldRow>
      </div>

      <div className="my-3 border-b border-border/50" />

      {/* C) Sales Analysis */}
      <div className="flex flex-col gap-2.5 pb-2">
        <SectionLabel>Sales Analysis</SectionLabel>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground/60">Period</span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={periodFrom}
              max={todayStr}
              onChange={(e) => {
                const v = e.target.value
                if (v && v > todayStr) return
                setPeriodFrom(v)
              }}
              className="h-7 flex-1 rounded border-border bg-transparent px-2 text-[11px] text-foreground"
            />
            <span className="text-[10px] text-muted-foreground/40">{"\u2014"}</span>
            <Input
              type="date"
              value={periodTo}
              max={todayStr}
              onChange={(e) => {
                const v = e.target.value
                if (v && v > todayStr) return
                setPeriodTo(v)
              }}
              className="h-7 flex-1 rounded border-border bg-transparent px-2 text-[11px] text-foreground"
            />
          </div>
        </div>
        <FieldRow label="Companies">
          <MiniSelect value={company} onValueChange={setCompany}>
            <SelectItem value="all">All Companies</SelectItem>
            <SelectItem value="company_a">Company A</SelectItem>
            <SelectItem value="company_b">Company B</SelectItem>
          </MiniSelect>
        </FieldRow>
        <FieldRow label="Groups">
          <MiniSelect value={group} onValueChange={setGroup}>
            <SelectItem value="all">All Groups</SelectItem>
            <SelectItem value="group_a">Group A</SelectItem>
            <SelectItem value="group_b">Group B</SelectItem>
            <SelectItem value="group_c">Group C</SelectItem>
          </MiniSelect>
        </FieldRow>
        <FieldRow label="Warehouse">
          <MiniSelect value={salesWarehouse} onValueChange={setSalesWarehouse}>
            <SelectItem value="all">All Warehouses</SelectItem>
            <SelectItem value="main">Main</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
          </MiniSelect>
        </FieldRow>
        <FieldRow label="MZ / TZ">
          <MiniSelect value={mzTz} onValueChange={setMzTz}>
            <SelectItem value="mz">MZ (Min Stock)</SelectItem>
            <SelectItem value="tz">TZ (Target Stock)</SelectItem>
            <SelectItem value="both">MZ + TZ</SelectItem>
          </MiniSelect>
        </FieldRow>
        <FieldRow label="Aggregation">
          <MiniSelect value={aggregation} onValueChange={setAggregation}>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </MiniSelect>
        </FieldRow>
        <FieldRow label="Totals">
          <MiniSelect value={totals} onValueChange={setTotals}>
            <SelectItem value="sum">Sum</SelectItem>
            <SelectItem value="avg">Average</SelectItem>
            <SelectItem value="median">Median</SelectItem>
            <SelectItem value="max">Maximum</SelectItem>
            <SelectItem value="min">Minimum</SelectItem>
          </MiniSelect>
        </FieldRow>
      </div>
    </section>
  )
}

/* ─── Tiny reusable layout primitives ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
      {children}
    </span>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      {children}
    </div>
  )
}

function MiniSelect({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-7 w-full rounded border-border bg-transparent px-2 text-[11px] text-foreground [&>svg]:h-3 [&>svg]:w-3">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="text-[11px]">
        {children}
      </SelectContent>
    </Select>
  )
}

function MiniCheckbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (v: boolean | "indeterminate") => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="h-3 w-3 rounded-[2px] border-muted-foreground/30"
      />
      <span className="text-[10px] leading-none text-muted-foreground/70">{label}</span>
    </label>
  )
}

function RadioOption({ value, label }: { value: string; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <RadioGroupItem value={value} className="h-3 w-3 border-muted-foreground/30" />
      <span className="text-[10px] leading-none text-muted-foreground/70">{label}</span>
    </label>
  )
}

/* ─── Searchable Invoice Dropdown (inline, no overlay) ─── */

function InvoiceSearchDropdown({
  invoiceList,
  selectedInvoice,
  onInvoiceChange,
  currentInvoice,
  mode = "invoice",
  contextMeta,
}: {
  invoiceList: InvoiceListItem[]
  selectedInvoice: string | null
  onInvoiceChange: (id: string) => void
  currentInvoice: InvoiceListItem | undefined
  mode?: "invoice" | "analytics"
  contextMeta?: { totalRows: number; avgMargin: number; dateRange: string }
}) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  const filtered = useMemo(() => {
    if (!query.trim()) return invoiceList
    const q = query.toLowerCase()
    return invoiceList.filter((inv) => {
      const id = inv.invoice_id.toLowerCase()
      const supplier = (inv.supplier ?? "").toLowerCase()
      const total = inv.total_amount_document != null ? String(inv.total_amount_document) : ""
      const date = inv.created_at.toLowerCase()
      return id.includes(q) || supplier.includes(q) || total.includes(q) || date.includes(q)
    })
  }, [invoiceList, query])

  useEffect(() => {
    if (expanded && contentRef.current) {
      const measure = () => {
        if (contentRef.current) setContentHeight(contentRef.current.scrollHeight)
      }
      measure()
      const raf = requestAnimationFrame(measure)
      return () => cancelAnimationFrame(raf)
    }
  }, [expanded, filtered.length])

  useEffect(() => { setHighlightIdx(0) }, [filtered.length, query])

  useEffect(() => {
    if (expanded) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      setQuery("")
      setHighlightIdx(0)
    }
  }, [expanded])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`)
    if (item) item.scrollIntoView({ block: "nearest" })
  }, [highlightIdx])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = filtered[highlightIdx]
        if (item) {
          onInvoiceChange(item.invoice_id)
          setExpanded(false)
        }
      } else if (e.key === "Escape") {
        setExpanded(false)
      }
    },
    [filtered, highlightIdx, onInvoiceChange]
  )

  const formatTotal = (val: number | null) =>
    val != null
      ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "\u2014"

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  if (invoiceList.length === 0) {
    return <p className="py-2 text-[11px] italic text-muted-foreground/40">No saved invoices found</p>
  }

  const maxExpandedHeight = 280
  const animatedHeight = Math.min(contentHeight, maxExpandedHeight)

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className={`flex w-full items-start justify-between rounded-md border px-3 py-2 text-left transition-colors ${
          expanded
            ? "rounded-b-none border-border bg-muted/20"
            : "border-input bg-transparent hover:border-muted-foreground/40 hover:bg-muted/10"
        }`}
        aria-expanded={expanded}
      >
        {currentInvoice ? (
          <div className="flex min-w-0 flex-col gap-0.5 pr-2">
            <span className="truncate font-mono text-[11px] font-semibold leading-tight text-foreground">
              {currentInvoice.invoice_id}
              {mode === "analytics" && currentInvoice.supplier ? ` / ${currentInvoice.supplier}` : ""}
            </span>
            <span className="truncate text-[11px] leading-tight text-muted-foreground">
              {currentInvoice.supplier ?? "No supplier"}
            </span>
            {mode === "analytics" && contextMeta ? (
              <>
                <span className="text-[10px] tabular-nums leading-tight text-muted-foreground/60">
                  {formatTotal(currentInvoice.total_amount_document)}
                  {" \u00b7 "}
                  {contextMeta.totalRows} rows
                  {" \u00b7 "}
                  {contextMeta.avgMargin.toFixed(1)}% margin
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground/50">
                  {contextMeta.dateRange}
                </span>
              </>
            ) : (
              <span className="text-[10px] tabular-nums leading-tight text-muted-foreground/60">
                {formatTotal(currentInvoice.total_amount_document)}
                {" \u00b7 "}
                {formatDate(currentInvoice.created_at)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">
            {mode === "analytics" ? "Select context..." : "Select invoice..."}
          </span>
        )}
        <ChevronDown
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className="overflow-hidden transition-[height] duration-200 ease-in-out"
        style={{ height: expanded ? `${animatedHeight}px` : "0px" }}
      >
        <div ref={contentRef} className="rounded-b-md border border-t-0 border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <Search className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="h-5 w-full bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); inputRef.current?.focus() }}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground/40 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto overscroll-contain py-0.5"
            style={{ maxHeight: `${maxExpandedHeight - 34}px` }}
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-[11px] italic text-muted-foreground/40">No invoices match</p>
            ) : (
              filtered.map((inv, idx) => {
                const isSelected = inv.invoice_id === selectedInvoice
                const isHighlighted = idx === highlightIdx
                return (
                  <button
                    key={inv.invoice_id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-idx={idx}
                    className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                      isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                    }`}
                    onClick={() => { onInvoiceChange(inv.invoice_id); setExpanded(false) }}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-mono text-[11px] font-semibold leading-tight text-foreground">
                        {inv.invoice_id}
                      </span>
                      <span className="truncate text-[11px] leading-tight text-muted-foreground">
                        {inv.supplier ?? "No supplier"}
                      </span>
                      <span className="text-[10px] tabular-nums leading-tight text-muted-foreground/60">
                        {formatTotal(inv.total_amount_document)}
                        {" \u00b7 "}
                        {formatDate(inv.created_at)}
                      </span>
                    </div>
                    {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatItem({
  label,
  value,
  variant = "default",
}: {
  label: string
  value: number
  variant?: "default" | "destructive" | "info" | "success"
}) {
  const valueColors = {
    default: "text-foreground",
    destructive: "text-destructive",
    info: "text-chart-2",
    success: "text-primary",
  }

  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      <span className={`font-mono text-[11px] font-semibold tabular-nums ${valueColors[variant]}`}>
        {value}
      </span>
    </div>
  )
}
