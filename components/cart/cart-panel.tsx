"use client"

import { X, Trash2, Download, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "./cart-context"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CartPanelProps {
  onClose: () => void
}

export function CartPanel({ onClose }: CartPanelProps) {
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
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Корзина</h3>
          {totalItems > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
              {totalItems}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={clearCart}
          disabled={cartItems.length === 0}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Очистить
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={handleExport}
          disabled={cartItems.length === 0}
        >
          <Download className="mr-1 h-3 w-3" />
          Экспорт
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-7 text-[10px]"
          onClick={handleCreate}
          disabled={cartItems.length === 0}
        >
          Создать
        </Button>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        {cartItems.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Корзина пуста
          </div>
        ) : (
          <div className="divide-y divide-border">
            {cartItems.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {item.part_code}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.brand}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {item.part_name}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.qty - 1)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[2rem] text-center text-xs font-medium">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.qty + 1)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium">
                      {(item.price * item.qty).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.price.toFixed(2)} x {item.qty}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer - Total */}
      {cartItems.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Итого:</span>
            <span className="text-sm font-medium">{totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
