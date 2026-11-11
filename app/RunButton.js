'use client'
import { useState } from 'react'

export default function RunButton() {
  const [msg, setMsg] = useState('')
  async function run() {
    setMsg('Searching… (1–3 min)')
    const r = await fetch('/api/run', { method: 'POST' })
    if (!r.ok) return setMsg(`Failed: ${r.status}`)
    const d = await r.json()
    setMsg(`Found ${d.searched}, ${d.new} new, ${d.kept} worth applying`)
    location.reload()
  }
  return <span><button onClick={run} disabled={msg.startsWith('Searching')} style={{ padding: '8px 16px' }}>Run now</button> {msg}</span>
}
