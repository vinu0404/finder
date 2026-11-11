import { sql, ensureTable } from './db'
import { CV } from './cv'

const SITES = [
  'jobs.lever.co', 'jobs.ashbyhq.com', 'job-boards.greenhouse.io', 'boards.greenhouse.io',
  'apply.workable.com', 'jobs.smartrecruiters.com', 'ats.rippling.com', 'jobs.gem.com',
  'jobs.personio.com', 'jobs.polymer.co', 'recruitee.com', 'breezy.hr',
  // extra boards common for Indian startups
  'myworkdayjobs.com', 'jobs.jobvite.com', 'careers.teamtailor.com', 'keka.com',
  'darwinbox.in', 'zohorecruit.in', 'wellfound.com', 'instahyre.com',
]
const ROLES = '("AI Engineer" OR "GenAI Engineer" OR "Generative AI Engineer" OR "LLM Engineer")'
const EXCLUDE = '-senior -staff -principal -lead -manager'
const MAX_NEW_PER_RUN = 60
const WEEK = 7 * 24 * 3600 * 1000

async function serper(q) {
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    // tbs qdr:w = indexed in the past week; num>10 is not allowed on Serper free tier
    body: JSON.stringify({ q, gl: 'in', tbs: 'qdr:w' }),
  })
  if (!r.ok) throw new Error(`Serper ${r.status}: ${await r.text()}`)
  return (await r.json()).organic || []
}

const clean = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&#39;|&quot;/g, ' ').replace(/\s+/g, ' ').trim()

const getJson = u => fetch(u, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null).catch(() => null)

// { text, posted } for one job. text is '' if the JD could not be loaded; posted is null when the ATS gives no date.
// Uses each ATS's public API where pages are JS-rendered.
export async function jdText(link) {
  const u = new URL(link)
  const [a, b, c] = u.pathname.split('/').filter(Boolean)
  if (u.hostname === 'jobs.lever.co' && b) {
    const j = await getJson(`https://api.lever.co/v0/postings/${a}/${b}`)
    if (j) return { posted: j.createdAt, text: clean(`${j.text} ${j.categories?.location} ${j.descriptionPlain || ''} ${(j.lists || []).map(l => l.text + ' ' + l.content).join(' ')} ${j.additionalPlain || ''}`) }
  }
  if (u.hostname.endsWith('greenhouse.io')) {
    const id = u.pathname.match(/jobs\/(\d+)/)?.[1] || u.searchParams.get('gh_jid')
    const j = id && await getJson(`https://boards-api.greenhouse.io/v1/boards/${a}/jobs/${id}`)
    if (j) return { posted: j.first_published || j.updated_at, text: clean(`${j.title} ${j.location?.name} ${j.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>')}`) }
  }
  if (u.hostname === 'jobs.ashbyhq.com' && b) {
    const j = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${a}`)
    const p = j?.jobs?.find(x => x.id === b)
    if (p) return { posted: p.publishedAt, text: clean(`${p.title} ${p.location} ${p.isRemote ? 'remote' : ''} ${p.descriptionPlain || p.descriptionHtml}`) }
    if (j) return { text: '' } // board loaded but job not listed => closed
  }
  if (u.hostname === 'apply.workable.com' && b === 'j' && c) {
    const j = await getJson(`https://apply.workable.com/api/v2/accounts/${a}/jobs/${c}`)
    if (j) return { posted: j.published, text: j.state === 'published' ? clean(`${j.title} ${j.workplace} ${j.location?.city} ${j.location?.country} ${j.description} ${j.requirements} ${j.benefits}`) : '' }
  }
  try {
    const r = await fetch(link, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } })
    return { text: r.ok ? clean(await r.text()) : '' }
  } catch { return { text: '' } }
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['is_job_description', 'score', 'verdict', 'reason', 'missing', 'experience', 'experience_quote', 'location', 'company'],
  properties: {
    is_job_description: { type: 'boolean', description: 'true only if the text is one specific open job posting with its responsibilities/requirements' },
    experience_quote: { type: 'string', description: 'exact words copied from the JD stating experience/seniority, or "" if none' },
    score: { type: 'integer', description: '0-100 fit for this candidate' },
    verdict: { type: 'string', enum: ['apply', 'skip'] },
    reason: { type: 'string' }, missing: { type: 'string' },
    experience: { type: 'string', description: 'years required as stated, or "not stated"' },
    location: { type: 'string' }, company: { type: 'string' },
  },
}

