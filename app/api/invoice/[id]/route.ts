export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params

  console.log("=== API DEBUG START ===")
  console.log("RAW PARAM ID:", id)
  console.log("ID LENGTH:", id?.length)

  const decodedId = decodeURIComponent(id)
  console.log("DECODED ID:", decodedId)
  console.log("DECODED LENGTH:", decodedId?.length)

  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from("invoice_rows")
    .select("*")
    .eq("invoice_id", decodedId)
    .order("id")

  console.log("ROWS FOUND:", data?.length)

  if (error) {
    console.error("SUPABASE ERROR:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("=== API DEBUG END ===")

  return NextResponse.json(data)
}
