import { NextRequest, NextResponse } from "next/server"

// Types for the response
interface AnalyticsData {
  price_best: number
  offers: number
  sold_12m: number
  days_no_sales: number
}

interface AnalogItem {
  part_brand_key: string
  brand: string
  price: number
  stock: number
}

interface HistoryItem {
  date: string
  supplier: string
  price: number
  qty: number
}

interface PartDetailsResponse {
  analytics: AnalyticsData
  analogs: AnalogItem[]
  history: HistoryItem[]
}

// Mock data generator for demonstration
function generateMockData(partBrandKey: string): PartDetailsResponse {
  // Use partBrandKey as seed for consistent mock data
  const seed = partBrandKey.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const seededRandom = (n: number) => {
    const x = Math.sin(seed * n) * 10000
    return x - Math.floor(x)
  }

  // Generate analytics
  const analytics: AnalyticsData = {
    price_best: Math.round(seededRandom(1) * 200 + 20),
    offers: Math.floor(seededRandom(2) * 15) + 1,
    sold_12m: Math.floor(seededRandom(3) * 500) + 10,
    days_no_sales: Math.floor(seededRandom(4) * 90),
  }

  // Generate analogs (2-6 items)
  const analogCount = Math.floor(seededRandom(5) * 5) + 2
  const brands = ["Bosch", "Denso", "NGK", "Brembo", "Monroe", "Gates", "SKF", "Valeo", "LuK", "Sachs"]
  const analogs: AnalogItem[] = Array.from({ length: analogCount }, (_, i) => ({
    part_brand_key: `AN-${String(Math.floor(seededRandom(10 + i) * 9000) + 1000)}-${String.fromCharCode(65 + (i % 26))}`,
    brand: brands[Math.floor(seededRandom(20 + i) * brands.length)],
    price: Math.round((seededRandom(30 + i) * 150 + 15) * 100) / 100,
    stock: Math.floor(seededRandom(40 + i) * 200),
  }))

  // Generate history (3-8 items)
  const historyCount = Math.floor(seededRandom(6) * 6) + 3
  const suppliers = ["Auto Parts Co", "Global Parts", "Euro Spares", "OEM Direct", "Parts Plus", "QuickParts"]
  const history: HistoryItem[] = Array.from({ length: historyCount }, (_, i) => {
    const daysAgo = Math.floor(seededRandom(50 + i) * 365)
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return {
      date: date.toISOString().split("T")[0],
      supplier: suppliers[Math.floor(seededRandom(60 + i) * suppliers.length)],
      price: Math.round((seededRandom(70 + i) * 100 + 10) * 100) / 100,
      qty: Math.floor(seededRandom(80 + i) * 50) + 1,
    }
  })

  return { analytics, analogs, history }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { part_brand_key } = body

    if (!part_brand_key) {
      return NextResponse.json(
        { error: "part_brand_key is required" },
        { status: 400 }
      )
    }

    // Simulate network delay for realistic async behavior
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400))

    // In production, this would fetch from a database or external API
    // For now, generate mock data based on the part_brand_key
    const data = generateMockData(part_brand_key)

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in part-details API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
