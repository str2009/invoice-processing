"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface CartItem {
  id: string
  part_code: string
  brand: string
  part_name: string
  price: number
  qty: number
  source: "analytics" | "invoice"
}

interface CartContextType {
  cartItems: CartItem[]
  addToCart: (item: Omit<CartItem, "qty"> & { qty?: number }) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  clearCart: () => void
  isInCart: (id: string) => boolean
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  const addToCart = useCallback((item: Omit<CartItem, "qty"> & { qty?: number }) => {
    setCartItems(prev => {
      const exists = prev.find(i => i.id === item.id)

      if (exists) {
        return prev.map(i =>
          i.id === item.id
            ? { ...i, qty: i.qty + (item.qty || 1) }
            : i
        )
      }

      return [
        ...prev,
        {
          ...item,
          qty: item.qty || 1,
        } as CartItem
      ]
    })
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCartItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setCartItems(prev => prev.filter(i => i.id !== id))
      return
    }
    setCartItems(prev => prev.map(i => 
      i.id === id ? { ...i, qty } : i
    ))
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  const isInCart = useCallback((id: string) => {
    return cartItems.some(i => i.id === id)
  }, [cartItems])

  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0)
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0)

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      isInCart,
      totalItems,
      totalPrice,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
