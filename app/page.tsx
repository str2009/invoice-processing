"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Columns } from "lucide-react"
import { ControlPanel } from "@/components/dashboard/control-panel"
import { InvoiceTable } from "@/components/dashboard/invoice-table"
import { PartDetailsPanel } from "@/components/PartDetailsPanel"
import type { InvoiceRow, InvoiceListItem } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockLogs } from "@/lib/mock-data"
import { Input } from "@/components/ui/input"
import { PanelLeft, FileText, Search, Sun, Moon, BarChart3, MessageSquare, SlidersHorizontal, ChevronUp, ChevronDown, Monitor, Palette, Maximize2, Minimize2, Settings2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  const [mounted, setMounted] = useState(false)
  
  // Workspace display settings
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable")
  const [uiScale, setUiScale] = useState<"90" | "100" | "110">("100")

useEffect(() => {
  setMounted(true)
  // Load workspace settings from localStorage
  const savedDensity = localStorage.getItem("workspace_density")
  const savedScale = localStorage.getItem("workspace_ui_scale")
  if (savedDensity === "comfortable" || savedDensity === "compact") {
    setDensity(savedDensity)
  }
  if (savedScale === "90" || savedScale === "100" || savedScale === "110") {
    setUiScale(savedScale)
  }
}, [])

  // Persist workspace settings
  const handleDensityChange = useCallback((value: "comfortable" | "compact") => {
    setDensity(value)
    localStorage.setItem("workspace_density", value)
  }, [])

  const handleScaleChange = useCallback((value: "90" | "100" | "110") => {
    setUiScale(value)
    localStorage.setItem("workspace_ui_scale", value)
  }, [])
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
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  
  // Shipment selection state (synced from SimulationPanel)
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
  const toggleInvoice = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    )
  }
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isEnriched, setIsEnriched] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  // Bottom simulation panel state
const [simPanelOpen, setSimPanelOpen] = useState(false)
const [simPanelHeight, setSimPanelHeight] = useState(40)

