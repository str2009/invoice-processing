import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

// ---------------------------------------------------------------------------
// GET  — Read enriched rows from invoice_rows_enriched (post-enrich reload)
// POST — Trigger n8n enrichment webhook, parse response, return rows
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

const supabase = getSupabaseServer()

const { data, error } = await supabase
  .from("invoice_rows_enriched")
  .select("*")
  .eq("invoice_id", id)
  .order("id")

    if (error) {
      console.error("[enriched GET] Supabase error:", error)
      return NextResponse.json(
        { success: false, error: "Database query failed", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, rows: data ?? [] })
  } catch (err) {
    console.error("[enriched GET] Unhandled error:", err)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Call n8n enrichment webhook
    console.log(`[enriched POST] Triggering webhook for invoice_id=${id}`)
    const webhookUrl = "https://max24vin.ru/webhook/invoice-enriched-data"

    let webhookRes: Response
    try {
      webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: id }),
      })
    } catch (fetchErr) {
      console.error("[enriched POST] Webhook fetch failed:", fetchErr)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to reach enrichment webhook",
          details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        },
        { status: 502 }
      )
    }

    if (!webhookRes.ok) {
      const body = await webhookRes.text().catch(() => "")
      console.error(`[enriched POST] Webhook returned ${webhookRes.status}:`, body)
      return NextResponse.json(
        {
          success: false,
          error: `Webhook responded with ${webhookRes.status}`,
          details: body.slice(0, 500),
        },
        { status: 502 }
      )
    }

    // 2. Parse webhook response robustly
    const rawText = await webhookRes.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      console.error("[enriched POST] Failed to parse webhook JSON:", rawText.slice(0, 300))
      return NextResponse.json(
        {
          success: false,
          error: "Webhook returned invalid JSON",
          details: rawText.slice(0, 500),
        },
        { status: 502 }
      )
    }

    // 3. Extract rows array from response
    //    Supports: plain array, { rows: [] }, { data: [] }, { result: [] },
    //    nested array [[...]], n8n format [{ json: {...} }]
    const rows = extractRows(parsed)

    console.log(`[enriched POST] Extracted ${rows.length} enriched rows for ${id}`)

    return NextResponse.json({ success: true, rows })
  } catch (err) {
    console.error("[enriched POST] Unhandled error:", err)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Robust row extraction from arbitrary webhook shapes
// ---------------------------------------------------------------------------
function extractRows(val: unknown): Record<string, unknown>[] {
  if (!val) return []

  // Plain array
  if (Array.isArray(val)) {
    // Nested array: [[{...}, {...}]]
    if (val.length > 0 && Array.isArray(val[0])) {
      return val[0] as Record<string, unknown>[]
    }
    // n8n output nodes: [{ json: {...} }, { json: {...} }]
    if (
      val.length > 0 &&
      val[0] &&
      typeof val[0] === "object" &&
      "json" in (val[0] as Record<string, unknown>)
    ) {
      return val.map(
        (item) => ((item as Record<string, unknown>).json ?? item) as Record<string, unknown>
      )
    }
    // Direct array of objects
    return val as Record<string, unknown>[]
  }

  // Wrapper object with known keys
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>
    for (const key of ["rows", "data", "items", "result", "output"]) {
      if (Array.isArray(obj[key])) {
        return extractRows(obj[key])
      }
    }
  }

  return []
}
