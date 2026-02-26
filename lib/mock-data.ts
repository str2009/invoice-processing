export interface InvoiceListItem {
  invoice_id: string
  created_at: string
  supplier: string | null
  total_amount_document: number | null
}

export interface InvoiceRow {
  id: string
  partCode: string
  manufacturer: string
  partName: string
  qty: number
  cost: number
  now: number
  ship: number
  deltaPercent: number
  stock: number
  weight: number
  productGroup: string
  sales12m: number
}

const _mockInvoiceData: InvoiceRow[] = [
  { id: "1", partCode: "BRK-4421-A", manufacturer: "Brembo", partName: "Колодки тормозные передние дисковые", qty: 20, cost: 52.30, now: 89.99, ship: 94.50, deltaPercent: 5.0, stock: 145, weight: 2.4, productGroup: "Brake Pads", sales12m: 312 },
  { id: "2", partCode: "FLT-0087-C", manufacturer: "Mann-Filter", partName: "Фильтр воздушный двигателя", qty: 100, cost: 6.80, now: 12.50, ship: 13.20, deltaPercent: 5.6, stock: 340, weight: 0.3, productGroup: "Filters", sales12m: 1840 },
  { id: "3", partCode: "SPK-1192-X", manufacturer: "NGK", partName: "Свеча зажигания K20TR11", qty: 200, cost: 3.20, now: 7.99, ship: 8.50, deltaPercent: 6.4, stock: 520, weight: 0.1, productGroup: "Spark Plugs", sales12m: 4200 },
  { id: "4", partCode: "CLT-5583-B", manufacturer: "LuK/Sachs", partName: "Сальник вала переключения передач МКПП", qty: 4, cost: 142.00, now: 245.00, ship: 258.75, deltaPercent: 5.6, stock: 18, weight: 6.8, productGroup: "Clutch Kits", sales12m: 36 },
  { id: "5", partCode: "BLT-7729-D", manufacturer: "Gates", partName: "Ремень ГРМ комплект с роликами", qty: 50, cost: 18.90, now: 34.99, ship: 36.50, deltaPercent: 4.3, stock: 88, weight: 0.5, productGroup: "Belts", sales12m: 580 },
  { id: "6", partCode: "SHK-3301-E", manufacturer: "Monroe", partName: "Амортизатор задний газовый", qty: 12, cost: 38.40, now: 67.50, ship: 72.00, deltaPercent: 6.7, stock: 62, weight: 3.1, productGroup: "Suspension", sales12m: 124 },
  { id: "7", partCode: "RAD-8842-F", manufacturer: "Nissens", partName: "Радиатор охлаждения двигателя TOYOTA LAND CRUISER PRADO (J15)", qty: 3, cost: 108.00, now: 189.00, ship: 199.50, deltaPercent: 5.6, stock: 12, weight: 8.2, productGroup: "Cooling", sales12m: 28 },
  { id: "8", partCode: "IGN-2218-G", manufacturer: "Bosch/Delphi", partName: "Катушка зажигания индивидуальная", qty: 30, cost: 22.50, now: 42.00, ship: 44.10, deltaPercent: 5.0, stock: 75, weight: 0.4, productGroup: "Ignition", sales12m: 390 },
  { id: "9", partCode: "OIL-6654-H", manufacturer: "Castrol", partName: "Масло ГУР ВАЛЕРА -50*C, 1л канистра", qty: 60, cost: 16.20, now: 28.99, ship: 31.00, deltaPercent: 6.9, stock: 410, weight: 4.5, productGroup: "Lubricants", sales12m: 2100 },
  { id: "10", partCode: "WHL-9903-J", manufacturer: "SKF", partName: "Подшипник ступицы передний", qty: 8, cost: 30.80, now: 55.00, ship: 58.25, deltaPercent: 5.9, stock: 48, weight: 1.8, productGroup: "Wheel Bearings", sales12m: 72 },
  { id: "11", partCode: "EXH-1147-K", manufacturer: "Walker", partName: "Втулка амортизатора TOYOTA LAND CRUISER PRADO (J15) (TRJ150, TRJ155)", qty: 2, cost: 78.20, now: 134.50, ship: 0, deltaPercent: -100, stock: 7, weight: 5.6, productGroup: "Exhaust", sales12m: 14 },
  { id: "12", partCode: "STR-4478-L", manufacturer: "Valeo", partName: "Стартер 12В 1.4кВт", qty: 5, cost: 99.00, now: 175.00, ship: 184.50, deltaPercent: 5.4, stock: 22, weight: 4.2, productGroup: "Starters", sales12m: 48 },
  { id: "13", partCode: "ALT-3390-M", manufacturer: "Denso", partName: "Генератор 14В 120А", qty: 4, cost: 120.00, now: 210.00, ship: 218.50, deltaPercent: 4.0, stock: 15, weight: 5.1, productGroup: "Alternators", sales12m: 32 },
  { id: "14", partCode: "WPR-5512-N", manufacturer: "Bosch", partName: "Щетка стеклоочистителя бескаркасная 600мм", qty: 80, cost: 8.50, now: 18.99, ship: 19.99, deltaPercent: 5.3, stock: 230, weight: 0.2, productGroup: "Wipers", sales12m: 960 },
  { id: "15", partCode: "THM-7781-P", manufacturer: "Wahler", partName: "Термостат системы охлаждения", qty: 25, cost: 12.80, now: 24.50, ship: 26.00, deltaPercent: 6.1, stock: 92, weight: 0.3, productGroup: "Thermostats", sales12m: 240 },
]

