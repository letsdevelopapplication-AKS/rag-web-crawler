import { useEffect, useState } from 'react'
import { API_BASE } from './config'
import ChatPanel from './components/ChatPanel'

// Rendered standalone in an <iframe src="…/embed?key=THEIR_KEY"> on the
// customer's own site. No header, no reset button, no URL/file form —
// just the chat, scoped to whichever account the key resolves to.
export default function Embed() {
  const [apiKey] = useState(() => new URLSearchParams(window.location.search).get('key') || '')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiKey) {
      setError('Missing API key. Add ?key=YOUR_KEY to the embed URL.')
      return
    }
    fetch(`${API_BASE}/api/account/status`, { headers: { 'X-API-Key': apiKey } })
      .then((r) => {
        if (!r.ok) throw new Error('Invalid API key.')
        return r.json()
      })
      .then(setStatus)
      .catch((err) => setError(err.message))
  }, [apiKey])

  if (error) return <div className="embed-message">⚠ {error}</div>
  if (!status) return <div className="embed-message">Connecting…</div>
  if (status.status !== 'ready') {
    return <div className="embed-message">Setting up the chatbot — please check back shortly…</div>
  }

  return (
    <ChatPanel
      apiKey={apiKey}
      systemPrompt={status.system_prompt}
      websiteUrl={status.website_url}
      chunkCount={status.chunk_count}
      contactInfo={status.contact_info}
      compact
    />
  )
}
