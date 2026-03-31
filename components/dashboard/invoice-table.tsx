"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
  type ColumnSizingState,
  type VisibilityState,
  type Header,
  type Cell,
} from "@tanstack/react-table"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUp, ArrowDown, Columns3 } from "lucide-react"
import type { InvoiceRow } from "@/lib/mock-data"

// --- localStorage helpers ---
const STORAGE_KEY_ORDER = "spreadsheet-column-order"
const STORAGE_KEY_SIZING = "spreadsheet-column-sizing"
const STORAGE_KEY_VISIBILITY = "spreadsheet-column-visibility"
const STORAGE_KEY_DETAILS_PANEL = "details_panel_enabled"

function loadFromStorage<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

function loadColumnOrder(validIds: string[]): ColumnOrderState | null {
  const stored = loadFromStorage<string[]>(STORAGE_KEY_ORDER)
  if (!stored) return null
  const filtered = stored.filter((id) => validIds.includes(id))
  const missing = validIds.filter((id) => !filtered.includes(id))
  return [...filtered, ...missing]
}

// --- Default column widths ---
const defaultColumnSizing: ColumnSizingState = {
  partCode: 120,
  manufacturer: 120,
  partName: 260,
  qty: 60,
  cost: 80,
  now: 80,
  ship: 80,
  isBulky: 70,
  deltaPercent: 70,
  stock: 70,
  weight: 80,
  productGroup: 100,
  sales12m: 80,
  moot: 80,
}

// --- Numeric column IDs for centering ---
const numericColumnIds = new Set(["qty", "cost", "now", "ship", "deltaPercent", "stock", "weight", "sales12m"])

// --- Resize Handle Component ---
function ResizeHandle({
  header,
  onDoubleClick,
}: {
  header: Header<InvoiceRow, unknown>
  onDoubleClick: () => void
}) {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onDoubleClick={onDoubleClick}
      className={`absolute right-0 top-0 z-10 h-full w-[5px] cursor-col-resize select-none touch-none transition-colors ${
        header.column.getIsResizing() 
          ? "bg-primary" 
          : "bg-border hover:bg-primary/60"
      }`}
      style={{ transform: "translateX(50%)" }}
    />
  )
}

// --- Sortable Header Cell ---
function DraggableHeaderCell({
  header,
  onAutoFit,
}: {
  header: Header<InvoiceRow, unknown>
  onAutoFit: (columnId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.column.id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    width: header.getSize(),
    minWidth: 40,
  }

  const isSorted = header.column.getIsSorted()
  const isNumeric = numericColumnIds.has(header.column.id)

  return (
    <th
      ref={setNodeRef}
      style={style}
      data-column-id={header.column.id}
      className={`relative h-9 select-none border-b-2 border-r-2 border-border bg-muted px-2 text-left text-xs font-semibold text-muted-foreground ${
        isDragging ? "z-20" : ""
      }`}
      colSpan={header.colSpan}
    >
      <div
        className={`flex h-full cursor-grab items-center gap-1 active:cursor-grabbing ${
          isNumeric ? "justify-center" : ""
        }`}
        {...attributes}
        {...listeners}
      >
        <span
          className="cursor-pointer truncate hover:text-foreground"
          onClick={() => header.column.toggleSorting()}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onAutoFit(header.column.id)
          }}
        >
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {isSorted === "asc" && <ArrowUp className="h-3 w-3 shrink-0 text-primary" />}
        {isSorted === "desc" && <ArrowDown className="h-3 w-3 shrink-0 text-primary" />}
      </div>
      <ResizeHandle
        header={header}
        onDoubleClick={() => onAutoFit(header.column.id)}
      />
    </th>
  )
}

// --- Sortable Body Cell ---
function DraggableCell({
  cell,
  width,
}: {
  cell: Cell<InvoiceRow, unknown>
  width: number
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: cell.column.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width,
    minWidth: 40,
  }

  const isNumeric = numericColumnIds.has(cell.column.id)

  return (
    <td
      ref={setNodeRef}
      style={style}
      data-column-id={cell.column.id}
      className={`truncate border-b border-r border-border px-2 py-1.5 text-xs ${
        isNumeric ? "text-center" : ""
      }`}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  )
}

