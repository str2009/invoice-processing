import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

// Bulk check for comments on multiple part_brand_keys
export async function POST(request: Request) {
  try {
    const { keys } = await request.json()

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({})
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("part_comments")
      .select("part_brand_key")
      .in("part_brand_key", keys)
      .not("comment", "is", null)
      .neq("comment", "")

    if (error) {
      return NextResponse.json({})
    }

    // Create a map of part_brand_key -> true for items with comments
    const commentsMap: Record<string, boolean> = {}
    if (data) {
      for (const row of data) {
        commentsMap[row.part_brand_key] = true
      }
    }

    return NextResponse.json(commentsMap)
  } catch {
    return NextResponse.json({})
  }
}
