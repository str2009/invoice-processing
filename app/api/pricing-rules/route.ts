import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("sort_order")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const rules = body.rules ?? []

  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: "Invalid rules" }, { status: 400 })
  }

  const insertRows = rules.map((r: any, i: number) => ({
    from_price: Number(r.fromPrice),
    to_price: Number(r.toPrice),
    markup_pct: Number(r.markupPct),
    pricing_group: r.pricingGroup,
    sort_order: i + 1,
  }))

  // удаляем старые правила
  await supabase
    .from("pricing_rules")
    .delete()
    .gt("sort_order", -1)

  // вставляем новые
  const { error } = await supabase
    .from("pricing_rules")
    .insert(insertRows)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}