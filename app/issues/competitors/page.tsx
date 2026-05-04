"use client"

import { useState } from "react"
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

// Mock competitors
const competitors = [
  { id: "1", name: "Максимум", phone: null },
  { id: "2", name: "Молод 19", phone: null },
  { id: "3", name: "Авто Хаус", phone: "908-030-50-52" },
  { id: "4", name: "Автодело", phone: "38-41-41" },
  { id: "5", name: "Автоман", phone: "902-948-03-03" },
  { id: "6", name: "Все запчасти", phone: "33-88-88" },
  { id: "7", name: "Круглое озеро", phone: "48-33-21" },
  { id: "8", name: "Серега (сосед)", phone: null },
  { id: "9", name: "Pit Stop", phone: "908-033-44-70" },
  { id: "10", name: "SYSTEM", phone: null },
]

// Mock products
const products = [
  { id: "1", name: "антифриз AGA 5л желтый", code: "AGA043Z", maxPrice: 2400, molodPrice: 2350 },
  { id: "2", name: "антифриз AGA,1л (красный)", code: "AGA001Z", maxPrice: 550, molodPrice: 500 },
  { id: "3", name: "антифриз AGA,5л (красный)", code: "AGA002Z", maxPrice: 2200, molodPrice: 2200 },
  { id: "4", name: "антифриз TOTACHI 1л зеленый", code: "41701", maxPrice: 500, molodPrice: 580 },
  { id: "5", name: "антифриз TOTACHI 5л красный", code: "41905", maxPrice: 2200, molodPrice: 2200 },
  { id: "6", name: "антифриз TOTACHI SUPER LONG LIFE 10л красный", code: "41910", maxPrice: 3900, molodPrice: 3750 },
  { id: "7", name: "масло HYUNDAI/KIA Turbo SYN Gasoline,5w30,4л", code: "05100-00441", maxPrice: 7050, molodPrice: 5800 },
]

// Mock call data
const mockCallData = [
  {
    id: "1",
    date: "04.05.2026",
    manager: "Стас",
    product: "антифриз AGA 5л желтый",
    code: "AGA043Z",
    prices: { "Максимум": 2400, "Молод 19": 2350 },
  },
  {
    id: "2",
    date: "04.05.2026",
    manager: "Стас",
    product: "антифриз AGA,1л (красный)",
    code: "AGA001Z",
    prices: { "Максимум": 550, "Молод 19": 500 },
  },
]

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
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("products")
  const [dateFilter, setDateFilter] = useState("last")
  
  // Modal states
  const [addDataModalOpen, setAddDataModalOpen] = useState(false)
  const [addCallModalOpen, setAddCallModalOpen] = useState(false)
  const [addDataTab, setAddDataTab] = useState("product")
  const [productSearch, setProductSearch] = useState("")
  
  // Call modal state
  const [callDate] = useState(new Date().toLocaleDateString("ru-RU"))
  const [callManager, setCallManager] = useState("")
  const [callEntries, setCallEntries] = useState<CallEntry[]>([])

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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="products" className="h-7 px-3 text-xs">Товары</TabsTrigger>
              <TabsTrigger value="competitors" className="h-7 px-3 text-xs">Конкуренты</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Дата:</span>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last" className="text-xs">Последний прозвон</SelectItem>
                <SelectItem value="week" className="text-xs">За неделю</SelectItem>
                <SelectItem value="month" className="text-xs">За месяц</SelectItem>
                <SelectItem value="all" className="text-xs">Все время</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по товару, коду, конкуренту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[280px] pl-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {mockCallData.length} записей × {competitors.length} конкурентов
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr className="border-b border-border">
              <th className="sticky left-0 z-20 bg-muted/95 px-3 py-2 text-left font-medium text-muted-foreground">
                Товар
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Максимум
              </th>
              {competitors.map((competitor) => (
                <th key={competitor.id} className="px-3 py-2 text-center font-medium text-muted-foreground min-w-[100px]">
                  <div>{competitor.name}</div>
                  {competitor.phone && (
                    <div className="text-[10px] font-normal text-muted-foreground/70">{competitor.phone}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => (
              <tr 
                key={product.id} 
                className={`border-b border-border hover:bg-muted/30 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
              >
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                  <div className="font-medium text-foreground">{product.name}</div>
                  <div className="text-[10px] text-muted-foreground">{product.code}</div>
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground">
                  {product.maxPrice.toLocaleString("ru-RU")} ₽
                </td>
                {competitors.map((competitor) => {
                  const price = competitor.name === "Молод 19" ? product.molodPrice : null
                  return (
                    <td key={competitor.id} className="px-3 py-2 text-center text-muted-foreground">
                      {price ? `${price.toLocaleString("ru-RU")} ₽` : "-"}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
              Закрыть
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
                  {competitors.slice(1).map((competitor) => (
                    <th key={competitor.id} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[120px]">
                      <div>{competitor.name}</div>
                      {competitor.phone && (
                        <div className="text-[10px] font-normal text-muted-foreground/70">{competitor.phone}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product, idx) => (
                  <tr 
                    key={product.id} 
                    className={`border-b border-border ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                      <div className="font-medium text-foreground">{product.name}</div>
                      <div className="text-[10px] text-muted-foreground">{product.code}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">
                      {product.maxPrice.toLocaleString("ru-RU")} ₽
                    </td>
                    {competitors.slice(1).map((competitor) => {
                      const entry = getCallEntry(product.id, competitor.id)
                      return (
                        <td key={competitor.id} className="px-1 py-1">
                          <div className="flex flex-col gap-1">
                            <Input
                              placeholder="Цена"
                              value={entry?.price || ""}
                              onChange={(e) => updateCallEntry(product.id, competitor.id, "price", e.target.value)}
                              className="h-7 text-xs text-center"
                            />
                            <Select 
                              value={entry?.status || ""} 
                              onValueChange={(v) => updateCallEntry(product.id, competitor.id, "status", v)}
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
