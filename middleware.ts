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

    // Refresh session if expired - required for Server Components
    const { data: { session } } = await supabase.auth.getSession()

    // Define public routes
    const publicRoutes = ['/login', '/auth/callback']
    const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route)) || req.nextUrl.pathname === '/'

    // Auth redirection logic
    if (!session && !isPublicRoute) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/login'
        if (req.nextUrl.pathname !== '/') {
            redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
        }
        return NextResponse.redirect(redirectUrl)
    }

    if (session && req.nextUrl.pathname === '/login') {
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
