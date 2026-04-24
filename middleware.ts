import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set(name, value, options)
        },
        remove: (name, options) => {
          res.cookies.set(name, "", options)
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname
  
  console.log("[v0] Middleware:", { path, hasUser: !!user, userEmail: user?.email })

  // Redirect unauthenticated users to login (except if already on login)
  if (!user && !path.startsWith("/login")) {
    console.log("[v0] Redirecting to /login - no user")
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Redirect authenticated users away from login page
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
}
