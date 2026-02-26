"use client"

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
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
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, GripVertical } from "lucide-react"
import type { InvoiceRow } from "@/lib/mock-data"

// --- localStorage helpers ---
const STORAGE_KEY = "invoice-table-column-order"

function loadColumnOrder(validIds: string[]): ColumnOrderState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed: string[] = JSON.parse(stored)
    // Filter out columns that no longer exist
    const filtered = parsed.filter((id) => validIds.includes(id))
    // Append any new columns not in saved order
    const missing = validIds.filter((id) => !filtered.includes(id))
    return [...filtered, ...missing]
  } catch {
    return null
  }
}

function saveColumnOrder(order: ColumnOrderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // ignore storage errors
  }
}

// --- Sortable Header Cell ---
function DraggableHeaderCell({
  header,
}: {
  header: Header<InvoiceRow, unknown>
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
    zIndex: isDragging ? 20 : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className="h-9 whitespace-nowrap"
      colSpan={header.colSpan}
    >
      <div className={`flex items-center gap-0.5 ${numericColumnIds.has(header.column.id) ? "justify-center" : ""}`}>
        <span
          className="flex items-center text-muted-foreground/50 hover:text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </span>
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </div>
    </TableHead>
  )
}

// --- Sortable Body Cell ---
function DraggableCell({
  cell,
}: {
  cell: Cell<InvoiceRow, unknown>
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: cell.column.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isNumeric = numericColumnIds.has(cell.column.id)

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      className={`whitespace-nowrap py-1.5 ${isNumeric ? "text-center" : ""}`}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  )
}

// --- Numeric column IDs for centering ---
const numericColumnIds = new Set(["qty", "cost", "now", "ship", "deltaPercent", "stock", "weight", "sales12m"])

// --- SortableHeader button (for sorting) ---
function SortableHeaderButton({
  column,
  label,
}: {
  column: {
    toggleSorting: (desc: boolean) => void
    getIsSorted: () => false | "asc" | "desc"
  }
  label: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-1 h-8 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  )
}

