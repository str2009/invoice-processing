import Link from "next/link"

export default function InvoiceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <div style={{ padding: 24 }}>
      <h2>Invoice: {params.id}</h2>

      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <Link href={`/invoice/${params.id}`}>
          Pricing
        </Link>

        <Link href={`/invoice/${params.id}/shipping`}>
          Shipping
        </Link>
      </div>

      <div>{children}</div>
    </div>
  )
}