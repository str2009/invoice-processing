export async function GET() {
  try {
    const res = await fetch("https://max24vin.ru/webhook/qr-strich-code-max_24", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "Issues",
        task: "competitors",
        warehouse: "Салют",
      }),
    })

    const data = await res.json()

    // Handle n8n response format (sometimes returns { data: [] })
    const rows = Array.isArray(data) ? data : data.data || []

    return Response.json(rows)
  } catch (error) {
    console.error("Competitors API error:", error)
    return Response.json({ error: "Failed to fetch competitors data" }, { status: 500 })
  }
}
