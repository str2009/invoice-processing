"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ControlPanel } from "@/components/dashboard/control-panel"
import { InvoiceTable } from "@/components/dashboard/invoice-table"
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel"
import type { InvoiceRow, InvoiceListItem } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockLogs } from "@/lib/mock-data"
import { Input } from "@/components/ui/input"
import { PanelLeft, FileText, Search, Sun, Moon, BarChart3, MessageSquare, SlidersHorizontal, ChevronUp, ChevronDown, Monitor, Palette } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SimulationPanel } from "@/components/dashboard/simulation-panel"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useResizablePanel } from "@/hooks/use-resizable-panel"

type Status = "idle" | "processing" | "completed" | "error"

const statusConfig: Record<Status, { label: string; className: string }> = {
  idle: {
    label: "Idle",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  processing: {
    label: "Processing",
    className: "border-chart-3/40 bg-chart-3/15 text-chart-3",
  },
  completed: {
    label: "Completed",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  error: {
    label: "Error",
    className: "border-destructive/40 bg-destructive/15 text-destructive",
  },
}

export default function InvoiceDashboard() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { width: rightPanelWidth, handleProps: rightHandleProps } = useResizablePanel({
    storageKey: "invoiceRightPanelWidth",
    defaultWidth: 420,
    minWidth: 320,
    maxWidthPct: 50,
  })
  const [panelOpen, setPanelOpen] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [globalFilter, setGlobalFilter] = useState("")
  const [rowCount, setRowCount] = useState(0)
  const [selectedRow, setSelectedRow] = useState<InvoiceRow | null>(null)

  // Supabase invoice state
  const [invoiceList, setInvoiceList] = useState<InvoiceListItem[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isEnriched, setIsEnriched] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  // Bottom simulation panel state
  const [simPanelOpen, setSimPanelOpen] = useState(false)
  const [simPanelHeight, setSimPanelHeight] = useState(() => {
    if (typeof window === "undefined") return 40
    try {
      const saved = localStorage.getItem("invoiceBottomPanelHeight")
      if (saved) {
        const parsed = Number(saved)
        if (!Number.isNaN(parsed) && parsed >= 35 && parsed <= 65) return parsed
      }
    } catch { /* ignore */ }
    return 40
  })
  const simDragStartY = useRef<number | null>(null)
  const simDragStartH = useRef<number>(40)
  const simIsResizing = useRef(false)
  const DRAG_THRESHOLD = 5 // px of vertical movement before it counts as drag

  // Persist bottom panel height
  useEffect(() => {
    if (simPanelOpen) {
      try { localStorage.setItem("invoiceBottomPanelHeight", String(simPanelHeight)) } catch { /* ignore */ }
    }
  }, [simPanelHeight, simPanelOpen])

  const onSimPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    simDragStartY.current = e.clientY
    simDragStartH.current = simPanelHeight
    simIsResizing.current = false
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [simPanelHeight])

  const onSimPointerMove = useCallback((e: React.PointerEvent) => {
    if (simDragStartY.current === null) return
    const delta = Math.abs(e.clientY - simDragStartY.current)
    // Only start resizing after exceeding threshold
    if (!simIsResizing.current && delta < DRAG_THRESHOLD) return
    simIsResizing.current = true
    const deltaVh = ((simDragStartY.current - e.clientY) / window.innerHeight) * 100
    const next = Math.min(65, Math.max(35, simDragStartH.current + deltaVh))
    setSimPanelHeight(next)
    if (!simPanelOpen) setSimPanelOpen(true)
  }, [simPanelOpen])

  const onSimPointerUp = useCallback(() => {
    const wasResizing = simIsResizing.current
    simDragStartY.current = null
    simIsResizing.current = false
    // Only toggle if this was a click (no drag movement)
    if (!wasResizing) {
      setSimPanelOpen((prev) => !prev)
    }
  }, [])

  const toggleSimPanel = useCallback(() => {
    setSimPanelOpen((prev) => !prev)
  }, [])

  // Scenario pricing state
  const [scenarioData, setScenarioData] = useState<InvoiceRow[] | null>(null)
  const [isScenarioActive, setIsScenarioActive] = useState(false)

  const handleApplyScenario = useCallback((simulatedRows: InvoiceRow[]) => {
    setScenarioData(simulatedRows)
    setIsScenarioActive(true)
    setDataVersion((v) => v + 1)
  }, [])

  const handleResetScenario = useCallback(() => {
    setScenarioData(null)
    setIsScenarioActive(false)
    setDataVersion((v) => v + 1)
  }, [])

  // Data source: strictly from loaded invoice rows (no mock fallback)
  const baseData = rows
  const data = scenarioData ?? baseData
  const invoiceId = selectedInvoice

  // Map raw Supabase row to InvoiceRow shape
  const mapRow = useCallback((r: Record<string, unknown>, idx: number): InvoiceRow => ({
    id: String(r.id ?? idx + 1),
    partCode: (r.part_code as string) ?? (r.partCode as string) ?? "",
    manufacturer: (r.manufacturer as string) ?? "",
    partName: (r.part_name as string) ?? (r.partName as string) ?? "",
    qty: Number(r.qty ?? 0),
    cost: Number(r.cost ?? 0),
    now: Number(r.now ?? r.price_now ?? 0),
    ship: Number(r.ship ?? r.price_ship ?? 0),
    deltaPercent: Number(r.delta_percent ?? r.deltaPercent ?? 0),
    stock: Number(r.stock ?? 0),
    weight: Number(r.weight ?? 0),
    productGroup: (r.product_group as string) ?? (r.productGroup as string) ?? "",
    sales12m: Number(r.sales_12m ?? r.sales12m ?? 0),
  }), [])

  // Load invoice rows by ID
  // source: "raw" = invoice_rows (default, before enrich)
  // source: "enriched" = invoice_rows_enriched (after enrich)
  const loadInvoice = useCallback(async (invoiceId: string, source: "raw" | "enriched" = "raw") => {
    setIsLoadingInvoice(true)
    setScenarioData(null)
    setIsScenarioActive(false)
    try {
      console.log("SELECTED INVOICE ID:", invoiceId)
      const url = source === "enriched"
        ? `/api/invoice/${invoiceId}/enriched`
        : `/api/invoice/${invoiceId}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load invoice: ${res.status}`)
      const json = await res.json()
      // Raw route returns plain array; enriched GET returns { success, rows }
      const data = Array.isArray(json) ? json : (json.rows ?? [])
      const mapped: InvoiceRow[] = (data || []).map(mapRow)
      setRows(mapped)
      setIsEnriched(source === "enriched")
      setDataVersion((v) => v + 1)
    } catch {
      setRows([])
    } finally {
      setIsLoadingInvoice(false)
    }
  }, [mapRow])

  // Load invoice list on mount, select the latest one
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const res = await fetch("/api/invoice/list")
        if (!res.ok) return
        const data: InvoiceListItem[] = await res.json()
        setInvoiceList(data)
        if (data.length > 0) {
          setSelectedInvoice(data[0].invoice_id)
          loadInvoice(data[0].invoice_id)
        }
      } catch {
        // No invoices available — empty state
      }
    }
    loadInvoices()
  }, [loadInvoice])

  // Handle invoice selection change
  const handleInvoiceChange = useCallback(
    (invoiceId: string) => {
      setSelectedInvoice(invoiceId)
      setSelectedRow(null)
      setIsEnriched(false)
      loadInvoice(invoiceId, "raw")
    },
    [loadInvoice]
  )

  const totalPurchase = data.reduce((sum, row) => sum + row.cost * row.qty, 0)

  const analytics = {
    totalRows: data.length,
    parsedRows: data.length - 6,
    errors: 6,
    newItems: 8,
    updatedItems: 42,
  }

  const simulateParsing = useCallback(() => {
    setStatus("processing")
    setIsProcessing(true)
    setLogs([])
    setProgress(0)

    mockLogs.forEach((log, i) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, log])
        setProgress(Math.round(((i + 1) / mockLogs.length) * 100))
        if (i === mockLogs.length - 1) {
          setStatus("completed")
          setIsProcessing(false)
        }
      }, (i + 1) * 300)
    })
  }, [])

  const handleUploadFile = useCallback(async (file: File) => {
    setIsUploading(true)
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Uploading ${file.name} to webhook...`,
    ])

    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch(
        "https://max24vin.ru/webhook/invoice-upload",
        {
          method: "POST",
          body: formData,
        }
      )
      const text = await response.text()
      let result: Record<string, unknown> | null = null
      try {
        result = text ? JSON.parse(text) : null
      } catch {
        result = null
      }

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Upload complete (${response.status}). ${result ? JSON.stringify(result).slice(0, 120) : "No response body."}`,
      ])

      // Extract invoice_id from backend response and load rows
      const returnedId =
        (result?.invoice_id as string) ??
        (result?.invoiceId as string) ??
        // n8n may wrap in array: [{ invoice_id: "..." }]
        (Array.isArray(result) && result[0]?.invoice_id as string) ??
        null

      if (returnedId) {
        setSelectedInvoice(returnedId)
        await loadInvoice(returnedId)
        // Refresh the invoice list so the new entry appears in the dropdown
        try {
          const listRes = await fetch("/api/invoice/list")
          if (listRes.ok) {
            const listData: InvoiceListItem[] = await listRes.json()
            setInvoiceList(listData)
          }
        } catch {
          // Non-critical: list will refresh on next page load
        }
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Loaded invoice ${returnedId} — ${rows.length} rows.`,
        ])
      } else {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Warning: No invoice_id in response. Refresh the invoice list manually.`,
        ])
      }

      setStatus("completed")
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Error: Upload failed. ${err instanceof Error ? err.message : "Unknown error"}`,
      ])
      setStatus("error")
    } finally {
      setIsUploading(false)
    }
  }, [loadInvoice])

  const handleRefresh = useCallback(async () => {
    const ts = () => {
      const d = new Date()
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
    }
    const source = isEnriched ? "enriched" : "raw"
    setLogs((prev) => [...prev, `[${ts()}] Refreshing from ${source === "enriched" ? "invoice_rows_enriched" : "invoice_rows"}...`])
    setScenarioData(null)
    setIsScenarioActive(false)
    if (selectedInvoice) {
      await loadInvoice(selectedInvoice, source)
    }
    // Reset processing state
    setStatus("idle")
    setProgress(0)
    setIsProcessing(false)
    // Bump version to trigger table re-render with fresh base data
    setDataVersion((v) => v + 1)
    setLogs((prev) => [...prev, `[${ts()}] Refresh complete — all values recalculated from source.`])
  }, [isEnriched, selectedInvoice, loadInvoice])

  const handleEnrich = useCallback(async () => {
    if (!selectedInvoice) return
    setIsEnriching(true)
    const ts = () => new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${ts()}] Running data enrichment for ${selectedInvoice}...`])

    try {
      // POST to our API route which proxies the n8n webhook server-side
      const response = await fetch(`/api/invoice/${selectedInvoice}/enriched`, {
        method: "POST",
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? `Server responded with ${response.status}`)
      }

      const enrichedRows: Record<string, unknown>[] = result.rows ?? []

      setLogs((prev) => [
        ...prev,
        `[${ts()}] Enrichment complete. ${enrichedRows.length} rows received.`,
      ])

      // Map and display enriched rows
      const mapped: InvoiceRow[] = enrichedRows.map(mapRow)
      setRows(mapped)
      setIsEnriched(true)
      setDataVersion((v) => v + 1)

      setLogs((prev) => [
        ...prev,
        `[${ts()}] Showing enriched data — ${mapped.length} rows loaded.`,
      ])
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `[${ts()}] Error: Enrichment failed. ${err instanceof Error ? err.message : "Unknown error"}`,
      ])
    } finally {
      setIsEnriching(false)
    }
  }, [selectedInvoice, mapRow])

  const handleExport = useCallback(() => {
    if (data.length === 0) return
    const ts = () => {
      const d = new Date()
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
    }
    setLogs((prev) => [...prev, `[${ts()}] Exporting ${data.length} rows to Excel...`])
    // Build CSV content
    const headers = ["Part Number", "Description", "Cost", "Now", "Ship", "QTY", "Unit", "Total Purchase"]
    const csvRows = [
      headers.join(","),
      ...data.map((r) =>
        [
          `"${r.partNumber}"`,
          `"${(r.description ?? "").replace(/"/g, '""')}"`,
          r.cost,
          r.now,
          r.ship,
          r.qty,
          `"${r.unit}"`,
          r.totalPurchase,
        ].join(",")
      ),
    ]
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice-${selectedInvoice ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setLogs((prev) => [...prev, `[${ts()}] Export complete — ${data.length} rows saved.`])
  }, [data, selectedInvoice])

  const handleClear = useCallback(() => {
    const ts = () => {
      const d = new Date()
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
    }
    // Reset everything to empty state
    setRows([])
    setScenarioData(null)
    setIsScenarioActive(false)
    setSelectedInvoice(null)
    setIsEnriched(false)
    setStatus("idle")
    setProgress(0)
    setIsProcessing(false)
    setAnalytics({ totalRows: 0, parsedRows: 0, errors: 0, newItems: 0, updatedItems: 0 })
    setSelectedRow(null)
    setLogs([])
    setDataVersion((v) => v + 1)
  }, [])

  const handleRollback = useCallback(() => {
    setLogs((prev) => [...prev, "[10:26:00] Rolling back last operation..."])
    setTimeout(() => {
      setLogs((prev) => [...prev, "[10:26:01] Rollback complete."])
    }, 800)
  }, [])

  const handleRowClick = useCallback((row: InvoiceRow) => {
    setSelectedRow((prev) => (prev?.id === row.id ? null : row))
  }, [])

  const handleCloseAnalytics = useCallback(() => {
    setSelectedRow(null)
  }, [])

  // Close analytics panel if filter removes the selected row
  useEffect(() => {
    if (selectedRow && globalFilter) {
      const lowerFilter = globalFilter.toLowerCase()
      const match = Object.values(selectedRow).some((val) =>
        String(val).toLowerCase().includes(lowerFilter)
      )
      if (!match) setSelectedRow(null)
    }
  }, [globalFilter, selectedRow])

  // Saved mode: load rows for multiple selected invoices into table
  const handleWorkWithSelected = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setIsLoadingInvoice(true)
    setIsEnriched(false)
    const ts = () => new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${ts()}] Loading batch: ${ids.length} invoice(s)...`])
    try {
      const allRows: InvoiceRow[] = []
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/invoice/${id}`)
          if (!res.ok) return []
          const data = await res.json()
          return (Array.isArray(data) ? data : []).map(mapRow)
        })
      )
      results.forEach((r) => allRows.push(...r))
      setRows(allRows)
      setDataVersion((v) => v + 1)
      // Select the first invoice in the batch for header display
      if (ids.length === 1) setSelectedInvoice(ids[0])
      setLogs((prev) => [...prev, `[${ts()}] Batch loaded — ${allRows.length} rows from ${ids.length} invoice(s).`])
    } catch {
      setLogs((prev) => [...prev, `[${ts()}] Error: Failed to load batch.`])
    } finally {
      setIsLoadingInvoice(false)
    }
  }, [mapRow])

  const handleRecalculate = useCallback(async (ids: string[]) => {
    const ts = () => new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${ts()}] Recalculate requested for ${ids.length} invoice(s). (Not yet implemented)`])
  }, [])

  const handleUpdateMarket = useCallback(async (ids: string[]) => {
    const ts = () => new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${ts()}] Update market data requested for ${ids.length} invoice(s). (Not yet implemented)`])
  }, [])

  const { label, className } = statusConfig[status]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Control Panel Drawer */}
      <ControlPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        logs={logs}
        progress={progress}
        isProcessing={isProcessing}
        isUploading={isUploading}
        hasData={data.length > 0}
        onParseFile={simulateParsing}
        onUploadFile={handleUploadFile}
        onRefresh={handleRefresh}
        onEnrich={handleEnrich}
        onExport={handleExport}
        onClear={handleClear}
        analytics={analytics}
        invoiceList={invoiceList}
        selectedInvoice={selectedInvoice}
        onInvoiceChange={handleInvoiceChange}
        isLoadingInvoice={isLoadingInvoice}
        isEnriching={isEnriching}
        onWorkWithSelected={handleWorkWithSelected}
        onRecalculate={handleRecalculate}
        onUpdateMarket={handleUpdateMarket}
      />

      {/* Main Content - shifts right when panel is open */}
      <main
        className={`flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          panelOpen ? "ml-[360px]" : "ml-0"
        }`}
      >
        {/* Compact top bar - 3 sections: left fixed, middle flexible, right fixed */}
        <header className="flex h-10 shrink-0 items-center overflow-hidden border-b border-border px-3">
          {/* Left section: icon, title, status, row count */}
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
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <h1 className="whitespace-nowrap text-sm font-semibold text-foreground">
              Invoice Processing
            </h1>
            <Badge className={`shrink-0 whitespace-nowrap text-xs ${className}`}>{label}</Badge>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
            <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground">
              {rowCount} rows
            </span>
          </div>

          {/* Middle section: Invoice ID | Supplier | Total — grid layout */}
          <div className="mx-4 grid min-w-0 flex-1 grid-cols-[1fr_1fr_auto] items-center gap-8">
            {/* Invoice ID — text-only status color */}
            <span
              className={`min-w-0 truncate font-mono text-xs font-medium ${
                invoiceId
                  ? isEnriched
                    ? "text-emerald-400/70"
                    : "text-zinc-400"
                  : "text-muted-foreground/40"
              }`}
            >
              {invoiceId ?? "\u2014"}
            </span>
            {/* Supplier — plain truncated text */}
            <span className="min-w-0 truncate text-xs text-foreground/70">
              {(() => {
                const inv = invoiceList.find((i) => i.invoice_id === selectedInvoice)
                return inv?.supplier ?? ""
              })()}
            </span>
            {/* Total — right-aligned, fixed width */}
            <span className="w-28 text-right font-mono text-xs tabular-nums text-foreground/80">
              {data.length > 0
                ? totalPurchase.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "\u2014"}
            </span>
          </div>

          {/* Right section: nav + filter + theme toggle */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 gap-1.5 px-2 text-xs ${simPanelOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleSimPanel}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Simulation</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/analytics")}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Analytics</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/chat")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Chat</span>
            </Button>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
            <div className="relative w-36 shrink-0 xl:w-52">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter records..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  aria-label="Change theme"
                >
              {theme === "light" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : theme === "graphite" ? (
                <Monitor className="h-3.5 w-3.5" />
              ) : theme === "warm-dark" ? (
                <Moon className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className={`gap-2 text-xs ${theme === "light" ? "bg-accent" : ""}`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content area: vertical split - top (table+right panel) + bottom simulation panel */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Top section: table + right analytics panel */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Table takes remaining space */}
            <div className="min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out">
              <InvoiceTable
                key={dataVersion}
                data={data}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                onRowCountChange={setRowCount}
                selectedRowId={selectedRow?.id}
                onRowClick={handleRowClick}
              />
            </div>

            {/* Right analytics panel - pinned, resizable */}
            <div
              className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:w-[85vw] max-md:shadow-xl ${
                selectedRow ? "" : "w-0"
              }`}
              style={selectedRow ? { width: `${rightPanelWidth}px` } : undefined}
            >
              {selectedRow && (
                <div className="relative flex h-full w-full">
                  {/* Drag handle */}
                  <div
                    className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize border-l border-border bg-transparent transition-colors hover:bg-primary/20 active:bg-primary/30 max-md:hidden"
                    {...rightHandleProps}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize detail panel"
                  />
                  <AnalyticsPanel
                    row={selectedRow}
                    onClose={handleCloseAnalytics}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom simulation panel */}
          <div
            className="shrink-0 overflow-hidden border-t border-border bg-card"
            style={{
              height: simPanelOpen ? `${simPanelHeight}vh` : "28px",
              transition: simIsResizing.current ? "none" : "height 300ms ease-in-out",
            }}
          >
            {/* Drag handle / toggle bar */}
            <div
              className={`flex h-7 shrink-0 cursor-ns-resize items-center gap-2 px-4 transition-colors ${
                simPanelOpen
                  ? "border-b border-border bg-muted/30 hover:bg-muted/50"
                  : "bg-muted/20 hover:bg-muted/40"
              }`}
              onPointerDown={onSimPointerDown}
              onPointerMove={onSimPointerMove}
              onPointerUp={onSimPointerUp}
              onPointerCancel={() => {
                simDragStartY.current = null
                simIsResizing.current = false
              }}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Pricing & Simulation panel"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Pricing & Simulation
              </span>
              {isScenarioActive && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Scenario Active</span>
                </div>
              )}
              <div className="ml-auto">
                {simPanelOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
            {/* Panel content */}
            {simPanelOpen && (
              <div className="h-[calc(100%-28px)] overflow-hidden">
                <SimulationPanel
                  data={baseData}
                  onApplyScenario={handleApplyScenario}
                  onResetScenario={handleResetScenario}
                  isScenarioActive={isScenarioActive}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