// Load saved height AFTER mount (avoids hydration mismatch)
useEffect(() => {
  try {
    const saved = localStorage.getItem("invoiceBottomPanelHeight")
    if (saved) {
      const parsed = Number(saved)
      if (!Number.isNaN(parsed) && parsed >= 35 && parsed <= 65) {
        setSimPanelHeight(parsed)
      }
    }
  } catch {
    // ignore
  }
}, [])
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

  // Count items with zero weight for warning indicator
  const zeroWeightCount = useMemo(() => {
    return data.filter((row) => row.weight === 0 || row.weight === null || row.weight === undefined).length
  }, [data])

  // Count items with corrected part codes
  const fixedCodeCount = useMemo(() => {
    return data.filter((row) => row.part_code_fixed === true).length
  }, [data])

  // Track previous fixedCodeCount to avoid duplicate logs
  const prevFixedCountRef = useRef<number>(0)
  
  // Log warning when data loads with fixed part codes
  useEffect(() => {
    if (fixedCodeCount > 0 && fixedCodeCount !== prevFixedCountRef.current) {
      const ts = new Date().toLocaleTimeString()
      setLogs((prev) => [...prev, `[${ts}] [WARNING] ${fixedCodeCount} positions: part_code corrected`])
    }
    prevFixedCountRef.current = fixedCodeCount
  }, [fixedCodeCount])
  const invoiceId = selectedInvoice
  
  // Table readiness: show data when invoice is selected OR when we have enriched multi-invoice data
  const isTableReady = Boolean((selectedInvoice && data.length > 0) || (isEnriched && data.length > 0))
  const safeData = isTableReady ? data : []

  // Map raw Supabase row to InvoiceRow shape
  const mapRow = useCallback((r: Record<string, unknown>, idx: number): InvoiceRow => ({
    id: String(r.id ?? idx + 1),
    partCode: (r.part_code as string) ?? (r.partCode as string) ?? "",
    manufacturer: (r.manufacturer as string) ?? "",
    partName: (r.part_name as string) ?? (r.partName as string) ?? "",
    qty: Number(r.qty ?? 0),
    cost: Number(r.cost ?? 0),
    costOld: r.cost_old != null ? Number(r.cost_old) : null,
    now: Number(r.now ?? r.price_now ?? 0),
    ship: Number(r.ship ?? r.price_ship ?? 0),
    deltaPercent: Number(r.delta_percent ?? r.deltaPercent ?? 0),
    stock: Number(r.stock ?? 0),
    weight: Number(r.weight ?? 0),
    isBulky: Boolean(r.isBulky),
    productGroup: (r.product_group as string) ?? (r.productGroup as string) ?? "",
    sales12m: Number(r.sales_12m ?? r.sales12m ?? 0),
    reason: (r.reason as string) ?? null,
    part_brand_key: (r.part_brand_key as string) ?? null,
    part_code_fixed: Boolean(r.part_code_fixed),
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
  // Do NOT auto-select first invoice - keep empty state on load
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

  const handleDeleteInvoice = useCallback(async (id: string) => {
    if (!id) return
  
    const ok = confirm(`Delete invoice ${id}?`)
    if (!ok) return
  
    const ts = () => new Date().toLocaleTimeString()
  
    setLogs(prev => [...prev, `[${ts()}] Deleting invoice ${id}...`])
  
    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "DELETE",
      })
  
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
  
      // очи����тка UI
      setRows([])
      setSelectedInvoice(null)
      setIsEnriched(false)
  
      // о��новить список
      const listRes = await fetch("/api/invoice/list")
      if (listRes.ok) {
        const data = await listRes.json()
        setInvoiceList(data)
      }
  
      setLogs(prev => [...prev, `[${ts()}] Invoice ${id} deleted.`])
    } catch (e) {
      setLogs(prev => [...prev, `[${ts()}] Error deleting invoice ${id}`])
    }
  }, [])

  // Delete multiple selected invoices
  const handleDeleteSelected = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    
    const ok = confirm(`Delete ${ids.length} invoice(s)?`)
    if (!ok) return
    
    const ts = () => new Date().toLocaleTimeString()
    
    setLogs(prev => [...prev, `[${ts()}] Deleting ${ids.length} invoice(s)...`])
    
    let deleted = 0
    let failed = 0
    
    for (const id of ids) {
      try {
        const res = await fetch(`/api/invoice/${id}`, {
          method: "DELETE",
        })
        
        if (res.ok) {
          deleted++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
    
    // Clear UI
    setRows([])
    setSelectedInvoice(null)
    setSelectedInvoices([])
    setIsEnriched(false)
    
    // Refresh list
    const listRes = await fetch("/api/invoice/list")
    if (listRes.ok) {
      const data = await listRes.json()
      setInvoiceList(data)
    }
    
    setLogs(prev => [...prev, `[${ts()}] Deleted ${deleted} invoice(s)${failed ? `, ${failed} failed` : ""}.`])
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



        setStatus("completed")

        if (returnedId) {
          setSelectedInvoice(returnedId) // 🔥 ВАЖНО
          await handleRefresh(returnedId)
        } else {
          try {
            const listRes = await fetch("/api/invoice/list")
            if (listRes.ok) {
              const listData = await listRes.json()
              setInvoiceList(listData)
            }
          } catch {}
        }
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

  const handleRefresh = useCallback(async (invoiceId?: string) => {
  const ts = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  }

  const source = isEnriched ? "enriched" : "raw"
  // Store current selection BEFORE any state changes
  const currentInvoiceId = invoiceId ?? selectedInvoice

  if (!currentInvoiceId) return
  
  // Prevent duplicate requests
  if (isRefreshing) return
  setIsRefreshing(true)

  setLogs(prev => [
    ...prev,
    `[${ts()}] Refreshing from ${source === "enriched" ? "invoice_rows_enriched" : "invoice_rows"}...`
  ])

  setScenarioData(null)
  setIsScenarioActive(false)

  try {
    // Step 1: Refresh invoice list
    const listRes = await fetch("/api/invoice/list")
    let newInvoiceList: InvoiceListItem[] = []
    if (listRes.ok) {
      newInvoiceList = await listRes.json()
      setInvoiceList(newInvoiceList)
    }

    // Step 2: Check if current invoice still exists in the new list
    const invoiceStillExists = newInvoiceList.some(inv => inv.invoice_id === currentInvoiceId)

    if (invoiceStillExists) {
      // Step 3: Reload rows for the preserved selection
      await loadInvoice(currentInvoiceId, source)
      
      setLogs(prev => [
        ...prev,
        `[${ts()}] Refresh complete — invoice ${currentInvoiceId} loaded.`,
      ])
    } else {
      // Invoice was deleted - clear selection safely
      setSelectedInvoice(null)
      setRows([])
      setLogs(prev => [
        ...prev,
        `[${ts()}] Invoice ${currentInvoiceId} no longer exists. Selection cleared.`,
      ])
    }

    setStatus("idle")
    setProgress(0)
    setIsProcessing(false)
    setDataVersion(v => v + 1)
  } catch (err) {
    setLogs(prev => [
      ...prev,
      `[${ts()}] Refresh failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    ])
  } finally {
    setIsRefreshing(false)
  }
}, [isEnriched, selectedInvoice, loadInvoice, isRefreshing])

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

      // Save original part_brand_key values before replacing
      const keyMap = new Map<string, string>()
      rows.forEach((row) => {
        if (row.part_brand_key) {
          // Use partCode_manufacturer as lookup key
          keyMap.set(`${row.partCode}_${row.manufacturer}`, row.part_brand_key)
        }
      })

      // Map enriched data and restore part_brand_key
      const mapped = enrichedRows.map((r, idx) => {
        const row = mapRow(r, idx)
        const lookupKey = `${row.partCode}_${row.manufacturer}`
        const originalKey = keyMap.get(lookupKey)
        return {
          ...row,
          part_brand_key: row.part_brand_key || originalKey || null,
        }
      })

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
  }, [selectedInvoice, mapRow, rows])

  const handleEnrichSelected = useCallback(async (ids: string[]) => {
    if (!ids.length) return
  
    setIsEnriching(true)
    const ts = () => new Date().toLocaleTimeString()
  
    setLogs((prev) => [
      ...prev,
      `[${ts()}] Running batch enrichment for ${ids.length} invoice(s)...`,
    ])
  
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/invoice/${id}/enriched`, {
            method: "POST",
          })
  
          const result = await response.json().catch(() => ({}))
  
          if (!response.ok || !result?.success) {
            throw new Error(
              `Enrichment failed for ${id}: ${result?.error ?? response.status}`
            )
          }
  
          const enrichedRows: Record<string, unknown>[] = result.rows ?? []
  
          setLogs((prev) => [
            ...prev,
            `[${ts()}] Enrichment complete for ${id}. ${enrichedRows.length} rows received.`,
          ])
  
          return enrichedRows.map(mapRow)
        })
      )
  
      // 🔥 1. Собрали все строки
      const allRowsRaw = results.flat()
  
      // 🔥 2. УБРАЛИ ДУБЛИКАТЫ ПО id
      const uniqueMap = new Map<string, InvoiceRow>()
  
      for (const r of allRowsRaw) {
        uniqueMap.set(r.id, r)
      }
  
      const allRows = Array.from(uniqueMap.values())
  
      // 🔍 ЛОГИ (оставь, они полезны)
      console.log("ENRICH selected ids:", ids)
      console.log("ENRICH final rows count:", allRows.length)
      console.log(
        "ENRICH final grouped:",
        allRows.reduce((acc: Record<string, number>, row: any) => {
          const key = row._debugInvoiceId || "unknown"
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})
      )
      console.log(
        "ENRICH final total:",
        allRows.reduce(
          (sum, r) => sum + Number(r.cost || 0) * Number(r.qty || 0),
          0
        )
      )
  
      // 🔥 3. Save original part_brand_key values before replacing
      const keyMap = new Map<string, string>()
      rows.forEach((row) => {
        if (row.part_brand_key) {
          keyMap.set(`${row.partCode}_${row.manufacturer}`, row.part_brand_key)
        }
      })

      // Restore part_brand_key from original rows
      const mergedRows = allRows.map((row) => {
        const lookupKey = `${row.partCode}_${row.manufacturer}`
        const originalKey = keyMap.get(lookupKey)
        return {
          ...row,
          part_brand_key: row.part_brand_key || originalKey || null,
        }
      })

      setScenarioData(null)
      setIsScenarioActive(false)
      setRows(mergedRows)
      setIsEnriched(true)
      setDataVersion((v) => v + 1)
  
      if (ids.length === 1) {
        setSelectedInvoice(ids[0])
      } else {
        setSelectedInvoice(null)
      }
  
      setLogs((prev) => [
        ...prev,
        `[${ts()}] Batch enrichment complete — ${allRows.length} rows from ${ids.length} invoice(s).`,
      ])
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `[${ts()}] Error: Batch enrichment failed. ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      ])
    } finally {
      setIsEnriching(false)
    }
  }, [mapRow, rows])
 

  const handleExport = useCallback(async () => {
    if (rows.length === 0) return
  
    const ts = () => {
      const d = new Date()
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
    }
  
    setLogs((prev) => [
      ...prev,
      `[${ts()}] Exporting ${rows.length} rows to Excel...`,
    ])

    // Weight normalization: detect date-like values and invalid data
    const normalizeWeight = (value: unknown): number | null => {
      if (value === null || value === undefined) return null
      const str = String(value).trim()
      // If looks like a date (e.g., 04.07.2026) → ignore
      if (/\d{1,2}[.,]\d{1,2}[.,]\d{2,4}/.test(str)) return null
      const num = Number(str.replace(",", "."))
      if (isNaN(num) || num < 0 || num > 1000) return null
      return num
    }

    // Format weight with comma separator for display
    const formatWeight = (value: number | null): string => {
      if (value === null || value === undefined) return ""
      return value.toFixed(3).replace(".", ",")
    }

    // Dynamically import xlsx library
    const XLSX = await import("xlsx")

    // Prepare data for export
    const exportData = rows.map((r) => {
      const normalizedWeight = normalizeWeight(r.weight)
      return {
        "Part Code": r.partCode,
        "Manufacturer": r.manufacturer,
        "Part Name": r.partName ?? "",
        "Qty": Number(r.qty || 0),
        "Cost": Number(r.cost || 0),
        "Now": Number(r.now || 0),
        "Ship": Number(r.ship || 0),
        "Weight": formatWeight(normalizedWeight),
        "Total Purchase": Number(r.cost || 0) * Number(r.qty || 0),
      }
    })

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData)

    // Force Weight column (H) to be string type to prevent Excel date conversion
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 7 }) // Column H (Weight)
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].t = "s" // Force string type
      }
    }

    // Create workbook and append worksheet
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice")

    // Generate filename
    const filename = `invoice-${selectedInvoice ?? "export"}-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`

    // Write and download file
    XLSX.writeFile(workbook, filename)
  
    setLogs((prev) => [
      ...prev,
      `[${ts()}] Export complete — ${rows.length} rows saved as XLSX.`,
    ])
  }, [rows, selectedInvoice])

const handleClear = useCallback(() => {
  console.log("[v0] handleClear called in page.tsx")
  const ts = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  }
  
  // UI-only clear: no API calls, no database changes
  console.log("[v0] Clearing rows, selectedInvoice, selectedInvoices...")
  setRows([])
  setScenarioData(null)
  setIsScenarioActive(false)
  setSelectedInvoice(null)
  setSelectedInvoices([])
  setIsEnriched(false)
  setStatus("idle")
  setProgress(0)
  setIsProcessing(false)
  setSelectedRow(null)
  setDataVersion((v) => v + 1)
  
  setLogs((prev) => [
    ...prev,
    `[${ts()}] UI cleared - all selections reset.`,
  ])
  console.log("[v0] handleClear completed")
}, [])

  const handleRollback = useCallback(() => {
    setLogs((prev) => [...prev, "[10:26:00] Rolling back last operation..."])
    setTimeout(() => {
      setLogs((prev) => [...prev, "[10:26:01] Rollback complete."])
    }, 800)
  }, [])

  // Update rows with calculated MOOT prices (writes to "moot" column)
  // isManual: false for automatic calculation
  const handleUpdateMoot = useCallback((updates: Map<string | number, number>) => {
    setRows((prevRows) => {
      const updatedRows = prevRows.map((row) => {
        const itemId = row.id || row.sku || row.article
        const mootPrice = updates.get(itemId)
        if (mootPrice !== undefined) {
          return { ...row, moot: mootPrice, isManual: false }
        }
        return row
      })
      return updatedRows
    })
  }, [])

  // Clear all MOOT values
  const handleClearMoot = useCallback(() => {
    setRows((prevRows) => prevRows.map((row) => ({
      ...row,
      moot: undefined,
      isManual: false
    })))
  }, [])

  // Update Ship values for all rows based on calculated delivery costs
  // Also recalculates deltaPercent = ((Now - Ship) / Cost - 1) × 100
  const handleUpdateShip = useCallback((updates: Map<string | number, number>) => {
    setRows((prevRows) => {
      const updatedRows = prevRows.map((row) => {
        const itemId = row.id || row.sku || row.article
        const shipValue = updates.get(itemId)
        if (shipValue !== undefined) {
          // Calculate deltaPercent: ((Now - Ship) / Cost - 1) × 100
          const cost = row.cost || 0
          const now = row.now || 0
          const deltaPercent = cost > 0 && shipValue > 0
            ? Math.round((((now - shipValue) / cost) - 1) * 1000) / 10
            : 0
          return { ...row, ship: shipValue, deltaPercent }
        }
        return row
      })
      return updatedRows
    })
  }, [])

  // Update DeltaNorm values (markup % from pricing rules used in MOOT calculation)
  const handleUpdateDeltaNorm = useCallback((updates: Map<string | number, number>) => {
    setRows((prevRows) => {
      const updatedRows = prevRows.map((row) => {
        const itemId = row.id || row.sku || row.article
        const deltaNormValue = updates.get(itemId)
        if (deltaNormValue !== undefined) {
          return { ...row, deltaNorm: deltaNormValue }
        }
        return row
      })
      return updatedRows
    })
  }, [])

  const handleRowClick = useCallback((row: InvoiceRow) => {
    console.log("[v0] CLICK ROW:", row)
    setSelectedRow((prev) => (prev?.id === row.id ? null : row))
  }, [])

  // Update a single row (used for manual MOOT edits)
  const handleUpdateRow = useCallback((id: string, updates: Partial<InvoiceRow>) => {
    setRows((prevRows) => prevRows.map((row) => 
      row.id === id ? { ...row, ...updates } : row
    ))
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
  // 🔍 DEBUG
console.log("rows sum:", rows.reduce((s,r)=>s+r.cost*r.qty,0))
console.log("data sum:", data.reduce((s,r)=>s+r.cost*r.qty,0))
console.log("scenario active:", isScenarioActive)


  return (
    <div className={`flex h-screen overflow-hidden bg-background workspace-scaled density-${density} scale-${uiScale}`}>
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
        isRefreshing={isRefreshing}
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
        onEnrichSelected={handleEnrichSelected}
  onDeleteInvoice={handleDeleteInvoice}
  onDeleteSelected={handleDeleteSelected}
selectedInvoices={selectedInvoices}
  onToggleInvoice={toggleInvoice}
  onClearSelection={() => setSelectedInvoices([])}
  zeroWeightCount={zeroWeightCount}
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
  {fixedCodeCount > 0 && (
    <>
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <span className="shrink-0 whitespace-nowrap font-mono text-xs text-amber-500">
        Fixed: {fixedCodeCount}
      </span>
    </>
  )}
          </div>

          {/* Middle section: Invoice ID | Supplier | Total — grid layout */}
          <div className="mx-4 grid min-w-0 flex-1 grid-cols-[1fr_1fr_auto] items-center gap-8">
            {/* Invoice ID — text-only status color */}
            <span
              className={`min-w-0 truncate font-mono text-xs font-medium ${
                selectedInvoice
                  ? isEnriched
                    ? "text-emerald-400/70"
                    : "text-zinc-400"
                  : "text-muted-foreground/40"
              }`}
            >
              {selectedInvoice ?? "\u2014"}
            </span>
            {/* Supplier — plain truncated text */}
            <span className="min-w-0 truncate text-xs text-foreground/70">
              {selectedInvoice
                ? invoiceList.find((i) => i.invoice_id === selectedInvoice)?.supplier ?? ""
                : "\u2014"}
            </span>
            {/* Total — right-aligned, fixed width */}
            <span className="w-28 text-right font-mono text-xs tabular-nums text-foreground/80">
              {isTableReady
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

<span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />

<DropdownMenu>
  <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  aria-label="Change theme"
                >
  {mounted && (
  theme === "light" ? (
  <Sun className="h-3.5 w-3.5" />
  ) : theme === "soft" ? (
  <Sun className="h-3.5 w-3.5 text-amber-400" />
  ) : theme === "graphite" ? (
  <Monitor className="h-3.5 w-3.5" />
  ) : theme === "warm-dark" ? (
  <Moon className="h-3.5 w-3.5 text-amber-500" />
  ) : (
  <Moon className="h-3.5 w-3.5" />
  )
  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  Theme
                </DropdownMenuLabel>
  <DropdownMenuItem
  onClick={() => setTheme("light")}
  className={`gap-2 text-xs ${theme === "light" ? "bg-accent" : ""}`}
  >
  <Sun className="h-3.5 w-3.5" />
  Light
  </DropdownMenuItem>
  <DropdownMenuItem
  onClick={() => setTheme("soft")}
  className={`gap-2 text-xs ${theme === "soft" ? "bg-accent" : ""}`}
  >
  <Sun className="h-3.5 w-3.5 text-amber-400" />
  Soft
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

                <DropdownMenuSeparator />
                
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  Density
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleDensityChange("comfortable")}
                  className={`gap-2 text-xs ${density === "comfortable" ? "bg-accent" : ""}`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Comfortable
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDensityChange("compact")}
                  className={`gap-2 text-xs ${density === "compact" ? "bg-accent" : ""}`}
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  Compact
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  UI Scale
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleScaleChange("90")}
                  className={`gap-2 text-xs ${uiScale === "90" ? "bg-accent" : ""}`}
                >
                  <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono">90</span>
                  90%
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleScaleChange("100")}
                  className={`gap-2 text-xs ${uiScale === "100" ? "bg-accent" : ""}`}
                >
                  <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono">100</span>
                  100%
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleScaleChange("110")}
                  className={`gap-2 text-xs ${uiScale === "110" ? "bg-accent" : ""}`}
                >
                  <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono">110</span>
                  110%
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
            <div className="relative min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out">
              <InvoiceTable
                key={dataVersion}
                data={safeData}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                onRowCountChange={setRowCount}
                selectedRowId={selectedRow?.id}
                onRowClick={handleRowClick}
                onUpdateRow={handleUpdateRow}
              />
              {/* Empty state overlay when table is not ready */}
              {!isTableReady && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/60">
                  <div className="text-center space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Выберите инвойс для начала работы
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Выберите поставку и инвойс для отображения данных
                    </p>
                  </div>
                </div>
              )}
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
                  <PartDetailsPanel
                    row={selectedRow}
                    onClose={handleCloseAnalytics}
                    panelEnabled={true}
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
  invoiceIds={
    Array.isArray(selectedInvoices)
      ? selectedInvoices.map(i => typeof i === "string" ? i : (i as any).invoice_id)
      : []
  }
  onApplyScenario={handleApplyScenario}
  onResetScenario={handleResetScenario}
  isScenarioActive={isScenarioActive}
  onSetSelectedInvoices={setSelectedInvoices}
  onEnrich={handleEnrich}
  onEnrichSelected={handleEnrichSelected}
  isEnriching={isEnriching}
  selectedInvoice={selectedInvoice}
  onUpdateMoot={handleUpdateMoot}
  onClearMoot={handleClearMoot}
  onUpdateShip={handleUpdateShip}
  onUpdateDeltaNorm={handleUpdateDeltaNorm}
  onShipmentSelect={setSelectedShipmentId}
  onInvoiceReset={() => {
    setSelectedInvoice(null)
    setRows([])
    setSelectedInvoices([])
  }}
  onInvoiceSelect={handleInvoiceChange}
/>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
