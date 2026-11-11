import { runSearch } from '@/lib/search'

export const maxDuration = 300

// Vercel Cron sends "Authorization: Bearer $CRON_SECRET"
export async function GET(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response('Unauthorized', { status: 401 })
  return Response.json(await runSearch())
}
