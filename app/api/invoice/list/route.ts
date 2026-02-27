import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = getSupabaseServer()

    const { data, error } = await supabase
      .from("invoice")
      .select("invoice_id, created_at, supplier, total_amount_document")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error("Unhandled error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