async function judge(job, text) {
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: `You screen job posts for this candidate:\n${CV}\n
Rules: verdict "apply" only if ALL hold: role is AI/GenAI/LLM engineering; requires 0-1 years (junior, fresher, new grad, entry level, or not stated with junior-sounding scope); open to India (remote India, or Indian city); the posting looks open. Anything asking 2+ years, senior/lead/staff, or US/EU-only => "skip". Score = how well the candidate's skills match. "missing" = key required skills the candidate lacks (short). Keep reason to one sentence.
Use ONLY the job description text given. Never guess facts not in it. If the text is not a single specific job posting (a job list, login page, error, closed posting), set is_job_description false and verdict "skip".`,
      input: `Title: ${job.title}\nURL: ${job.link}\nJob description:\n${text.slice(0, 12000)}`,
      text: { format: { type: 'json_schema', name: 'verdict', strict: true, schema: SCHEMA } },
    }),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`)
  const d = await r.json()
  const out = d.output.find(o => o.type === 'message').content.find(c => c.type === 'output_text').text
  return JSON.parse(out)
}

export async function runSearch() {
  await ensureTable()
  const results = (await Promise.all(SITES.map(s =>
    serper(`site:${s} ${ROLES} remote India ${EXCLUDE}`).then(rs => rs.map(r => ({ ...r, site: s }))).catch(e => (console.error(s, e.message), []))
  ))).flat()

  const key = l => /gh_jid=/.test(l) ? l : l.split('?')[0].replace(/\/apply\/?$/, '/')
  const unique = [...new Map(results.map(r => [key(r.link), r])).values()]
  const seen = new Set((await sql`select link from jobs where link = any(${unique.map(r => key(r.link))})`).map(r => r.link))
  const fresh = unique.filter(r => !seen.has(key(r.link))).slice(0, MAX_NEW_PER_RUN)

  let kept = 0
  for (let i = 0; i < fresh.length; i += 8) {
    await Promise.all(fresh.slice(i, i + 8).map(async r => {
      const job = { link: key(r.link), title: r.title, snippet: r.snippet || '', site: r.site }
      try {
        const { text, posted } = await jdText(job.link)
        job.posted = posted ? new Date(posted) : null
        const skip = reason => sql`insert into jobs ${sql({ ...job, verdict: 'skip', score: 0, reason })} on conflict (link) do nothing`
        // No full JD => never recommend
        if (text.length < 600) return void await skip('Job description could not be loaded; not verified')
        if (posted && Date.now() - new Date(posted) > WEEK) return void await skip(`Posted ${new Date(posted).toDateString()}, older than a week`)
        const v = await judge(job, text)
        // Reject if the model's quoted experience line is not actually in the JD
        const norm = t => t.toLowerCase().replace(/\s+/g, ' ')
        if (!v.is_job_description || (v.experience_quote && !norm(text).includes(norm(v.experience_quote)))) {
          v.verdict = 'skip'; v.reason = `Not verified against JD. ${v.reason}`
        }
        delete v.is_job_description; delete v.experience_quote
        if (v.verdict === 'apply') kept++
        await sql`insert into jobs ${sql({ ...job, ...v })} on conflict (link) do nothing`
      } catch (e) { console.error(job.link, e.message) }
    }))
  }
  return { searched: results.length, new: fresh.length, kept }
}
