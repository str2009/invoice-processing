"use client"

import { X, Trash2, Download, Plus, Minus, GripHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "./cart-context"

interface CartDrawerProps {
  onClose: () => void
  height: number
  onDragStart: (e: React.PointerEvent) => void
  onDragMove: (e: React.PointerEvent) => void
  onDragEnd: () => void
}

export function CartDrawer({ onClose, height, onDragStart, onDragMove, onDragEnd }: CartDrawerProps) {
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice } = useCart()

  const handleExport = () => {
    console.log("Cart Export:", cartItems)
    console.log("Total items:", totalItems)
    console.log("Total price:", totalPrice)
  }

  const handleCreate = () => {
    console.log("Create action - placeholder")
  }

  return (
    <div className="flex h-full flex-col">
      {/* Drag handle */}
      <div
        className="flex h-3 shrink-0 cursor-ns-resize items-center justify-center hover:bg-muted/50 active:bg-muted"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize cart panel"
      >
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-medium">Корзина</h3>
            {totalItems > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                {totalItems}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={clearCart}
              disabled={cartItems.length === 0}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Очистить
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleExport}
              disabled={cartItems.length === 0}
            >
              <Download className="mr-1 h-3 w-3" />
              Экспорт
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleCreate}
              disabled={cartItems.length === 0}
            >
              Создать
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {totalItems > 0 && (
            <span className="text-[11px] font-medium">
              Итого: {totalPrice.toFixed(2)}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cart content - horizontal table layout */}
      <div className="flex-1 overflow-auto p-3">
        {cartItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Корзина пуста
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Код</th>
                <th className="pb-2 pr-4 font-medium">Бренд</th>
                <th className="pb-2 pr-4 font-medium">Название</th>
                <th className="pb-2 pr-4 font-medium text-center">Кол-во</th>
                <th className="pb-2 pr-4 font-medium text-right">Цена</th>
                <th className="pb-2 font-medium text-right">Сумма</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{item.part_code}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{item.brand}</td>
                  <td className="py-2 pr-4 max-w-[200px] truncate text-muted-foreground">{item.part_name}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.id, item.qty - 1)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[2rem] text-center font-medium">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.qty + 1)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">{item.price.toFixed(2)}</td>
                  <td className="py-2 text-right font-medium">{(item.price * item.qty).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
