"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUp, ArrowDown } from "lucide-react"
import type { Column } from "@tanstack/react-table"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface StockRow {
  id: string
  part_code: string
  brand: string
  purchase: number
  current: number
  margin_percent: number
  margin_abs: number
  stock: number
  total_stock: number
  sales_12m: number
  weight: number
  bulk: boolean
  part_brand_key: string
}

export interface InvoiceRow {
  id: string
  part_code: string
  part_name: string
  brand: string
  purchase: number
  stock: number
  gtd_number: string
  part_code_fixed: boolean
  weight: number
  bulk: boolean
  part_brand_key: string
}

export interface CustomRow {
  id: string
  [key: string]: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// SORT HEADER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function SortHeader<T>({ column, label }: { column: Column<T, unknown>; label: string }) {
  const sorted = column.getIsSorted()
  return (
    <button
      className="flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={() => column.toggleSorting()}
    >
      {label}
      {sorted === "asc" && <ArrowUp className="h-3 w-3" />}
      {sorted === "desc" && <ArrowDown className="h-3 w-3" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK VIEW COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

export function getStockColumns(): ColumnDef<StockRow>[] {
  return [
    {
      id: "part_code",
      accessorKey: "part_code",
      header: ({ column }) => <SortHeader column={column} label="Part Code" />,
      cell: ({ row }) => <span className="font-mono text-[11px] text-foreground">{row.getValue("part_code")}</span>,
    },
    {
      id: "part_name",
      accessorKey: "part_name",
      header: ({ column }) => <SortHeader column={column} label="Part Name" />,
      cell: ({ row }) => <span className="text-[11px]">{row.getValue("part_name")}</span>,
    },
    {
      id: "brand",
      accessorKey: "brand",
      header: ({ column }) => <SortHeader column={column} label="Brand" />,
      cell: ({ row }) => <span className="text-[11px]">{row.getValue("brand")}</span>,
    },
    {
      id: "purchase",
      accessorKey: "purchase",
      header: ({ column }) => <SortHeader column={column} label="Cost" />,
      cell: ({ row }) => {
        const v = row.getValue("purchase") as number | undefined
        return <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{v != null ? v.toFixed(2) : "---"}</span>
      },
    },
    {
      id: "current",
      accessorKey: "current",
      header: ({ column }) => <SortHeader column={column} label="Current" />,
      cell: ({ row }) => {
        const v = row.getValue("current") as number | undefined
        return <span className="font-mono text-[11px] tabular-nums">{v != null ? v.toFixed(2) : "---"}</span>
      },
    },
    {
      id: "margin_percent",
      accessorKey: "margin_percent",
      header: ({ column }) => <SortHeader column={column} label="Margin %" />,
      cell: ({ row }) => {
        const v = row.getValue("margin_percent") as number | undefined
        if (v == null) return <span className="font-mono text-[11px] text-muted-foreground">---</span>
        return (
          <span className={`font-mono text-[11px] tabular-nums ${v > 40 ? "text-emerald-600 dark:text-emerald-400" : v > 20 ? "text-foreground" : v < 0 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
            {v.toFixed(1)}%
          </span>
        )
      },
    },
    {
      id: "margin_abs",
      accessorKey: "margin_abs",
      header: ({ column }) => <SortHeader column={column} label="Margin Abs" />,
      cell: ({ row }) => {
        const v = row.getValue("margin_abs") as number | undefined
        if (v == null) return <span className="font-mono text-[11px] text-muted-foreground">---</span>
        return <span className={`font-mono text-[11px] tabular-nums ${v < 0 ? "text-red-500" : "text-muted-foreground"}`}>{v.toFixed(2)}</span>
      },
    },
    {
      id: "stock",
      accessorKey: "stock",
      header: ({ column }) => <SortHeader column={column} label="Stock" />,
      cell: ({ row }) => {
        const v = row.getValue("stock") as number | undefined
        if (v == null) return <span className="font-mono text-[11px] text-muted-foreground">---</span>
        return <span className={`font-mono text-[11px] tabular-nums ${v < 20 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{v}</span>
      },
    },
    {
      id: "total_stock",
      accessorKey: "total_stock",
      header: ({ column }) => <SortHeader column={column} label="Total Stock" />,
      cell: ({ row }) => {
        const v = row.getValue("total_stock") as number | undefined
        return <span className="font-mono text-[11px] tabular-nums">{v ?? "---"}</span>
      },
    },
    {
      id: "sales_12m",
      accessorKey: "sales_12m",
      header: ({ column }) => <SortHeader column={column} label="12m Sales" />,
      cell: ({ row }) => {
        const v = row.getValue("sales_12m") as number | undefined
        return <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{v != null ? v.toLocaleString("en-US") : "---"}</span>
      },
    },
    {
      id: "weight",
      accessorKey: "weight",
      header: ({ column }) => <SortHeader column={column} label="Weight" />,
      cell: ({ row }) => {
        const w = row.getValue("weight") as number | undefined
        if (w == null) return <span className="font-mono text-[11px] text-muted-foreground">---</span>
        return <span className={`font-mono text-[11px] tabular-nums ${w === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{w.toFixed(3)}</span>
      },
    },
    {
      id: "bulk",
      accessorKey: "bulk",
      header: ({ column }) => <SortHeader column={column} label="Bulk" />,
      cell: ({ row }) => {
        const val = row.getValue("bulk")
        return val ? <span className="text-[11px]">🚛</span> : null
      },
    },
    {
      id: "part_brand_key",
      accessorKey: "part_brand_key",
      header: ({ column }) => <SortHeader column={column} label="Key" />,
      cell: ({ row }) => <span className="font-mono text-[10px] text-muted-foreground">{row.getValue("part_brand_key")}</span>,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE VIEW COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

export function getInvoiceColumns(): ColumnDef<InvoiceRow>[] {
  return [
    {
      id: "part_code",
      accessorKey: "part_code",
      header: ({ column }) => <SortHeader column={column} label="Part Code" />,
      cell: ({ row }) => <span className="font-mono text-[11px] text-foreground">{row.getValue("part_code")}</span>,
    },
    {
      id: "part_name",
      accessorKey: "part_name",
      header: ({ column }) => <SortHeader column={column} label="Part Name" />,
      cell: ({ row }) => <span className="text-[11px]">{row.getValue("part_name")}</span>,
    },
    {
      id: "brand",
      accessorKey: "brand",
      header: ({ column }) => <SortHeader column={column} label="Brand" />,
      cell: ({ row }) => <span className="text-[11px]">{row.getValue("brand")}</span>,
    },
    {
      id: "purchase",
      accessorKey: "purchase",
      header: ({ column }) => <SortHeader column={column} label="Cost" />,
      cell: ({ row }) => {
        const v = row.getValue("purchase") as number | undefined
        return <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{v != null ? v.toFixed(2) : "---"}</span>
      },
    },
    {
      id: "stock",
      accessorKey: "stock",
      header: ({ column }) => <SortHeader column={column} label="Stock" />,
      cell: ({ row }) => {
        const v = row.getValue("stock") as number | undefined
        if (v == null) return <span className="font-mono text-[11px] text-muted-foreground">---</span>
        return <span className={`font-mono text-[11px] tabular-nums ${v < 20 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{v}</span>
      },
    },
    {
      id: "gtd_number",
      accessorKey: "gtd_number",
      header: ({ column }) => <SortHeader column={column} label="GTD" />,
      cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground">{row.getValue("gtd_number")}</span>,
    },
    {
      id: "part_code_fixed",
      accessorKey: "part_code_fixed",
      header: ({ column }) => <SortHeader column={column} label="Fixed" />,
      cell: ({ row }) => {
        const val = row.getValue("part_code_fixed")
        return val ? <span className="text-[11px]">✔</span> : ""
      },
    },
    {
      id: "weight",
      accessorKey: "weight",
      header: ({ column }) => <SortHeader column={column} label="Weight" />,
      cell: ({ row }) => {
        const w = row.getValue("weight") as number | undefined
        if (w == null) return <span className="font-mono text-[11px] text-muted-foreground">---</span>
        return <span className={`font-mono text-[11px] tabular-nums ${w === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{w.toFixed(3)}</span>
      },
    },
    {
      id: "bulk",
      accessorKey: "bulk",
      header: ({ column }) => <SortHeader column={column} label="Bulk" />,
      cell: ({ row }) => {
        const val = row.getValue("bulk")
        return val ? <span className="text-[11px]">🚛</span> : null
      },
    },
    {
      id: "part_brand_key",
      accessorKey: "part_brand_key",
      header: ({ column }) => <SortHeader column={column} label="Key" />,
      cell: ({ row }) => <span className="font-mono text-[10px] text-muted-foreground">{row.getValue("part_brand_key")}</span>,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM VIEW COLUMNS (empty placeholder)
// ─────────────────────────────────────────────────────────────────────────────

export function getCustomColumns(): ColumnDef<CustomRow>[] {
  return [
    {
      id: "id",
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="font-mono text-[11px]">{row.getValue("id")}</span>,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL PLACEHOLDERS
// ─────────────────────────────────────────────────────────────────────────────

export const StockRightPanel = () => <div />
export const StockBottomPanel = () => <div />

export const InvoiceRightPanel = () => <div />
export const InvoiceBottomPanel = () => <div />

export const CustomRightPanel = () => <div />
export const CustomBottomPanel = () => <div />

// ─────────────────────────────────────────────────────────────────────────────
// MODE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export type ModeType = 'stock' | 'invoice' | 'custom'

export const modeConfig = {
  stock: {
    getColumns: getStockColumns,
    RightPanel: StockRightPanel,
    BottomPanel: StockBottomPanel,
  },
  invoice: {
    getColumns: getInvoiceColumns,
    RightPanel: InvoiceRightPanel,
    BottomPanel: InvoiceBottomPanel,
  },
  custom: {
    getColumns: getCustomColumns,
    RightPanel: CustomRightPanel,
    BottomPanel: CustomBottomPanel,
  },
} as const
