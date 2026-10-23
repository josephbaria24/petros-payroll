import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: req.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    // Update request cookies for subsequent logic in this middleware
                    req.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    // Update response cookies to send back to the browser
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    // Update request cookies
                    req.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    // Update response cookies
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // Prefer getUser() so the JWT is validated (getSession() alone can be stale/empty).
    const { data: { user } } = await supabase.auth.getUser()

    // Bearer token fallback for API uploads when cookies are missing on multipart POSTs
    let apiUser = user
    if (!apiUser && req.nextUrl.pathname.startsWith('/api/')) {
        const authHeader = req.headers.get('authorization')
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7)
            const { data } = await supabase.auth.getUser(token)
            apiUser = data.user
        }
    }

    const isAuthenticated = Boolean(apiUser)

    // Define public routes
    const publicRoutes = ['/login', '/auth/callback']
    const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route)) || req.nextUrl.pathname === '/'
    const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

    // Auth: API routes must get JSON 401 (never HTML login redirect — breaks FormData fetch().json())
    if (!isAuthenticated && !isPublicRoute) {
        if (isApiRoute) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401 })
        }
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/login'
        if (req.nextUrl.pathname !== '/') {
            redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
        }
        return NextResponse.redirect(redirectUrl)
    }

    if (isAuthenticated && req.nextUrl.pathname === '/login') {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
