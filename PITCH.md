# Product Pitch
## RAG Web Crawler — Talk to Any Website

> **"Don't browse it. Talk to it."**

---

## The Problem

Every website is a maze.

Users land on a company's site looking for one specific answer — pricing, a policy, a feature detail — and spend minutes clicking through menus, reading walls of text, and searching FAQs that don't quite match their question.

- The average user spends **2–3 minutes** navigating before finding what they need — if they find it at all
- Support teams receive **40–60% of tickets** that are already answered on their own website
- Non-English speakers and non-technical users are disproportionately left behind

The information is there. The problem is access.

---

## The Solution

**Point a URL at our app. Then just ask.**

RAG Web Crawler reads an entire website for you — every page, every FAQ, every product detail — and turns it into a conversational AI that knows that site inside out. Users ask questions in plain language, by voice or text, and get precise answers instantly.

No reading. No clicking. No frustration.

---

## How It Works

```
Step 1 ──► Enter any website URL
            App crawls all pages in under 60 seconds

Step 2 ──► Ask a question — type it or speak it
            In English or Hindi

Step 3 ──► Get the answer instantly
            Streamed as text, spoken aloud
```

That's it. No signup friction for end users. No browser plugins. No installs.

---

## Key Features

| Feature | Detail |
|---|---|
| Full website crawl | Up to 50 pages, BFS traversal, auto-deduplication |
| Document ingestion | Upload PDF, DOCX, or TXT alongside the website |
| Voice input | Browser-native mic — speak your question |
| Voice output | Answer read back aloud after streaming |
| Bilingual | English and Hindi — switchable mid-session |
| Auto AI persona | System prompt auto-generated from the website's own content |
| Contact extraction | Emails and phone numbers surfaced automatically |
| Zero local setup | Works in Chrome/Edge — no installs for end users |

---

## Who It's For

**Customer Support Teams**
Deploy a voice bot trained on your own support docs. Deflect repetitive tickets without hiring more agents.

**Sales & Pre-Sales**
Research a prospect's product in 60 seconds. Ask questions about their pricing, integrations, and differentiators — by voice, while on a call.

**Students & Researchers**
Talk to product documentation, technical whitepapers, or academic resources instead of reading them end to end.

**Non-Technical / Multilingual Users**
Navigate complex enterprise sites in Hindi. No jargon, no menus — just ask.

---

## Use Cases

- **"Talk to our docs"** — embed as a widget on SaaS documentation sites
- **Multilingual helpdesk** — instant EN/Hindi answers for Indian B2C brands
- **Internal knowledge base** — upload HR policy PDFs + company wiki URL, ask by voice
- **Competitive intelligence** — crawl a competitor's site and query it
- **Field sales tool** — sales reps ask product questions hands-free while driving

---

## Why Now

1. **LLMs are good enough** — GPT-4o delivers accurate, contextual answers from retrieved chunks with very low hallucination on factual queries
2. **Voice is the new keyboard** — browser Speech APIs have reached production quality in Chrome/Edge; Hindi support is now reliable
3. **RAG is proven** — retrieval-augmented generation is the correct architecture for grounded, up-to-date answers (no fine-tuning, no retraining)
4. **Zero infra costs at POC scale** — the entire stack runs on free tiers (Vercel + Render + OpenAI pay-per-use)

---

## Competitive Landscape

| Capability | This Product | Chatbase | Intercom Fin | Custom GPT |
|---|---|---|---|---|
| Crawl any live URL | Yes | No (upload only) | No | No |
| Voice input | Yes | No | No | Limited |
| Voice output | Yes | No | No | No |
| Hindi support | Yes | Rare | No | Limited |
| Self-hostable | Yes | No | No | No |
| Free tier | Yes | Freemium | Paid | OpenAI sub |
| Setup time | < 2 minutes | 10–30 min | Days | 30–60 min |

**Key differentiator:** We are the only solution that combines live URL crawling, voice I/O, and multilingual support in a zero-install, self-deployable package.

---

## Current Status

**Working POC — live today.**

- Frontend: Vercel (auto-deploys on every GitHub push)
- Backend: Render (FastAPI + ChromaDB + OpenAI)
- Tested on: product websites, documentation sites, news portals
- Languages: English, Hindi
- Supported browsers: Chrome, Edge

---

## Roadmap

### Phase 1 — Now (POC)
Single-user voice chatbot. Crawl any URL. EN + Hindi. Live demo available.

### Phase 2 — Multi-User Sessions
- Each browser tab gets an isolated knowledge base (session ID scoped)
- Multiple users can work with different websites simultaneously
- Session state persisted in Redis (Upstash free tier)
- Timeline: 2–3 weeks

### Phase 3 — Email from Audio Command
- User says: *"Send this answer to john@company.com"*
- System detects intent via GPT-4o function calling
- Composes and sends email via Resend API (3,000 free emails/month)
- Confirmation spoken back via TTS
- Timeline: 4–5 weeks from Phase 2

### Phase 4 — Beyond (Product Vision)
- Embeddable widget (one `<script>` tag, any website)
- More languages (Tamil, Telugu, Bengali)
- CRM integration (log chat summaries to HubSpot / Salesforce)
- Analytics dashboard (what are users asking most?)

---

## Tech Stack (Brief)

```
Frontend   React 18 + Vite → Vercel
Backend    FastAPI + Python → Render
AI         OpenAI GPT-4o + text-embedding-3-small
Storage    ChromaDB (vector) — moving to cloud in Phase 2
Audio      Browser Web Speech API — 100% free, zero server
```

---

## The Ask

We are looking for:

- **Beta testers** — companies or individuals who want to point this at their own website
- **Design feedback** — UX improvements for non-technical users
- **Partners** — SaaS companies who want a "Talk to our docs" widget
- **Investors / Angels** — to accelerate Phase 2 and Phase 3

**Try the live demo:** [your-vercel-url]
**GitHub:** https://github.com/letsdevelopapplication-AKS/rag-web-crawler

---

*Built with OpenAI, FastAPI, ChromaDB, React, and the Web Speech API.*
*Open source. Free tier. Ready to demo.*
