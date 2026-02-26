import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET() {
const supabase = getSupabaseServer()
const { data, error } = await supabase
    .from("invoice")
    .select("invoice_id, created_at, supplier, total_amount_document")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json(data)
}
