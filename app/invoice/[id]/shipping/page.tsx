"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"

export default function ShippingPage() {
  const params = useParams()
  const invoiceId = params.id as string

  const [form, setForm] = useState({
    transport_company: "",
    transport_type: "",
    transport_invoice_number: "",
    transport_date: "",
    received_date: "",
    shipping_total_cost: "",
    shipping_total_weight: "",
    shipping_total_volume: "",
    shipping_density: "",
    shipping_comment: "",
    packages_count: "",
    goods_total_value: "",
    goods_value_per_kg: "",
  })

  const [status, setStatus] = useState<string | null>(null)
  const [columnSizing, setColumnSizing] = useState({})

  useEffect(() => {
    if (!invoiceId) return
  
    async function loadData() {
      try {
        const res = await fetch(
          `/api/invoice/get-shipping?invoice_id=${encodeURIComponent(invoiceId)}`
        )
  
        const json = await res.json()
  
        if (!res.ok || !json.data) return
  
        const d = json.data
  
        setForm({
          transport_company: d.transport_company ?? "",
          transport_type: d.transport_type ?? "",
          transport_invoice_number: d.transport_invoice_number ?? "",
          transport_date: d.transport_date ?? "",
          received_date: d.received_date ?? "",
          shipping_total_cost: String(d.shipping_total_cost ?? ""),
          shipping_total_weight: String(d.shipping_total_weight ?? ""),
          shipping_total_volume: String(d.shipping_total_volume ?? ""),
          shipping_density: String(d.shipping_density ?? ""),
          shipping_comment: d.shipping_comment ?? "",
          packages_count: String(d.packages_count ?? ""),
          goods_total_value: String(d.goods_total_value ?? ""),
          goods_value_per_kg: String(d.goods_value_per_kg ?? ""),
        })
      } catch (err) {
        console.error("Failed to load shipping", err)
      }
    }
  
    loadData()
  }, [invoiceId])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("Saving...")

    const res = await fetch("/api/invoice/update-shipping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoiceId,
        ...form,
      }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus("Saved successfully")
    } else {
      setStatus("Error: " + data.error)
    }
  }

  const shippingPerKg =
    form.shipping_total_weight && form.shipping_total_cost
      ? (
          Number(form.shipping_total_cost) /
          Number(form.shipping_total_weight)
        ).toFixed(2)
      : "—"

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-semibold">Shipping</h1>
        <div className="text-sm text-muted-foreground">
          Invoice: {invoiceId}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-10">

        {/* LEFT SIDE */}
        <div className="col-span-2 space-y-8">

          <Card title="Transport">
            <div className="grid grid-cols-2 gap-6">

              <Input label="Company">
                <input
                  name="transport_company"
                  value={form.transport_company}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Type">
                <input
                  name="transport_type"
                  value={form.transport_type}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Invoice №">
                <input
                  name="transport_invoice_number"
                  value={form.transport_invoice_number}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Packages">
                <input
                  type="number"
                  name="packages_count"
                  value={form.packages_count}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Transport Date">
                <input
                  type="date"
                  name="transport_date"
                  value={form.transport_date}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Received Date">
                <input
                  type="date"
                  name="received_date"
                  value={form.received_date}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

            </div>

            <div className="mt-6">
              <label className="label">Comment</label>
              <textarea
                name="shipping_comment"
                value={form.shipping_comment}
                onChange={handleChange}
                rows={3}
                className="textarea"
              />
            </div>
          </Card>

          <Card title="Shipping Cost">
            <div className="grid grid-cols-4 gap-6">

              <Input label="Total Cost">
                <input
                  type="number"
                  name="shipping_total_cost"
                  value={form.shipping_total_cost}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Weight (kg)">
                <input
                  type="number"
                  name="shipping_total_weight"
                  value={form.shipping_total_weight}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Volume (m³)">
                <input
                  type="number"
                  name="shipping_total_volume"
                  value={form.shipping_total_volume}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

              <Input label="Density">
                <input
                  type="number"
                  name="shipping_density"
                  value={form.shipping_density}
                  onChange={handleChange}
                  className="input"
                />
              </Input>

            </div>
          </Card>

        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-8">

          <Card title="Economics">
            <Metric label="Goods Total Value" value={form.goods_total_value || "—"} />
            <Metric label="Goods Value per kg" value={form.goods_value_per_kg || "—"} />
            <Metric label="Shipping per kg" value={shippingPerKg} />
          </Card>

        </div>

        {/* ACTION BAR */}
        <div className="col-span-3 flex justify-between items-center pt-6 border-t border-border">
          <div className="text-sm text-muted-foreground">{status}</div>
          <button
            type="submit"
            className="px-5 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Save Shipping
          </button>
        </div>

      </form>
    </div>
  )
}

/* ================= COMPONENTS ================= */

function Card({ title, children }: any) {
  return (
    <div className="bg-card border border-border rounded-2xl p-8">
      <h3 className="text-lg font-medium mb-6">{title}</h3>
      {children}
    </div>
  )
}

function Input({ label, children }: any) {
  return (
    <div className="flex flex-col gap-2">
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function Metric({ label, value }: any) {
  return (
    <div className="bg-muted rounded-xl p-6 mb-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  )
}