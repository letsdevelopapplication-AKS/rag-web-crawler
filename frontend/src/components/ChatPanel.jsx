import { useState, useRef, useEffect } from 'react'
import { API_BASE } from '../config'

export default function ChatPanel({
  apiKey,
  systemPrompt,
  websiteUrl,
  chunkCount,
  contactInfo = { emails: [], phones: [] },
  compact = false,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I'm ready to answer questions about **${websiteUrl}**. I have indexed **${chunkCount}** knowledge chunks. What would you like to know?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [language, setLanguage] = useState('en')
  const bottomRef = useRef()
  const inputRef = useRef()
  const recognitionRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const speak = (text) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''))
    utt.lang = language === 'hi' ? 'hi-IN' : 'en-US'
    utt.rate = 1
    utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }

  const sendMessage = async (e, overrideQuestion) => {
    if (e) e.preventDefault()
    const question = (overrideQuestion !== undefined ? overrideQuestion : input).trim()
    if (!question || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ question }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === 'token') {
            accumulated += data.content
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = { role: 'assistant', content: accumulated }
              return next
            })
          } else if (data.type === 'done') {
            speak(accumulated)
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
        return next
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsRecording(true)

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      inputRef.current?.focus()
    }

    recognition.onerror = (e) => {
      if (e.error !== 'aborted') alert(`Speech recognition error: ${e.error}`)
      setIsRecording(false)
    }

    recognition.onend = () => setIsRecording(false)

    recognition.start()
    recognitionRef.current = recognition
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const renderContent = (text) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  return (
    <div className="chat-layout">
      {/* Sidebar — hidden in compact mode (e.g. the narrow embeddable widget) */}
      {!compact && (
      <aside className="chat-sidebar">
        <div className="sidebar-card">
          <div className="sidebar-label">Knowledge Base</div>
          <div className="sidebar-row">
            <span className="sidebar-key">Source</span>
            <a href={websiteUrl} target="_blank" rel="noreferrer" className="sidebar-link">
              {websiteUrl.replace(/^https?:\/\//, '').slice(0, 30)}
            </a>
          </div>
          <div className="sidebar-row">
            <span className="sidebar-key">Chunks</span>
            <span className="sidebar-val">{chunkCount}</span>
          </div>
        </div>

        {(contactInfo.emails.length > 0 || contactInfo.phones.length > 0) && (
          <div className="sidebar-card">
            <div className="sidebar-label">Contact Info</div>
            {contactInfo.emails.map((e) => (
              <div className="sidebar-row" key={e}>
                <span className="sidebar-key">✉</span>
                <a href={`mailto:${e}`} className="sidebar-link">{e}</a>
              </div>
            ))}
            {contactInfo.phones.map((p) => (
              <div className="sidebar-row" key={p}>
                <span className="sidebar-key">📞</span>
                <span className="sidebar-val">{p}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-card">
          <div className="sidebar-label">Audio</div>
          <div className="sidebar-row">
            <span className="sidebar-key">Language</span>
            <div className="lang-picker">
              <button
                className={`lang-btn ${language === 'en' ? 'lang-active' : ''}`}
                onClick={() => setLanguage('en')}
              >EN</button>
              <button
                className={`lang-btn ${language === 'hi' ? 'lang-active' : ''}`}
                onClick={() => setLanguage('hi')}
              >हिं</button>
            </div>
          </div>
          <div className="sidebar-row">
            <span className="sidebar-key">Voice reply</span>
            <button
              className={`tts-toggle ${ttsEnabled ? 'tts-on' : 'tts-off'}`}
              onClick={() => {
                if (ttsEnabled) window.speechSynthesis?.cancel()
                setTtsEnabled((v) => !v)
              }}
            >
              {ttsEnabled ? '🔊 On' : '🔇 Off'}
            </button>
          </div>
        </div>

        <div className="sidebar-card">
          <button className="prompt-toggle" onClick={() => setShowPrompt((v) => !v)}>
            <span>System Prompt</span>
            <span className="toggle-arrow">{showPrompt ? '▲' : '▼'}</span>
          </button>
          {showPrompt && (
            <div className="prompt-body">{systemPrompt}</div>
          )}
        </div>
      </aside>
      )}

      {/* Chat area */}
      <div className="chat-area">
        <div className="messages-list">
          {messages.map((msg, i) => (
            <div key={i} className={`msg msg-${msg.role}`}>
              <div className="msg-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div
                className="msg-bubble"
                dangerouslySetInnerHTML={{ __html: renderContent(msg.content) || (loading && i === messages.length - 1 ? '<span class="typing">●●●</span>' : '') }}
              />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="chat-form" onSubmit={sendMessage}>
          <button
            type="button"
            className={`btn-mic ${isRecording ? 'btn-mic-recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            title={isRecording ? 'Stop recording' : 'Ask by voice'}
          >
            {isRecording ? '⏹' : '🎙'}
          </button>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isRecording
                ? (language === 'hi' ? 'सुन रहा है… ⏹ दबाएं' : 'Listening… click ⏹ to stop')
                : language === 'hi' ? 'प्रश्न पूछें या माइक उपयोग करें…'
                : 'Ask a question or use the mic…'
            }
            disabled={loading || isRecording}
            autoFocus
          />
          <button className="btn-send" type="submit" disabled={loading || !input.trim() || isRecording}>
            {loading ? '…' : '➤'}
          </button>
        </form>
      </div>
    </div>
  )
}
