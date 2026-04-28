"use client"

import { useState, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronsUpDown,
  GripHorizontal,
  Car,
} from "lucide-react"

// VIN row type
interface VinRow {
  id: string
  vin: string
  brand: string
  model: string
  engine: string
  year: string
  body: string
  transmission: string
  notes: string
}

// Mock data
const mockVinData: VinRow[] = [
  {
    id: "1",
    vin: "JTDKN3DU5A0123456",
    brand: "Toyota",
    model: "Prius",
    engine: "1.8L Hybrid",
    year: "2010",
    body: "Hatchback",
    transmission: "CVT",
    notes: "Low mileage, excellent condition",
  },
  {
    id: "2",
    vin: "KMHD35LH5GU123789",
    brand: "Hyundai",
    model: "Elantra",
    engine: "2.0L I4",
    year: "2016",
    body: "Sedan",
    transmission: "6-Speed Auto",
    notes: "Single owner",
  },
  {
    id: "3",
    vin: "WBAPH5C55BA456123",
    brand: "BMW",
    model: "328i",
    engine: "3.0L I6",
    year: "2011",
    body: "Sedan",
    transmission: "6-Speed Manual",
    notes: "Sport package",
  },
  {
    id: "4",
    vin: "1HGBH41JXMN109186",
    brand: "Honda",
    model: "Accord",
    engine: "2.4L I4",
    year: "2021",
    body: "Sedan",
    transmission: "CVT",
    notes: "Certified pre-owned",
  },
  {
    id: "5",
    vin: "5YFBURHE2KP987654",
    brand: "Toyota",
    model: "Corolla",
    engine: "1.8L I4",
    year: "2019",
    body: "Sedan",
    transmission: "CVT",
    notes: "",
  },
]

// Column definitions
const columns: ColumnDef<VinRow>[] = [
  {
    accessorKey: "vin",
    header: "VIN",
    size: 180,
    minSize: 120,
    maxSize: 300,
  },
  {
    accessorKey: "brand",
    header: "Brand",
    size: 100,
    minSize: 60,
    maxSize: 200,
  },
  {
    accessorKey: "model",
    header: "Model",
    size: 120,
    minSize: 80,
    maxSize: 200,
  },
  {
    accessorKey: "engine",
    header: "Engine",
    size: 120,
    minSize: 80,
    maxSize: 200,
  },
  {
    accessorKey: "year",
    header: "Year",
    size: 70,
    minSize: 50,
    maxSize: 100,
  },
  {
    accessorKey: "body",
    header: "Body",
    size: 100,
    minSize: 60,
    maxSize: 180,
  },
  {
    accessorKey: "transmission",
    header: "Transmission",
    size: 130,
    minSize: 80,
    maxSize: 200,
  },
  {
    accessorKey: "notes",
    header: "Notes",
    size: 200,
    minSize: 100,
    maxSize: 400,
  },
]

const STORAGE_KEY = "vin_table_state"
const defaultColumnOrder = columns.map((c) => c.accessorKey as string)
const defaultColumnSizing: ColumnSizingState = {}
columns.forEach((col) => {
  const key = col.accessorKey as string
  defaultColumnSizing[key] = col.size ?? 100
})

// Sortable header cell component
function SortableHeaderCell({
  header,
  children,
}: {
  header: Header<VinRow, unknown>
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
    cursor: isDragging ? "grabbing" : "default",
    width: header.getSize(),
    minWidth: header.column.columnDef.minSize,
    maxWidth: header.column.columnDef.maxSize,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="group relative h-8 select-none border-b border-r border-border bg-muted/50 px-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      <div className="flex items-center gap-1">
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-60"
        >
          <GripHorizontal className="h-3 w-3" />
        </span>
        {children}
      </div>
      {/* Resize handle */}
      <div
        onDoubleClick={() => header.column.resetSize()}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/50 ${
          header.column.getIsResizing() ? "bg-primary" : ""
        }`}
      />
    </th>
  )
}

// Sortable data cell component
function SortableDataCell({
  cell,
}: {
  cell: Cell<VinRow, unknown>
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: cell.column.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    width: cell.column.getSize(),
    minWidth: cell.column.columnDef.minSize,
    maxWidth: cell.column.columnDef.maxSize,
  }

  return (
    <td
      ref={setNodeRef}
      style={style}
      className="h-8 truncate border-b border-r border-border px-2 text-xs"
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  )
}

export default function VinSearchPage() {
  const router = useRouter()

  // Filter state
  const [vinFilter, setVinFilter] = useState("")
  const [engineFilter, setEngineFilter] = useState("")
  const [brandModelFilter, setBrandModelFilter] = useState("")

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(defaultColumnOrder)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(defaultColumnSizing)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [isHydrated, setIsHydrated] = useState(false)

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.columnOrder) setColumnOrder(parsed.columnOrder)
        if (parsed.columnSizing) setColumnSizing(parsed.columnSizing)
        if (parsed.columnVisibility) setColumnVisibility(parsed.columnVisibility)
      }
    } catch {
      // ignore
    }
    setIsHydrated(true)
  }, [])

  // Save state to localStorage
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          columnOrder,
          columnSizing,
          columnVisibility,
        })
      )
    } catch {
      // ignore
    }
  }, [columnOrder, columnSizing, columnVisibility, isHydrated])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  // Handle column drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [])

  // Create table instance
  const table = useReactTable({
    data: mockVinData,
    columns,
    state: {
      sorting,
      columnOrder,
      columnSizing,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  })

  // Calculate total table width
  const totalWidth = useMemo(() => {
    return table
      .getAllLeafColumns()
      .filter((col) => col.getIsVisible())
      .reduce((sum, col) => sum + col.getSize(), 0)
  }, [table, columnSizing])

  // Handle search button click (placeholder for future API integration)
  const handleSearch = useCallback(() => {
    // Future: API call with vinFilter, engineFilter, brandModelFilter
    console.log("[v0] Search clicked:", { vinFilter, engineFilter, brandModelFilter })
  }, [vinFilter, engineFilter, brandModelFilter])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <Car className="h-3.5 w-3.5 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">VIN Search</h1>
      </header>

      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1.5">
        <Input
          placeholder="Enter VIN..."
          value={vinFilter}
          onChange={(e) => setVinFilter(e.target.value)}
          className="h-7 w-44 text-xs"
        />
        <Input
          placeholder="Engine..."
          value={engineFilter}
          onChange={(e) => setEngineFilter(e.target.value)}
          className="h-7 w-28 text-xs"
        />
        <Input
          placeholder="Brand / Model..."
          value={brandModelFilter}
          onChange={(e) => setBrandModelFilter(e.target.value)}
          className="h-7 w-36 text-xs"
        />
        <Button
          size="sm"
          className="h-7 gap-1.5 px-3 text-xs"
          onClick={handleSearch}
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis]}
        >
          <table
            className="border-collapse"
            style={{ width: totalWidth, minWidth: "100%", tableLayout: "fixed" }}
          >
            {/* Sticky header */}
            <thead className="sticky top-0 z-10 bg-card">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <SortableHeaderCell key={header.id} header={header}>
                        <button
                          type="button"
                          className="flex flex-1 items-center gap-1 truncate"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-30" />
                          )}
                        </button>
                      </SortableHeaderCell>
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>

            {/* Body */}
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="h-8 cursor-pointer transition-colors select-text bg-background hover:bg-muted/50"
                  >
                    <SortableContext
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <SortableDataCell key={cell.id} cell={cell} />
                      ))}
                    </SortableContext>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  )
}
