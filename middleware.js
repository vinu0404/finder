import { NextResponse } from 'next/server'

// Browser password prompt for everything except the cron endpoint (which checks its own secret)
export function middleware(req) {
  const [, b64] = (req.headers.get('authorization') || '').split(' ')
  const pass = b64 ? atob(b64).split(':').slice(1).join(':') : ''
  if (process.env.PORTAL_PASSWORD && pass === process.env.PORTAL_PASSWORD) return NextResponse.next()
  return new NextResponse('Login required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="finder"' } })
}

export const config = { matcher: ['/((?!api/cron|_next).*)'] }
