export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(
  request: Request,
  context: { params?: { id?: string } }
) {
  // 1. пробуем взять из сегмента
  let id = context?.params?.id

  // 2. если нет — пробуем взять из query (?nxtPid=...)
  if (!id) {
    const url = new URL(request.url)
    id = url.searchParams.get("nxtPid") ?? undefined
  }

  if (!id) {
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

  return NextResponse.json({
    rawId: id,
    decodedId,
    rowsFound: data?.length ?? 0,
    error: error?.message ?? null,
  })
}
