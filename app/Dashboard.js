'use client'
import { useMemo, useState } from 'react'

const day = 24 * 3600 * 1000
const ago = iso => {
  const d = Math.floor((Date.now() - new Date(iso)) / day)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}
const scoreColor = s => (s >= 70 ? 'var(--good)' : s >= 50 ? 'var(--warn)' : 'var(--muted)')
const cleanTitle = t => (t || '').replace(/^Job Application for /, '').replace(/ - (LinkedIn|Careernet)$/, '')

export default function Dashboard({ jobs: initial }) {
  const [jobs, setJobs] = useState(initial)
  const [tab, setTab] = useState('matches')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('score')
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState('')

  const flash = m => { setToast(m); setTimeout(() => setToast(''), 5000) }

  const groups = useMemo(() => ({
    matches: jobs.filter(j => j.verdict === 'apply' && !j.status),
    applied: jobs.filter(j => j.status === 'applied'),
    skipped: jobs.filter(j => j.verdict !== 'apply' && j.status !== 'applied'),
    hidden: jobs.filter(j => j.status === 'hidden' && j.verdict === 'apply'),
  }), [jobs])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...groups[tab]]
      .filter(j => !t || [j.title, j.company, j.location, j.reason].join(' ').toLowerCase().includes(t))
      .sort((a, b) => sort === 'score' ? (b.score ?? 0) - (a.score ?? 0) : new Date(b.posted || b.found_at) - new Date(a.posted || a.found_at))
  }, [groups, tab, q, sort])

  const lastRun = jobs[0]?.found_at
  const newToday = groups.matches.filter(j => Date.now() - new Date(j.found_at) < day).length

  async function run() {
    setRunning(true)
    try {
      const r = await fetch('/api/run', { method: 'POST' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      flash(`Checked ${d.new} new jobs · ${d.kept} match${d.kept === 1 ? '' : 'es'} added`)
      // state is seeded from server props, so reload to pick up new rows
      setTimeout(() => location.reload(), 1500)
    } catch (e) {
      flash(`Run failed: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  async function setStatus(link, status) {
    const prev = jobs
    setJobs(js => js.map(j => (j.link === link ? { ...j, status } : j)))
    const r = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link, status }) })
    if (!r.ok) { setJobs(prev); flash('Could not save, try again') }
  }

  const tabs = [['matches', 'Matches'], ['applied', 'Applied'], ['skipped', 'Skipped'], ['hidden', 'Hidden']]

  return (
    <main className="wrap">
      <header className="top">
        <div className="title">
          <div className="logo">JF</div>
          <div>
            <h1>Job Finder</h1>
            <div className="sub">AI / GenAI roles · 0–1 yr · Remote India or Delhi NCR · 11+ LPA · auto-runs 8 AM & 8 PM IST</div>
          </div>
        </div>
        <button className="btn primary" onClick={run} disabled={running}>
          {running ? <><span className="spin" /> Searching… 1–3 min</> : '↻ Run now'}
        </button>
      </header>

      <section className="stats">
        <div className="stat"><b>{groups.matches.length}</b><span>Open matches</span></div>
        <div className="stat"><b>{newToday}</b><span>New in last 24h</span></div>
        <div className="stat"><b>{groups.applied.length}</b><span>Applied</span></div>
        <div className="stat"><b>{lastRun ? ago(lastRun) : '—'}</b><span>Last new job found</span></div>
      </section>

      <div className="bar">
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {label}<span className="n">{groups[k].length}</span>
            </button>
          ))}
        </div>
        <input className="search" placeholder="Search title, company, location…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search jobs" />
        <select className="search" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          <option value="score">Best match</option>
          <option value="date">Newest</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          {jobs.length === 0 ? <>No jobs yet. Press <b>Run now</b> to search.</>
            : tab === 'matches' ? <>No open matches right now. New ones show up after each run, or check <b>Skipped</b> to see why jobs were filtered out.</>
            : 'Nothing here.'}
        </div>
      ) : list.map(j => <Card key={j.link} j={j} tab={tab} setStatus={setStatus} />)}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}

function Card({ j, tab, setStatus }) {
  const s = j.score ?? 0
  const skipped = j.verdict !== 'apply'
  const color = skipped ? 'var(--muted)' : scoreColor(s)
  const pay = !skipped && j.salary && j.salary !== 'not stated'
  return (
    <article className={`card ${tab === 'skipped' || tab === 'hidden' ? 'dim' : ''}`}>
      <div className="ring" style={{ background: `conic-gradient(${color} ${s * 3.6}deg, var(--line) 0)` }} title="Match score">
        <i style={{ color }}>{s}</i>
      </div>
      <div>
        <div className="head">
          <div>
            <a className="job" href={j.link} target="_blank" rel="noreferrer">{cleanTitle(j.title)}</a>
            <div className="co">{j.company || j.site}</div>
          </div>
          <div className="actions">
            <a className="btn sm primary" href={j.link} target="_blank" rel="noreferrer">Open ↗</a>
            {tab === 'matches' && <>
              <button className="btn sm" onClick={() => setStatus(j.link, 'applied')}>✓ Applied</button>
              <button className="btn sm" onClick={() => setStatus(j.link, 'hidden')} aria-label="Hide">Hide</button>
            </>}
            {(tab === 'applied' || tab === 'hidden') && <button className="btn sm" onClick={() => setStatus(j.link, null)}>Undo</button>}
          </div>
        </div>
        <div className="chips">
          {j.location && <span className="chip">📍 {j.location}</span>}
          {j.experience && <span className="chip">🎓 {j.experience}</span>}
          <span className={`chip ${pay ? 'good' : ''}`}>💰 {j.salary || 'pay not stated'}</span>
          <span className="chip">🕒 {j.posted ? `posted ${ago(j.posted)}` : `found ${ago(j.found_at)}`}</span>
          <span className="chip">{j.site}</span>
        </div>
        {skipped && <span className="chip bad">Skipped</span>}
        {j.reason && <p className="reason">{j.reason}</p>}
        {j.missing && <div className="missing"><b>Gaps:</b> {j.missing}</div>}
      </div>
    </article>
  )
}
