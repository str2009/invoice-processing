import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabase
      .from("shipment")
      .select("*")
      .eq("shipment_id", id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Error fetching shipment:", err)
    return NextResponse.json(
      { error: err.message || "Failed to fetch shipment" },
      { status: 500 }
    )
  }
}
