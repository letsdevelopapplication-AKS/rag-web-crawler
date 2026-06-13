import { useState, useEffect } from 'react'
import InitiatePanel from './components/InitiatePanel'
import ChatPanel from './components/ChatPanel'
import { API_BASE } from './config'

export default function App() {
  const [isReady, setIsReady] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [chunkCount, setChunkCount] = useState(0)
  const [contactInfo, setContactInfo] = useState({ emails: [], phones: [] })

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ready) {
          setIsReady(true)
          setSystemPrompt(data.system_prompt)
          setWebsiteUrl(data.website_url)
          setChunkCount(data.chunk_count)
          setContactInfo(data.contact_info || { emails: [], phones: [] })
        }
      })
      .catch(() => {})
  }, [])

  const handleInitComplete = ({ system_prompt, chunk_count, website_url, contact_info }) => {
    setSystemPrompt(system_prompt)
    setChunkCount(chunk_count)
    setWebsiteUrl(website_url)
    setContactInfo(contact_info || { emails: [], phones: [] })
    setIsReady(true)
  }

  const handleReset = async () => {
    await fetch(`${API_BASE}/api/reset`, { method: 'DELETE' })
    setIsReady(false)
    setSystemPrompt('')
    setWebsiteUrl('')
    setChunkCount(0)
    setContactInfo({ emails: [], phones: [] })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="header-icon">🕷</span>
          <div>
            <h1>RAG Web Crawler</h1>
            <p>Crawl any website · Upload documents · Chat with AI</p>
          </div>
        </div>
        {isReady && (
          <button className="btn-reset" onClick={handleReset}>
            ↺ Reset
          </button>
        )}
      </header>

      <main className="app-main">
        {!isReady ? (
          <InitiatePanel onComplete={handleInitComplete} />
        ) : (
          <ChatPanel
            systemPrompt={systemPrompt}
            websiteUrl={websiteUrl}
            chunkCount={chunkCount}
            contactInfo={contactInfo}
          />
        )}
      </main>
    </div>
  )
}
