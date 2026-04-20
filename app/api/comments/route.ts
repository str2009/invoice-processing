import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const partBrandKey = searchParams.get("part_brand_key")

  if (!partBrandKey) {
    return NextResponse.json({ error: "part_brand_key is required" }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("part_comments")
      .select("*")
      .eq("part_brand_key", partBrandKey)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || null)
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch comment" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { part_brand_key, comment, manager, source } = body

    if (!part_brand_key) {
      return NextResponse.json({ error: "part_brand_key is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("part_comments")
      .upsert(
        {
          part_brand_key,
          comment: comment || "",
          manager: manager || "system",
          source: source || "analytics",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "part_brand_key" }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 })
  }
}
