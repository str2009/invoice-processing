"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

type ViewMode = "day" | "month" | "year"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

interface MultiLevelCalendarProps {
  selected?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  numberOfMonths?: number
  defaultMonth?: Date
  maxDate?: Date
}

export function MultiLevelCalendar({
  selected,
  onSelect,
  numberOfMonths = 2,
  defaultMonth,
  maxDate,
}: MultiLevelCalendarProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("day")
  const [viewDate, setViewDate] = React.useState(() => defaultMonth ?? new Date())
  const [activePanel, setActivePanel] = React.useState<0 | 1>(0)

  // Year grid base (decade start)
  const decadeStart = Math.floor(viewDate.getFullYear() / 10) * 10

  // Second panel month
  const secondMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)

  const handleMonthNav = React.useCallback(() => {
    setViewDate((d) => {
      const n = new Date(d)
      n.setMonth(n.getMonth() - 1)
      return n
    })
  }, [])

  const handleArrowLeft = React.useCallback(() => {
    if (viewMode === "day") {
      setViewDate((d) => {
        const n = new Date(d)
        n.setMonth(n.getMonth() - 1)
        return n
      })
    } else if (viewMode === "month") {
      setViewDate((d) => {
        const n = new Date(d)
        n.setFullYear(n.getFullYear() - 1)
        return n
      })
    } else {
      setViewDate((d) => {
        const n = new Date(d)
        n.setFullYear(n.getFullYear() - 10)
        return n
      })
    }
  }, [viewMode])

  const handleArrowRight = React.useCallback(() => {
    if (viewMode === "day") {
      setViewDate((d) => {
        const n = new Date(d)
        n.setMonth(n.getMonth() + 1)
        return n
      })
    } else if (viewMode === "month") {
      setViewDate((d) => {
        const n = new Date(d)
        n.setFullYear(n.getFullYear() + 1)
        return n
      })
    } else {
      setViewDate((d) => {
        const n = new Date(d)
        n.setFullYear(n.getFullYear() + 10)
        return n
      })
    }
  }, [viewMode])

  const handleCaptionClick = React.useCallback((panelIdx: 0 | 1) => {
    setActivePanel(panelIdx)
    if (viewMode === "day") {
      setViewMode("month")
    } else if (viewMode === "month") {
      setViewMode("year")
    }
  }, [viewMode])

  const handleMonthSelect = React.useCallback((monthIdx: number) => {
    setViewDate((d) => {
      const n = new Date(d)
      n.setMonth(monthIdx)
      return n
    })
    setViewMode("day")
  }, [])

  const handleYearSelect = React.useCallback((year: number) => {
    setViewDate((d) => {
      const n = new Date(d)
      n.setFullYear(year)
      return n
    })
    setViewMode("month")
  }, [])

  const maxYear = maxDate ? maxDate.getFullYear() : Infinity
  const maxMonth = maxDate ? maxDate.getMonth() : 11

  // --- YEAR VIEW ---
  if (viewMode === "year") {
    const years = Array.from({ length: 12 }, (_, i) => decadeStart + i)
    return (
      <div className="p-3" style={{ width: numberOfMonths === 2 ? "556px" : "280px" }}>
        <div className="flex items-center justify-between pb-4">
          <button
            onClick={handleArrowLeft}
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {decadeStart} — {decadeStart + 11}
          </span>
          <button
            onClick={handleArrowRight}
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
            disabled={decadeStart + 12 > maxYear}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {years.map((year) => {
            const isCurrent = year === new Date().getFullYear()
            const isSelected = year === viewDate.getFullYear()
            const isFuture = year > maxYear
            return (
              <button
                key={year}
                onClick={() => !isFuture && handleYearSelect(year)}
                disabled={isFuture}
                className={cn(
                  "rounded-md py-2 text-sm transition-colors",
                  isFuture && "cursor-not-allowed text-muted-foreground/30",
                  !isFuture && "hover:bg-accent hover:text-accent-foreground",
                  isCurrent && !isSelected && !isFuture && "bg-accent/50 text-accent-foreground",
                  isSelected && !isFuture && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  !isCurrent && !isSelected && !isFuture && "text-foreground"
                )}
              >
                {year}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // --- MONTH VIEW ---
  if (viewMode === "month") {
    const isMaxYear = viewDate.getFullYear() >= maxYear
    return (
      <div className="p-3" style={{ width: numberOfMonths === 2 ? "556px" : "280px" }}>
        <div className="flex items-center justify-between pb-4">
          <button
            onClick={handleArrowLeft}
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("year")}
            className="text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {viewDate.getFullYear()}
          </button>
          <button
            onClick={handleArrowRight}
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
            disabled={viewDate.getFullYear() >= maxYear}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MONTHS.map((label, idx) => {
            const isCurrent =
              idx === new Date().getMonth() &&
              viewDate.getFullYear() === new Date().getFullYear()
            const isSelected = idx === viewDate.getMonth()
            const isFuture = isMaxYear && idx > maxMonth
            return (
              <button
                key={label}
                onClick={() => !isFuture && handleMonthSelect(idx)}
                disabled={isFuture}
                className={cn(
                  "rounded-md py-2 text-sm transition-colors",
                  isFuture && "cursor-not-allowed text-muted-foreground/30",
                  !isFuture && "hover:bg-accent hover:text-accent-foreground",
                  isCurrent && !isSelected && !isFuture && "bg-accent/50 text-accent-foreground",
                  isSelected && !isFuture && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  !isCurrent && !isSelected && !isFuture && "text-foreground"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // --- DAY VIEW (default) ---
  return (
    <DayPicker
      mode="range"
      selected={selected}
      onSelect={onSelect}
      showOutsideDays
      numberOfMonths={numberOfMonths}
      month={viewDate}
      onMonthChange={setViewDate}
      disabled={maxDate ? { after: maxDate } : undefined}
      toDate={maxDate}
      className="p-3"
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium cursor-pointer hover:text-primary transition-colors",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        CaptionLabel: ({ displayMonth }: { displayMonth: Date }) => {
          const monthLabel = displayMonth.toLocaleDateString("en-US", { month: "long" })
          const yearLabel = displayMonth.getFullYear()
          return (
            <button
              type="button"
              onClick={() => {
                setViewDate(displayMonth)
                setViewMode("month")
              }}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {monthLabel} {yearLabel}
            </button>
          )
        },
      }}
    />
  )
}