// Generate additional rows to reach 100+ total
const partPrefixes = ["BRK","FLT","SPK","CLT","BLT","SHK","RAD","IGN","OIL","WHL","EXH","STR","ALT","WPR","THM","PMP","SNS","GSK","VLV","ARM"]
const manufacturers = ["Bosch","Denso","NGK","Brembo","Monroe","Gates","SKF","Valeo","LuK","Sachs","Mann-Filter","Mahle","Hella","TRW","Continental","Dayco","INA","FAG","NTN","Aisin"]
const groups = ["Brake Pads","Filters","Spark Plugs","Clutch Kits","Belts","Suspension","Cooling","Ignition","Lubricants","Wheel Bearings","Exhaust","Starters","Alternators","Wipers","Thermostats","Pumps","Sensors","Gaskets","Valves","Arms"]
const partNames = [
  "Колодки тормозные передние дисковые",
  "Колодки тормозные задние барабанные",
  "Фильтр масляный двигателя",
  "Фильтр воздушный двигателя",
  "Фильтр салонный угольный",
  "Свеча зажигания иридиевая",
  "Свеча зажигания платиновая",
  "Сальник коленвала передний",
  "Сальник коленвала задний",
  "Сальник привода заднего 38342-4N500",
  "Ремень ГРМ усиленный",
  "Ремень поликлиновый 6PK1780",
  "Амортизатор передний газомасляный",
  "Амортизатор задний газовый",
  "Радиатор охлаждения АКПП",
  "Радиатор кондиционера (конденсер)",
  "Катушка зажигания индивидуальная",
  "Модуль зажигания в сборе",
  "Масло моторное 5W-30 синтетика 4л",
  "Масло трансмиссионное 75W-90 GL-5 1л",
  "Подшипник ступицы задний",
  "Подшипник ступицы передний комплект",
  "Прокладка клапанной крышки",
  "Прокладка ГБЦ металлическая",
  "Стартер 12В 2.0кВт",
  "Генератор 14В 150А с муфтой",
  "Щетка стеклоочистителя гибридная 500мм",
  "Термостат с корпусом в сборе",
  "Помпа водяная (насос ОЖ)",
  "Датчик кислорода (лямбда-зонд) верхний",
  "Датчик температуры ОЖ",
  "Датчик ABS передний левый",
  "Клапан EGR (рециркуляция выхлопных газов)",
  "Рычаг подвески передний нижний левый",
  "Рычаг подвески передний нижний правый",
  "Опора амортизатора передняя",
  "Втулка стабилизатора переднего D23",
  "Стойка стабилизатора переднего",
  "Шаровая опора нижняя",
  "Наконечник рулевой тяги правый",
]

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

for (let i = 16; i <= 120; i++) {
  const prefix = partPrefixes[Math.floor(seededRandom(i * 2) * partPrefixes.length)]
  const num = String(Math.floor(seededRandom(i * 3) * 9000 + 1000))
  const suffix = String.fromCharCode(65 + (i % 26))
  const cost = Math.round((seededRandom(i * 5) * 150 + 3) * 100) / 100
  const now = Math.round(cost * (1.6 + seededRandom(i * 7) * 0.8) * 100) / 100
  const hasShip = seededRandom(i * 9) > 0.15
  const ship = hasShip ? Math.round(now * (0.98 + seededRandom(i * 11) * 0.12) * 100) / 100 : 0
  const deltaPercent = hasShip ? Math.round(((ship - now) / now) * 1000) / 10 : -100

  _mockInvoiceData.push({
    id: String(i),
    partCode: `${prefix}-${num}-${suffix}`,
    manufacturer: manufacturers[Math.floor(seededRandom(i * 4) * manufacturers.length)],
    partName: partNames[Math.floor(seededRandom(i * 14) * partNames.length)],
    qty: Math.floor(seededRandom(i * 6) * 100) + 1,
    cost,
    now,
    ship,
    deltaPercent,
    stock: Math.floor(seededRandom(i * 8) * 500),
    weight: Math.round(seededRandom(i * 10) * 12 * 10) / 10,
    productGroup: groups[Math.floor(seededRandom(i * 12) * groups.length)],
    sales12m: Math.floor(seededRandom(i * 13) * 3000),
  })
}

export const mockInvoiceData: InvoiceRow[] = _mockInvoiceData

export const mockLogs: string[] = [
  "[10:23:01] Session started",
  "[10:23:02] File loaded: invoice_feb_2026.csv",
  "[10:23:02] Detected 247 rows, 14 columns",
  "[10:23:03] Parsing header row... OK",
  "[10:23:04] Validating part codes...",
  "[10:23:05] 241/247 codes validated",
  "[10:23:06] 6 codes flagged for review",
  "[10:23:07] Running brand normalization...",
  "[10:23:08] Matched 238 brands to catalog",
  "[10:23:09] 3 ambiguous brand entries detected",
  "[10:23:10] Cross-referencing with current inventory...",
  "[10:23:12] Price delta analysis complete",
  "[10:23:13] 42 items with price changes detected",
  "[10:23:14] 8 new items identified",
  "[10:23:15] Parse complete. Ready for review.",
]
