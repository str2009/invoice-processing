export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  // Берём id из пути вручную
  const segments = request.nextUrl.pathname.split("/")
  const id = segments[segments.length - 1]

  if (!id || id === "invoice") {
    return NextResponse.json(
      { error: "Missing invoice id" },
      { status: 400 }
    )
  }

  const decodedId = decodeURIComponent(id)

  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from("invoice_rows")
    .select("*")
    .eq("invoice_id", decodedId)
    .order("id")

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
