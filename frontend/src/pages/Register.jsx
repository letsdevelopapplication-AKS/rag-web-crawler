import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'
import NodeMotif from '../components/NodeMotif'
import BrandMark from '../components/BrandMark'

export default function Register() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [planId, setPlanId] = useState(null)
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/plans`)
      .then((r) => r.json())
      .then((data) => {
        setPlans(data)
        if (data.length) setPlanId(data[0].id)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const regRes = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          website_url: websiteUrl,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          plan_id: planId,
        }),
      })
      if (!regRes.ok) throw new Error((await regRes.json()).detail || 'Registration failed.')
      const reg = await regRes.json()

      const confirmRes = await fetch(`${API_BASE}/api/account/confirm`, {
        method: 'POST',
        headers: { 'X-API-Key': reg.api_key },
      })
      if (!confirmRes.ok) throw new Error((await confirmRes.json()).detail || 'Confirmation failed.')

      localStorage.setItem('rag_account_id', reg.account_id)
      localStorage.setItem('rag_api_key', reg.api_key)
      setIssued(reg)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyKey = () => {
    navigator.clipboard?.writeText(issued.api_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (issued) {
    return (
      <div className="auth-shell">
        <NodeMotif />
        <div className="auth-card">
          <div className="brand-row">
            <BrandMark />
            <div>
              <h1>You're set up</h1>
              <p>Save your API key — it won't be shown again.</p>
            </div>
          </div>

          <div className="key-reveal">
            <div className="key-value">{issued.api_key}</div>
            <button type="button" className="btn-link" onClick={copyKey}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="key-warn">
            ⚠ This key authenticates both your dashboard login and your embedded chat widget. Store it safely — anyone with it can chat using your knowledge base.
          </p>

          <button className="btn-initiate" onClick={() => navigate('/dashboard')}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <NodeMotif />
      <div className="auth-card">
        <div className="initiate-intro">
          <h2>Bring your website's AI chatbot to life</h2>
          <p>
            Register your site and we'll crawl it, vectorize the content, and prep an instant
            voice + text Q&A bot you can embed anywhere with one line.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="initiate-form">
          <div className="field">
            <label>Your / Company Name <span className="required">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
          </div>

          <div className="field">
            <label>Website URL <span className="required">*</span></label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Contact Email <span className="optional">(optional)</span></label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={loading} />
          </div>

          <div className="field">
            <label>Contact Phone <span className="optional">(optional)</span></label>
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={loading} />
          </div>

          {plans.length > 0 && (
            <div className="field">
              <label>Plan</label>
              <div className="plan-list">
                {plans.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`plan-card ${planId === p.id ? 'plan-selected' : ''}`}
                    onClick={() => setPlanId(p.id)}
                  >
                    <span className="plan-name">{p.name}</span>
                    <span className="plan-price">
                      {p.price_cents === 0 ? 'Free' : `$${(p.price_cents / 100).toFixed(2)}/mo`}
                    </span>
                    <span className="plan-limit">{p.monthly_conversation_limit} conversations/mo</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn-initiate" type="submit" disabled={loading || !name || !websiteUrl}>
            {loading ? (
              <><span className="spinner" /> Confirming…</>
            ) : (
              'Confirm & Create My Chatbot'
            )}
          </button>
        </form>

        {error && <div className="error-banner">⚠ {error}</div>}
      </div>
    </div>
  )
}
