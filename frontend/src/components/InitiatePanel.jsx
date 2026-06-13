import { useState, useRef } from 'react'
import { API_BASE } from '../config'

export default function InitiatePanel({ onComplete }) {
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const fileRef = useRef()
  const logsEndRef = useRef()

  const addLog = (message, type = 'info') =>
    setLogs((prev) => [...prev, { message, type, id: Date.now() + Math.random() }])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url || loading) return

    setLoading(true)
    setLogs([])
    setError('')

    const formData = new FormData()
    formData.append('url', url)
    if (file) formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE}/api/initiate`, { method: 'POST', body: formData })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const raw = decoder.decode(value)
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'progress') {
            addLog(data.message, 'info')
          } else if (data.type === 'complete') {
            addLog(data.message, 'success')
            onComplete({ system_prompt: data.system_prompt, chunk_count: data.chunk_count, website_url: url })
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
      setLoading(false)
    }
  }

  return (
    <div className="initiate-wrapper">
      <div className="initiate-card">
        <div className="initiate-intro">
          <h2>Build Your Knowledge Base</h2>
          <p>
            Enter a website URL and optionally upload a document. The system will crawl all pages,
            chunk the content, create vector embeddings, and auto-generate an optimized AI prompt.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="initiate-form">
          <div className="field">
            <label>Website URL <span className="required">*</span></label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Document <span className="optional">(optional — PDF, DOCX, TXT)</span></label>
            <div
              className={`file-drop ${file ? 'has-file' : ''}`}
              onClick={() => !loading && fileRef.current?.click()}
            >
              <input
                type="file"
                ref={fileRef}
                accept=".pdf,.docx,.doc,.txt"
                disabled={loading}
                hidden
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
              {file ? (
                <div className="file-info">
                  <span>📄 {file.name}</span>
                  <button
                    type="button"
                    className="file-clear"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="file-placeholder">Click to upload a document</span>
              )}
            </div>
          </div>

          <button className="btn-initiate" type="submit" disabled={loading || !url}>
            {loading ? (
              <><span className="spinner" /> Processing…</>
            ) : (
              'Initiate'
            )}
          </button>
        </form>

        {logs.length > 0 && (
          <div className="log-panel">
            <div className="log-header">Progress</div>
            <div className="log-list">
              {logs.map((log) => (
                <div key={log.id} className={`log-row log-${log.type}`}>
                  <span className="log-dot" />
                  {log.message}
                </div>
              ))}
              {loading && (
                <div className="log-row log-loading">
                  <span className="spinner-sm" /> Working…
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="error-banner">⚠ {error}</div>
        )}
      </div>
    </div>
  )
}
