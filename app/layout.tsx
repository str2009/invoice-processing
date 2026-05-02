import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { CartProvider } from '@/components/cart/cart-context'
import { RowContextMenuProvider } from '@/components/cart/row-context-menu'
import { LayoutWrapper } from '@/components/LayoutWrapper'
import { PermissionsProvider } from '@/components/PermissionsContext'
import { Toaster } from 'sonner'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'Invoice Processing Dashboard',
  description: 'Internal admin dashboard for automotive parts invoice processing',
}

export const viewport: Viewport = {
  themeColor: '#0f1117',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={["light", "soft", "mellow", "dark", "warm-dark", "graphite"]}
          disableTransitionOnChange
        >
          <PermissionsProvider>
            <CartProvider>
              <RowContextMenuProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
              </RowContextMenuProvider>
            </CartProvider>
          </PermissionsProvider>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
