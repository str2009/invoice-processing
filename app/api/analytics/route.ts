export async function POST(req: Request) {
  try {
    const body = await req.json()

    const res = await fetch(
      "https://max24vin.ru/webhook/analytics-599effdf",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    const data = await res.json()
    console.log("[v0] Analytics webhook response - isArray:", Array.isArray(data), "type:", typeof data, "keys:", Object.keys(data || {}))
    
    // Try to extract array from response - webhook may wrap it in an object
    let rows: unknown[]
    if (Array.isArray(data)) {
      rows = data
    } else if (data && typeof data === "object") {
      // Check common wrapper keys
      rows = data.rows ?? data.data ?? data.items ?? data.result ?? []
      console.log("[v0] Extracted rows from object, count:", rows.length)
    } else {
      rows = []
    }
    
    return Response.json(rows)
  } catch (error) {
    console.error("Analytics API ERROR:", error)
    return Response.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
