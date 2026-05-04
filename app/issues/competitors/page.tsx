"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Search, Package, Users, UserCircle, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Date helpers
function formatDateRu(dateString: string): string {
  const d = new Date(dateString)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

function normalizeDate(d: string): string {
  return new Date(d).toISOString().slice(0, 10)
}

// Types for API response
interface WebhookRow {
  date: string
  manager: string
  part_code: string
  product_name: string
  competitor_name: string
  competitor_price: string
  status: "price" | "no" | "no_answer"
}

interface TransformedRow {
  date: string
  manager: string
  part_code: string
  product_name: string
  prices: Record<string, { price: string; status: string }>
}

// Transform flat webhook rows into grouped product rows
// Key = date + part_code so each call session per product is a separate row
function transformData(rows: WebhookRow[]): TransformedRow[] {
  const map: Record<string, TransformedRow> = {}

  rows.forEach((r) => {
    // Group by date + part_code to preserve each call date as separate row
    const dateKey = new Date(r.date).toISOString().slice(0, 10)
    const key = `${dateKey}__${r.part_code}`

    if (!map[key]) {
      map[key] = {
        date: r.date,
        manager: r.manager,
        part_code: r.part_code,
        product_name: r.product_name,
        prices: {},
      }
    }

    map[key].prices[r.competitor_name] = {
      price: r.competitor_price,
      status: r.status,
    }
  })

  return Object.values(map)
}

// Managers
const managers = ["Стас", "Алексей", "Мария", "Дмитрий"]

type PriceStatus = "has_price" | "no" | "no_answer" | ""

interface CallEntry {
  productId: string
  competitorId: string
  price: string
  status: PriceStatus
}

export default function CompetitorsPage() {
  // Data loading state
  const [rawData, setRawData] = useState<WebhookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("products")
  const [selectedDate, setSelectedDate] = useState("all")
  
  // Modal states
  const [addDataModalOpen, setAddDataModalOpen] = useState(false)
  const [addCallModalOpen, setAddCallModalOpen] = useState(false)
  const [addDataTab, setAddDataTab] = useState("product")
  const [productSearch, setProductSearch] = useState("")
  
  // Call modal state
  const [callDate] = useState(new Date().toLocaleDateString("ru-RU"))
  const [callManager, setCallManager] = useState("")
  const [callEntries, setCallEntries] = useState<CallEntry[]>([])

  // Fetch data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/competitors")
        const json = await res.json()
        
        if (json.error) {
          setError(json.error)
          return
        }
        
        setRawData(json)
      } catch (e) {
        console.error("Load error:", e)
        setError("Ошибка загрузки данных")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Build unique dates for dropdown (sorted descending)
  const uniqueDates = Array.from(
    new Set(rawData.map((r) => normalizeDate(r.date)))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  // Date dropdown options
  const dateOptions = [
    { value: "last_call", label: "Последний прозвон" },
    { value: "all", label: "Все даты" },
    ...uniqueDates.map((d) => ({
      value: d,
      label: formatDateRu(d),
    })),
  ]

  // Filter by selected date
  function filterByDate(rows: WebhookRow[]): WebhookRow[] {
    // "Все даты" - return everything unfiltered
    if (!selectedDate || selectedDate === "all") {
      return rows
    }

    // "Последний прозвон" - only the latest date
    if (selectedDate === "last_call") {
      if (rows.length === 0) return rows
      
      const latestTime = rows.reduce((max, r) => {
        const t = new Date(r.date).getTime()
        return t > max ? t : max
      }, 0)
      
      return rows.filter((r) => new Date(r.date).getTime() === latestTime)
    }

    // Specific date - match exactly
    return rows.filter((r) => {
      const a = new Date(r.date).toISOString().slice(0, 10)
      const b = new Date(selectedDate).toISOString().slice(0, 10)
      return a === b
    })
  }

  // Apply date filter and transform
  const filteredRaw = filterByDate(rawData)
  const transformedData = transformData(filteredRaw)

  // Extract unique competitors from all data
  const competitors = Array.from(
    new Set(transformedData.flatMap((row) => Object.keys(row.prices)))
  )

  // Apply search filter (product name, code, competitor names)
  const data = transformedData.filter((row) => {
    if (!searchQuery.trim()) return true
    
    const q = searchQuery.toLowerCase().trim()
    
    // Check product name and code
    if (row.product_name?.toLowerCase().includes(q)) return true
    if (row.part_code?.toLowerCase().includes(q)) return true
    
    // Check competitor names
    const competitorNames = Object.keys(row.prices)
    if (competitorNames.some((name) => name.toLowerCase().includes(q))) return true
    
    return false
  })

  const updateCallEntry = (productId: string, competitorId: string, field: "price" | "status", value: string) => {
    setCallEntries(prev => {
      const existing = prev.find(e => e.productId === productId && e.competitorId === competitorId)
      if (existing) {
        return prev.map(e => 
          e.productId === productId && e.competitorId === competitorId
            ? { ...e, [field]: value }
            : e
        )
      }
      return [...prev, { productId, competitorId, price: field === "price" ? value : "", status: field === "status" ? value as PriceStatus : "" }]
    })
  }

  const getCallEntry = (productId: string, competitorId: string) => {
    return callEntries.find(e => e.productId === productId && e.competitorId === competitorId)
  }

  const filledCount = callEntries.filter(e => e.price || e.status).length

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/issues">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Конкуренты</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAddDataModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить новые данные
          </Button>
          <Button 
            size="sm" 
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAddCallModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить прозвон
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Search input with clear button */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[240px] pl-8 pr-8 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="products" className="h-7 px-3 text-xs">Товары</TabsTrigger>
              <TabsTrigger value="competitors" className="h-7 px-3 text-xs">Конкуренты</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Дата:</span>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <span className="text-xs text-muted-foreground">
          {data.length} записей × {competitors.length} конкурентов
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Загрузка данных...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Нет данных</div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-20 bg-muted/95 px-3 py-2 text-left font-medium text-muted-foreground">
                  Дата
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Менеджер
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Товар
                </th>
                {competitors.map((competitor) => (
                  <th key={competitor} className="px-3 py-2 text-center font-medium text-muted-foreground min-w-[100px]">
                    <div>{competitor}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr 
                  key={`${row.date}__${row.part_code}`} 
                  className={`border-b border-border hover:bg-muted/30 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-muted-foreground">
                    {row.date ? formatDateRu(row.date) : "-"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.manager || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{row.product_name}</div>
                    <div className="text-[10px] text-muted-foreground">{row.part_code}</div>
                  </td>
                  {competitors.map((competitor) => {
                    const item = row.prices[competitor]
                    if (!item) return <td key={competitor} className="px-3 py-2 text-center text-muted-foreground">-</td>
                    
                    return (
                      <td key={competitor} className="px-3 py-2 text-center text-muted-foreground">
                        {item.status === "price" && item.price
                          ? `${Number(item.price).toLocaleString("ru-RU")} ₽`
                          : item.status === "no"
                          ? "Нет"
                          : item.status === "no_answer"
                          ? "Не отв."
                          : "-"}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Data Modal */}
      <Dialog open={addDataModalOpen} onOpenChange={setAddDataModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Добавить новые данные</DialogTitle>
          </DialogHeader>
          
          <Tabs value={addDataTab} onValueChange={setAddDataTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="product" className="gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" />
                Товар
              </TabsTrigger>
              <TabsTrigger value="competitor" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                Конкурент
              </TabsTrigger>
              <TabsTrigger value="manager" className="gap-1.5 text-xs">
                <UserCircle className="h-3.5 w-3.5" />
                Менеджер
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-4 pt-2">
            {addDataTab === "product" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Товар <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Начните вводить код товара..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить товар
                </Button>
              </>
            )}
            {addDataTab === "competitor" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Конкурент <span className="text-destructive">*</span>
                  </label>
                  <Input placeholder="Название конкурента..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Телефон</label>
                  <Input placeholder="Телефон конкурента..." />
                </div>
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить конкурента
                </Button>
              </>
            )}
            {addDataTab === "manager" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Менеджер <span className="text-destructive">*</span>
                  </label>
                  <Input placeholder="Имя менеджера..." />
                </div>
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Добавить менеджера
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDataModalOpen(false)}>
              Зак��ыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Call Modal */}
      <Dialog open={addCallModalOpen} onOpenChange={setAddCallModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Добавить прозвон</DialogTitle>
          </DialogHeader>
          
          {/* Top row: Date and Manager */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Дата:</span>
                <span className="font-medium">{callDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Менеджер:</span>
                <Select value={callManager} onValueChange={setCallManager}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Выберите менедж" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Заполнено: {filledCount} ячеек
            </div>
          </div>

          {/* Call table */}
          <div className="flex-1 overflow-auto min-h-0 border rounded-md">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted/95">
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-20 bg-muted/95 px-3 py-2 text-left font-medium text-muted-foreground min-w-[180px]">
                    Товар
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground min-w-[80px]">
                    Максимум
                  </th>
                  {competitors.map((competitor) => (
                    <th key={competitor} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[120px]">
                      <div>{competitor}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr 
                    key={row.part_code} 
                    className={`border-b border-border ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                      <div className="font-medium text-foreground">{row.product_name}</div>
                      <div className="text-[10px] text-muted-foreground">{row.part_code}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">
                      -
                    </td>
                    {competitors.map((competitor) => {
                      const entry = getCallEntry(row.part_code, competitor)
                      return (
                        <td key={competitor} className="px-1 py-1">
                          <div className="flex flex-col gap-1">
                            <Input
                              placeholder="Цена"
                              value={entry?.price || ""}
                              onChange={(e) => updateCallEntry(row.part_code, competitor, "price", e.target.value)}
                              className="h-7 text-xs text-center"
                            />
                            <Select 
                              value={entry?.status || ""} 
                              onValueChange={(v) => updateCallEntry(row.part_code, competitor, "status", v)}
                            >
                              <SelectTrigger className="h-7 text-[10px]">
                                <SelectValue placeholder="Есть цена" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="has_price" className="text-xs">Есть цена</SelectItem>
                                <SelectItem value="no" className="text-xs">Нет</SelectItem>
                                <SelectItem value="no_answer" className="text-xs">Не отв.</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <DialogFooter className="flex-shrink-0 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setAddCallModalOpen(false)} className="gap-2">
              <X className="h-4 w-4" />
              Отмена
            </Button>
            <Button disabled={filledCount === 0} className="gap-2">
              Сохранить ({filledCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
