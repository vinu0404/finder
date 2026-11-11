import nodemailer from 'nodemailer'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export async function sendMatches(jobs) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return
  const rows = jobs.sort((a, b) => b.score - a.score).map(j => `
    <tr><td style="padding:16px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:16px;font-weight:700;color:#14161a">${esc(j.title)}</div>
      <div style="color:#6b7280;font-size:14px;margin:2px 0 8px">${esc(j.company || j.site)} · ${esc(j.location)} · ${esc(j.experience)} · ${esc(j.salary)}</div>
      <div style="font-size:14px;color:#374151;margin-bottom:6px">${esc(j.reason)}</div>
      ${j.missing ? `<div style="font-size:13px;color:#6b7280;margin-bottom:10px"><b>Gaps:</b> ${esc(j.missing)}</div>` : ''}
      <span style="display:inline-block;background:#ecfdf5;color:#059669;border-radius:999px;padding:2px 10px;font-size:13px;font-weight:700;margin-right:8px">Score ${j.score}</span>
      <a href="${esc(j.link)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;padding:7px 14px;font-weight:600;font-size:14px">Apply ↗</a>
    </td></tr>`).join('')
  const html = `<div style="background:#f6f7f9;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
    <table style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;border-collapse:collapse;width:100%">
      <tr><td style="padding:20px 16px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;border-radius:14px 14px 0 0">
        <div style="font-size:20px;font-weight:800">${jobs.length} new job match${jobs.length > 1 ? 'es' : ''}</div>
        <div style="font-size:13px;opacity:.9">Verified against each JD · 0–1 yr · Remote India / Delhi NCR · 11+ LPA</div>
      </td></tr>${rows}
    </table></div>`
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
  await t.sendMail({ from: `Job Finder <${process.env.GMAIL_USER}>`, to: process.env.GMAIL_USER, subject: `🎯 ${jobs.length} new AI job match${jobs.length > 1 ? 'es' : ''}`, html })
}
