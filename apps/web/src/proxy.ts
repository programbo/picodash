import { NextResponse, type NextRequest } from 'next/server'

/** The evaluation website is intentionally a single route. Keep old product paths unavailable. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/') return NextResponse.next()
  return new NextResponse('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.svg|.*\\..*).*)'],
}
