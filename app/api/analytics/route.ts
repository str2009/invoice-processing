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
    console.log("[v0] Analytics webhook response - isArray:", Array.isArray(data), "length:", Array.isArray(data) ? data.length : "N/A")

    // API returns a plain array, pass it through as-is
    return Response.json(data)
  } catch (error) {
    console.error("Analytics API ERROR:", error)
    return Response.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
