import { sql, ensureTable } from '@/lib/db'
import Dashboard from './Dashboard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await ensureTable()
  const jobs = await sql`
    select link, title, company, site, score, verdict, reason, missing, experience, location, salary, status, posted, found_at
    from jobs order by found_at desc limit 500`
  const [run] = await sql`select at from runs order by at desc limit 1`
  // Dates as strings so they pass to the client component
  return <Dashboard jobs={jobs.map(j => ({ ...j, posted: j.posted?.toISOString() ?? null, found_at: j.found_at.toISOString() }))} lastRunAt={run?.at.toISOString() ?? null} />
}
