import { sql, ensureTable } from '@/lib/db'
import RunButton from './RunButton'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }) {
  const all = (await searchParams).all === '1'
  await ensureTable()
  const jobs = all
    ? await sql`select * from jobs order by found_at desc, score desc limit 300`
    : await sql`select * from jobs where verdict = 'apply' order by found_at::date desc, score desc limit 300`

  return (
    <main>
      <h1>Job Finder</h1>
      <p><RunButton /> · Auto-runs at 8 AM and 8 PM IST · {all ? <a href="/">Show only matches</a> : <a href="/?all=1">Show skipped too</a>}</p>
      {jobs.length === 0 && <p>No jobs yet. Press Run now.</p>}
      {jobs.map(j => (
        <div key={j.link} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 10, opacity: j.verdict === 'skip' ? 0.55 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <a href={j.link} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{j.title}</a>
            <b style={{ color: j.score >= 70 ? 'green' : j.score >= 50 ? 'darkorange' : 'gray' }}>{j.score}/100</b>
          </div>
          <div style={{ fontSize: 14, color: '#555' }}>{j.company} · {j.location} · exp: {j.experience} · {j.posted ? `posted ${new Date(j.posted).toLocaleDateString('en-IN')}` : `found ${new Date(j.found_at).toLocaleDateString('en-IN')}`}</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>{j.reason}</div>
          {j.missing && <div style={{ fontSize: 13, color: '#a33' }}>Missing: {j.missing}</div>}
        </div>
      ))}
    </main>
  )
}
