import { runSearch } from '@/lib/search'

export const maxDuration = 300

// "Run now" button. Protected by the Basic-auth middleware.
export async function POST() {
  return Response.json(await runSearch())
}
