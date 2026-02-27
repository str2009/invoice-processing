export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const decodedId = decodeURIComponent(id)

  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from("invoice_rows")
    .select("*")
    .eq("invoice_id", decodedId)
    .order("id")

  return NextResponse.json({
    rawId: id,
    decodedId,
    length: id.length,
    rowsFound: data?.length ?? 0,
    sampleRow: data?.[0] ?? null,
    error: error?.message ?? null,
  })
}
