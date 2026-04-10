export async function POST(req: Request) {
  try {
    const body = await req.json()

    const res = await fetch(
      "https://max24vin.ru/webhook/f74f751a-126a-get_part_details",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    const data = await res.json()

    return Response.json(data)
  } catch (error) {
    console.error("API ERROR:", error)
    return Response.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