// --- Column definitions ---
const columns: ColumnDef<InvoiceRow>[] = [
  {
    id: "partCode",
    accessorKey: "partCode",
    header: "Part Code",
    cell: ({ row }) => (
      <span className="font-mono text-foreground">{row.getValue("partCode")}</span>
    ),
  },
  {
    id: "manufacturer",
    accessorKey: "manufacturer",
    header: "Manufacturer",
    cell: ({ row }) => <span>{row.getValue("manufacturer")}</span>,
  },
  {
    id: "partName",
    accessorKey: "partName",
    header: "Part Name",
    cell: ({ row }) => (
      <span className="block truncate" title={row.getValue("partName")}>
        {row.getValue("partName")}
      </span>
    ),
  },
  {
    id: "qty",
    accessorKey: "qty",
    header: "Qty",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.getValue("qty")}</span>
    ),
  },
  {
    id: "cost",
    accessorKey: "cost",
    header: "Cost",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-muted-foreground">
        {(row.getValue("cost") as number).toFixed(2)}
      </span>
    ),
  },
  {
    id: "now",
    accessorKey: "now",
    header: "Now",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {(row.getValue("now") as number).toFixed(2)}
      </span>
    ),
  },
  {
    id: "ship",
    accessorKey: "ship",
    header: "Ship",
    cell: ({ row }) => {
      const val = row.getValue("ship") as number
      const now = row.original.now
      const isHigher = val > now
      const isLower = val < now && val > 0
      return (
        <span
          className={`font-mono tabular-nums ${
            val === 0
              ? "text-muted-foreground/40"
              : isHigher
                ? "text-amber-600 dark:text-amber-400"
                : isLower
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
          }`}
        >
          {val === 0 ? "---" : val.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: "isBulky",
    accessorKey: "isBulky",
    header: "Bulky",
    cell: ({ row }) => {
      const bulky = row.getValue("isBulky") as boolean
      return (
        <span className="block text-center">
          {bulky ? "🚛" : "-"}
        </span>
      )
    },
  },
  
  {
    id: "deltaPercent",
    accessorKey: "deltaPercent",
    header: "\u0394%",
    cell: ({ row }) => {
      const val = row.getValue("deltaPercent") as number
      if (val === -100)
        return <span className="font-mono text-muted-foreground/40">{"---"}</span>
      return (
        <span
          className={`font-mono tabular-nums ${
            val > 0
              ? "text-amber-600 dark:text-amber-400"
              : val < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
          }`}
        >
          {val > 0 ? "+" : ""}
          {val.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: "stock",
    accessorKey: "stock",
    header: "Stock",
    cell: ({ row }) => {
      const stock = row.getValue("stock") as number
      return (
        <span
          className={`font-mono tabular-nums ${
            stock < 20 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
          }`}
        >
          {stock}
        </span>
      )
    },
  },
  
  {
    id: "weight",
    accessorKey: "weight",
    header: "Weight",
    cell: ({ row }) => {
      const weight = row.getValue("weight") as number
  
      return (
        <span
          className={`font-mono tabular-nums ${
            weight === 0
              ? "text-red-500 font-semibold"
              : "text-muted-foreground"
          }`}
        >
          {weight.toFixed(3)} kg
        </span>
      )
    },
  },
  {
    id: "moot",
    accessorKey: "moot",
    header: "MOOT",
    cell: ({ row }) => {
      const [value, setValue] = useState(row.original.moot ?? "")
    
      return (
        <input
          type="number"
          step="0.1"
          value={value}
          data-moot="true"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
    
              const inputs = document.querySelectorAll<HTMLInputElement>(
                'input[data-moot="true"]'
              )
    
              const currentIndex = Array.from(inputs).indexOf(e.currentTarget)
              const next = inputs[currentIndex + 1]
    
              if (next) next.focus()
            }
          }}
          className="w-full h-7 border rounded px-2 text-xs font-mono"
        />
      )
    }
  },
  {
    id: "productGroup",
    accessorKey: "productGroup",
    header: "Group",
    cell: ({ row }) => <span>{row.getValue("productGroup")}</span>,
  },
  {
    id: "sales12m",
    accessorKey: "sales12m",
    header: "12m",
    cell: ({ row }) => {
      const val = row.getValue("sales12m") as number
      return (
        <span className="font-mono tabular-nums text-muted-foreground">
          {val.toLocaleString()}
        </span>
      )
    },
  },
]

const defaultColumnIds = columns.map((c) => c.id!)

// --- Column labels for visibility dropdown ---
const columnLabels: Record<string, string> = {
  partCode: "Part Code",
  manufacturer: "Manufacturer",
  partName: "Part Name",
  qty: "Qty",
  cost: "Cost",
  now: "Now",
  ship: "Ship",
  deltaPercent: "Delta %",
  stock: "Stock",
  weight: "Weight",
  productGroup: "Group",
  sales12m: "Sales 12m",
  moot: "MOOT",
}

// --- Main component ---
interface InvoiceTableProps {
  data: InvoiceRow[]
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  onRowCountChange?: (count: number) => void
  selectedRowId?: string | null
  onRowClick?: (row: InvoiceRow) => void
}

export function InvoiceTable({
  data,
  globalFilter,
  onGlobalFilterChange,
  onRowCountChange,
  selectedRowId,
  onRowClick,
}: InvoiceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(defaultColumnIds)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(defaultColumnSizing)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [isHydrated, setIsHydrated] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detailsPanelEnabled, setDetailsPanelEnabled] = useState(true)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Load saved settings from localStorage on mount
  useEffect(() => {
    const savedOrder = loadColumnOrder(defaultColumnIds)
    if (savedOrder) setColumnOrder(savedOrder)

    const savedSizing = loadFromStorage<ColumnSizingState>(STORAGE_KEY_SIZING)
    if (savedSizing) setColumnSizing({ ...defaultColumnSizing, ...savedSizing })

    const savedVisibility = loadFromStorage<VisibilityState>(STORAGE_KEY_VISIBILITY)
    if (savedVisibility) setColumnVisibility(savedVisibility)

    // Load details panel toggle state (default true)
    const savedDetailsPanelEnabled = loadFromStorage<boolean>(STORAGE_KEY_DETAILS_PANEL)
    if (savedDetailsPanelEnabled !== null) setDetailsPanelEnabled(savedDetailsPanelEnabled)

    setIsHydrated(true)
  }, [])

  // Toggle details panel and persist
  const handleDetailsPanelToggle = useCallback((enabled: boolean) => {
    setDetailsPanelEnabled(enabled)
    saveToStorage(STORAGE_KEY_DETAILS_PANEL, enabled)
  }, [])

  // Persist column order changes
  const handleColumnOrderChange = useCallback(
    (updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)) => {
      setColumnOrder((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        saveToStorage(STORAGE_KEY_ORDER, next)
        return next
      })
    },
    []
  )

  // Persist column sizing changes
  const handleColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        saveToStorage(STORAGE_KEY_SIZING, next)
        return next
      })
    },
    []
  )

  // Persist column visibility changes
  const handleColumnVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        saveToStorage(STORAGE_KEY_VISIBILITY, next)
        return next
      })
    },
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnOrder, columnSizing, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: onGlobalFilterChange,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  })

  // Auto-fit column width to content
  const handleAutoFit = useCallback((columnId: string) => {
    // Create a temporary element to measure text
    const measureEl = document.createElement("span")
    measureEl.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:12px;font-family:inherit;padding:0;"
    document.body.appendChild(measureEl)

    // Check if column exists
    const column = table.getColumn(columnId)
    if (!column) {
      document.body.removeChild(measureEl)
      return
    }

    // Measure header text
    const headerText = columnLabels[columnId] || columnId
    measureEl.textContent = headerText
    let maxWidth = measureEl.offsetWidth + 40 // add padding for sort icon and spacing

    // Measure all cell values
    data.forEach((row) => {
      const value = row[columnId as keyof InvoiceRow]
      let text = ""
      
      if (value === null || value === undefined) {
        text = ""
      } else if (typeof value === "number") {
        // Format numbers similar to how they appear in cells
        if (columnId === "cost" || columnId === "now" || columnId === "ship") {
          text = value.toFixed(2)
        } else if (columnId === "weight") {
          text = value.toFixed(1) + " kg"
        } else if (columnId === "deltaPercent") {
          text = (value > 0 ? "+" : "") + value.toFixed(1) + "%"
        } else if (columnId === "sales12m") {
          text = value.toLocaleString()
        } else {
          text = String(value)
        }
      } else {
        text = String(value)
      }
      
      measureEl.textContent = text
      const width = measureEl.offsetWidth + 32 // add padding
      if (width > maxWidth) maxWidth = width
    })

    document.body.removeChild(measureEl)

    // Clamp width between min and max
    const newWidth = Math.max(60, Math.min(maxWidth, 400))

    setColumnSizing((prev) => {
      const next = { ...prev, [columnId]: newWidth }
      saveToStorage(STORAGE_KEY_SIZING, next)
      return next
    })
  }, [data, table])

  const filteredCount = table.getFilteredRowModel().rows.length

  useEffect(() => {
    onRowCountChange?.(filteredCount)
  }, [filteredCount, onRowCountChange])

  // dnd-kit sensors -- require a 5px drag distance to avoid conflicts with sort clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      if (!over || active.id === over.id) return

      handleColumnOrderChange((prev) => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    },
    [handleColumnOrderChange]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  // Column IDs for SortableContext
  const columnIds = useMemo(() => columnOrder, [columnOrder])

  // Calculate total table width
  const totalWidth = useMemo(() => {
    return table
      .getVisibleLeafColumns()
      .reduce((sum, col) => sum + col.getSize(), 0)
  }, [table, columnSizing, columnVisibility])

  if (!isHydrated) {
    return <div className="h-full" />
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar with toggle and column visibility */}
      <div className="flex shrink-0 items-center justify-end gap-4 border-b border-border bg-background px-2 py-1.5">
        {/* Details Panel Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="details-panel-toggle"
            checked={detailsPanelEnabled}
            onCheckedChange={handleDetailsPanelToggle}
            className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30"
          />
          <Label 
            htmlFor="details-panel-toggle" 
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Details Panel
          </Label>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 border-border px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground">
              <Columns3 className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 p-1">
            {defaultColumnIds.map((colId) => (
              <DropdownMenuCheckboxItem
                key={colId}
                checked={table.getColumn(colId)?.getIsVisible() ?? true}
                onCheckedChange={(checked) =>
                  table.getColumn(colId)?.toggleVisibility(!!checked)
                }
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer py-1.5 text-sm"
              >
                {columnLabels[colId] || colId}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table container */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-auto"
        >
          <table
            className="border-collapse"
            style={{
              width: totalWidth,
              minWidth: "100%",
              tableLayout: "fixed",
            }}
          >
            <thead className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={columnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DraggableHeaderCell
                        key={header.id}
                        header={header}
                        onAutoFit={handleAutoFit}
                      />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => {
                  const isSelected = selectedRowId === row.original.id
                  return (
                    <tr
                      key={row.id}
                      className={`h-8 transition-colors ${
                        detailsPanelEnabled
                          ? "cursor-pointer"
                          : "cursor-default"
                      } ${
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15"
                          : detailsPanelEnabled
                            ? "bg-background hover:bg-muted/50"
                            : "bg-background hover:bg-muted/20"
                      }`}
                      onClick={() => {
                        if (detailsPanelEnabled) {
                          onRowClick?.(row.original)
                        }
                      }}
                    >
                      <SortableContext
                        items={columnIds}
                        strategy={horizontalListSortingStrategy}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <DraggableCell
                            key={cell.id}
                            cell={cell}
                            width={cell.column.getSize()}
                          />
                        ))}
                      </SortableContext>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Drag overlay for smoother dragging visual */}
        <DragOverlay>
          {activeId ? (
            <div className="rounded bg-primary/20 px-3 py-1 text-xs font-medium text-primary shadow-lg">
              {columnLabels[activeId] || activeId}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
