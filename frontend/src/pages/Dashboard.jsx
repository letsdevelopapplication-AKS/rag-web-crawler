import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../config'
import ChatPanel from '../components/ChatPanel'
import NodeMotif from '../components/NodeMotif'
import BrandMark from '../components/BrandMark'

export default function Dashboard() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rag_api_key') || '')
  const [keyInput, setKeyInput] = useState('')
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [crawling, setCrawling] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const logsEndRef = useRef()

  const addLog = (message, type = 'info') =>
    setLogs((prev) => [...prev, { message, type, id: Date.now() + Math.random() }])

  const fetchStatus = async (key) => {
    const res = await fetch(`${API_BASE}/api/account/status`, { headers: { 'X-API-Key': key } })
    if (!res.ok) throw new Error('Invalid API key.')
    return res.json()
  }

  useEffect(() => {
    if (!apiKey) return
    fetchStatus(apiKey)
      .then(setStatus)
      .catch((err) => {
        setError(err.message)
        localStorage.removeItem('rag_api_key')
        setApiKey('')
      })
  }, [apiKey])

  const handleKeySubmit = (e) => {
    e.preventDefault()
    if (!keyInput.trim()) return
    localStorage.setItem('rag_api_key', keyInput.trim())
    setError('')
    setApiKey(keyInput.trim())
  }

  const startCrawl = async () => {
    setCrawling(true)
    setLogs([])
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/account/initiate`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'progress') {
            addLog(data.message, 'info')
          } else if (data.type === 'complete') {
            addLog(data.message, 'success')
            setStatus((prev) => ({
              ...prev,
              ready: true,
              status: 'ready',
              system_prompt: data.system_prompt,
              chunk_count: data.chunk_count,
              contact_info: data.contact_info,
            }))
          } else if (data.type === 'error') {
            addLog(data.message, 'error')
            setError(data.message)
          }
        }
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCrawling(false)
    }
  }

  const embedSnippet = `<iframe src="${window.location.origin}/embed?key=${apiKey}" style="width:380px;height:560px;border:none"></iframe>`

  const copySnippet = () => {
    navigator.clipboard?.writeText(embedSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Not logged in: paste-key login ──────────────────────────────────
  if (!apiKey) {
    return (
      <div className="auth-shell">
        <NodeMotif />
        <div className="auth-card">
          <div className="brand-row">
            <BrandMark />
            <div>
              <h1>Dashboard Login</h1>
              <p>Paste the API key you received at registration.</p>
            </div>
          </div>
          <form onSubmit={handleKeySubmit} className="initiate-form">
            <div className="field">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Your API key"
                autoFocus
              />
            </div>
            <button className="btn-initiate" type="submit">Continue</button>
          </form>
          {error && <div className="error-banner">⚠ {error}</div>}
        </div>
      </div>
    )
  }

  // ── Logged in, status not loaded yet ────────────────────────────────
  if (!status) {
    return (
      <div className="auth-shell">
        <NodeMotif />
        <div className="auth-card">Loading…</div>
      </div>
    )
  }

  // ── Confirmed but crawl never started, and nothing in-flight ────────
  const showStartPrompt = status.status === 'confirmed' && !crawling && logs.length === 0
  if (showStartPrompt) {
    return (
      <div className="auth-shell">
        <NodeMotif />
        <div className="auth-card">
          <div className="initiate-intro">
            <h2>Build Your Knowledge Base</h2>
            <p>
              We'll crawl <strong>{status.website_url}</strong>, chunk it, embed it, and
              auto-generate an AI persona tailored to your site.
            </p>
          </div>
          <button className="btn-initiate" onClick={startCrawl}>Start Crawl</button>
          {error && <div className="error-banner">⚠ {error}</div>}
        </div>
      </div>
    )
  }

  // ── Crawl in progress (or just finished with an error, retryable) ───
  const showProgress = crawling || (status.status !== 'ready' && logs.length > 0)
  if (showProgress) {
    return (
      <div className="auth-shell">
        <NodeMotif />
        <div className="auth-card">
          <div className="initiate-intro">
            <h2>Setting up your chatbot…</h2>
          </div>
          <div className="log-panel">
            <div className="log-header">Progress</div>
            <div className="log-list">
              {logs.map((log) => (
                <div key={log.id} className={`log-row log-${log.type}`}>
                  <span className="log-dot" /> {log.message}
                </div>
              ))}
              {crawling && (
                <div className="log-row log-loading">
                  <span className="spinner-sm" /> Working…
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
          {error && !crawling && (
            <>
              <div className="error-banner">⚠ {error}</div>
              <button className="btn-initiate" style={{ marginTop: 16 }} onClick={startCrawl}>
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Ready: full dashboard ────────────────────────────────────────────
  return (
    <div className="dashboard-shell">
      <header className="app-header">
        <div className="header-brand">
          <BrandMark />
          <div>
            <h1>Your Chatbot</h1>
            <p>{status.website_url}</p>
          </div>
        </div>
        <button className="btn-reset" onClick={startCrawl} disabled={crawling}>↺ Re-crawl</button>
      </header>

      <main className="dashboard-grid">
        <aside className="dashboard-side">
          {/* Chunk count etc. live in ChatPanel's own sidebar below — this
              card only covers what that one doesn't: account-level status. */}
          <div className="sidebar-card">
            <div className="sidebar-label">Account</div>
            <div className="sidebar-row">
              <span className="sidebar-key">Status</span>
              <span className="sidebar-val">{status.status}</span>
            </div>
          </div>

          <div className="sidebar-card">
            <div className="sidebar-label">Embed on your site</div>
            <div className="embed-box">{embedSnippet}</div>
            <button className="btn-link" onClick={copySnippet}>
              {copied ? '✓ Copied' : 'Copy snippet'}
            </button>
          </div>
        </aside>

        <div className="dashboard-chat">
          <ChatPanel
            apiKey={apiKey}
            systemPrompt={status.system_prompt}
            websiteUrl={status.website_url}
            chunkCount={status.chunk_count}
            contactInfo={status.contact_info}
          />
        </div>
      </main>
    </div>
  )
}
