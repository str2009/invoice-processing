"use client"

import Link from "next/link"
import { FileText, Car, BarChart3, MessageSquare, ArrowRight, CheckSquare } from "lucide-react"

const sections = [
  {
    href: "/invoice",
    icon: FileText,
    title: "Invoice Processing",
    description: "Загрузка и обработка счетов, обогащение данных",
  },
  {
    href: "/vin",
    icon: Car,
    title: "VIN Search",
    description: "Поиск запчастей по VIN-коду автомобиля",
  },
  {
    href: "/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "Аналитика по запчастям и поставщикам",
  },
  {
    href: "/tasks",
    icon: CheckSquare,
    title: "Tasks",
    description: "Управление задачами и контроль выполнения",
  },
  {
    href: "/chat",
    icon: MessageSquare,
    title: "Chat",
    description: "AI-ассистент для работы с данными",
  },
]

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Выберите раздел для работы
            </p>
          </div>

          {/* Section cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {sections.map((section) => {
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
