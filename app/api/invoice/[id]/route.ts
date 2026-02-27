export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from("invoice_rows")
    .select("*")
    .eq("invoice_id", id)
    .order("id")

  if (error) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