// --- Column definitions ---
const columns: ColumnDef<InvoiceRow>[] = [
  {
    id: "partCode",
    accessorKey: "partCode",
    header: ({ column }) => <SortableHeaderButton column={column} label="Part Code" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-foreground">{row.getValue("partCode")}</span>
    ),
  },
  {
    id: "manufacturer",
    accessorKey: "manufacturer",
    header: ({ column }) => <SortableHeaderButton column={column} label="Manufacturer" />,
    cell: ({ row }) => <span className="text-xs">{row.getValue("manufacturer")}</span>,
  },
  {
    id: "partName",
    accessorKey: "partName",
    header: ({ column }) => <SortableHeaderButton column={column} label="Part Name" />,
    cell: ({ row }) => (
      <span className="text-xs leading-tight line-clamp-2 max-w-[260px]">{row.getValue("partName")}</span>
    ),
  },
  {
    id: "qty",
    accessorKey: "qty",
    header: ({ column }) => <SortableHeaderButton column={column} label="Qty" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.getValue("qty")}</span>
    ),
  },
  {
    id: "cost",
    accessorKey: "cost",
    header: ({ column }) => <SortableHeaderButton column={column} label="Cost" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {(row.getValue("cost") as number).toFixed(2)}
      </span>
    ),
  },
  {
    id: "now",
    accessorKey: "now",
    header: ({ column }) => <SortableHeaderButton column={column} label="Now" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">
        {(row.getValue("now") as number).toFixed(2)}
      </span>
    ),
  },
  {
    id: "ship",
    accessorKey: "ship",
    header: ({ column }) => <SortableHeaderButton column={column} label="Ship" />,
    cell: ({ row }) => {
      const val = row.getValue("ship") as number
      const now = row.original.now
      const isHigher = val > now
      const isLower = val < now && val > 0
      return (
        <span className={`font-mono text-xs tabular-nums ${
          val === 0 ? "text-muted-foreground/40" : isHigher ? "text-amber-600 dark:text-amber-400" : isLower ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
        }`}>
          {val === 0 ? "---" : val.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: "deltaPercent",
    accessorKey: "deltaPercent",
    header: ({ column }) => <SortableHeaderButton column={column} label={"\u0394%"} />,
    cell: ({ row }) => {
      const val = row.getValue("deltaPercent") as number
      if (val === -100) return <span className="font-mono text-xs text-muted-foreground/40">{"---"}</span>
      return (
        <span className={`font-mono text-xs tabular-nums ${
          val > 0 ? "text-amber-600 dark:text-amber-400" : val < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        }`}>
          {val > 0 ? "+" : ""}{val.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: "stock",
    accessorKey: "stock",
    header: ({ column }) => <SortableHeaderButton column={column} label="Stock" />,
    cell: ({ row }) => {
      const stock = row.getValue("stock") as number
      return (
        <span className={`font-mono text-xs tabular-nums ${stock < 20 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
          {stock}
        </span>
      )
    },
  },
  {
    id: "weight",
    accessorKey: "weight",
    header: ({ column }) => <SortableHeaderButton column={column} label="Weight" />,
    cell: ({ row }) => {
      const w = row.getValue("weight") as number
      return (
        <span
          className={`font-mono text-xs tabular-nums ${w === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}
        >
          {w.toFixed(3)} kg
        </span>
      )
    },
  },
  {
    id: "productGroup",
    accessorKey: "productGroup",
    header: ({ column }) => <SortableHeaderButton column={column} label="Group" />,
    cell: ({ row }) => <span className="text-xs">{row.getValue("productGroup")}</span>,
  },
  {
    id: "sales12m",
    accessorKey: "sales12m",
    header: ({ column }) => <SortableHeaderButton column={column} label="12m" />,
    cell: ({ row }) => {
      const val = row.getValue("sales12m") as number
      return (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{val.toLocaleString()}</span>
      )
    },
  },
]

const defaultColumnIds = columns.map((c) => c.id!)

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
  const [isHydrated, setIsHydrated] = useState(false)

  // Load saved column order from localStorage on mount
  useEffect(() => {
    const saved = loadColumnOrder(defaultColumnIds)
    if (saved) {
      setColumnOrder(saved)
    }
    setIsHydrated(true)
  }, [])

  // Persist column order changes
  const handleColumnOrderChange = useCallback(
    (updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)) => {
      setColumnOrder((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        saveColumnOrder(next)
        return next
      })
    },
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnOrder },
    onSortingChange: setSorting,
    onGlobalFilterChange: onGlobalFilterChange,
    onColumnOrderChange: handleColumnOrderChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredCount = table.getFilteredRowModel().rows.length

  useEffect(() => {
    onRowCountChange?.(filteredCount)
  }, [filteredCount, onRowCountChange])

  // dnd-kit sensors -- require a 5px drag distance to avoid conflicts with sort clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      handleColumnOrderChange((prev) => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    },
    [handleColumnOrderChange]
  )

  // Column IDs for SortableContext
  const columnIds = useMemo(() => columnOrder, [columnOrder])

  if (!isHydrated) {
    return <div className="h-full" />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto overflow-y-auto">
        <table className="min-w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted dark:bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-0">
                <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                  {headerGroup.headers.map((header) => (
                    <DraggableHeaderCell key={header.id} header={header} />
                  ))}
                </SortableContext>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => {
                const isSelected = selectedRowId === row.original.id
                return (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-primary/10 hover:bg-primary/15"
                      : index % 2 === 1
                        ? "bg-muted/40 hover:bg-muted/60"
                        : "hover:bg-muted/30"
                  }`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                    {row.getVisibleCells().map((cell) => (
                      <DraggableCell key={cell.id} cell={cell} />
                    ))}
                  </SortableContext>
                </TableRow>
                )
              })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    {data.length === 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm text-muted-foreground">No invoice loaded</span>
                        <span className="text-xs text-muted-foreground/60">
                          Select an invoice or upload a file to begin
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No results found.</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </table>
      </div>
    </DndContext>
  )
}
