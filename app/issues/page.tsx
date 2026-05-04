"use client"

import Link from "next/link"
import { Truck, Phone, Archive, PauseCircle, AlertTriangle, Copy, ArrowRight } from "lucide-react"
import { usePermissions } from "@/components/PermissionsContext"

const sections = [
  {
    href: "/issues/mxu-transfer",
    icon: Truck,
    title: "Перенести на МХУ",
    description: "Показать детали не перемещенные на МХУ",
  },
  {
    href: "/issues/competitors",
    icon: Phone,
    title: "Конкуренты",
    description: "История прозвона конкурентов",
  },
  {
    href: "/issues/old-stock",
    icon: Archive,
    title: "Старые остатки",
    description: "Показать остатки старше 30 дней",
  },
  {
    href: "/issues/no-movement",
    icon: PauseCircle,
    title: "Без движения",
    description: "Показать нулевые приходы",
  },
  {
    href: "/issues/discrepancies",
    icon: AlertTriangle,
    title: "Расхождения",
    description: "Показать расхождения остатков",
  },
  {
    href: "/issues/duplicates",
    icon: Copy,
    title: "Дубли",
    description: "Показать дублирующиеся позиции",
  },
]

export default function IssuesPage() {
  const { permissionsLoaded } = usePermissions()

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-4xl">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">Issues</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Работа с проблемами и операционными задачами
            </p>
          </div>

          {/* Section cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {permissionsLoaded &&
              sections.map((section) => {
                const Icon = section.icon
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <h2 className="mt-4 text-sm font-medium text-foreground">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </Link>
                )
              })}
          </div>

        </div>
      </div>
    </div>
  )
}
