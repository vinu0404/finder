import { sql } from '@/lib/db'

const STATUSES = ['applied', 'hidden', null]

// Mark a job applied / hidden / back to new. Protected by the Basic-auth middleware.
export async function POST(req) {
  const { link, status } = await req.json()
  if (typeof link !== 'string' || !STATUSES.includes(status)) return new Response('Bad request', { status: 400 })
  await sql`update jobs set status = ${status} where link = ${link}`
  return Response.json({ ok: true })
}
