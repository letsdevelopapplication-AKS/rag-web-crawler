# Architecture Design Document
## RAG Web Crawler — Talk to Any Website

**Version:** 1.0 (POC)
**Status:** Live — Vercel (frontend) + Render (backend)

---

## 1. Overview

RAG Web Crawler is a voice-first AI assistant that lets users talk to any website instead of reading it. A user provides a URL; the system crawls all pages, chunks and embeds the content into a vector store, and auto-generates an AI persona tuned to that website. Users then ask questions by voice or text and receive streamed, contextually accurate answers — spoken back in their chosen language (English or Hindi). The system requires no browser plugins and has zero local dependencies for end users.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser  (Vercel)                     │
│                                                         │
│  ┌──────────────┐         ┌───────────────────────┐     │
│  │ InitiatePanel │         │      ChatPanel         │     │
│  │  URL input    │         │  Message thread        │     │
│  │  File upload  │         │  Language picker       │     │
│  └──────┬───────┘         │  TTS on/off toggle     │     │
│         │                 └──────────┬──────────────┘     │
│         │                           │                     │
│         │              ┌────────────┴──────────────┐      │
│         │              │     Web Speech APIs        │      │
│         │              │  SpeechRecognition (STT)   │      │
│         │              │  SpeechSynthesis   (TTS)   │      │
│         │              └────────────┬──────────────┘      │
└─────────┼───────────────────────────┼────────────────────┘
          │  HTTPS / SSE              │
          ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend  (Render)                │
│                                                         │
│  POST /api/initiate (SSE)    POST /api/chat (SSE)       │
│         │                           │                    │
│  ┌──────┴──────┐           ┌────────┴──────┐            │
│  │  WebCrawler  │           │  ChatEngine   │            │
│  │  BFS, 50pg   │           │  embed query  │            │
│  └──────┬──────┘           └────────┬──────┘            │
│         │                           │                    │
│  ┌──────┴──────────┐       ┌────────┴──────┐            │
│  │DocumentProcessor│       │  VectorStore  │            │
│  │ chunk + embed   │──────►│  ChromaDB     │◄───────────┤
│  └─────────────────┘       └───────────────┘            │
│                                                         │
│  ┌──────────────────┐      ┌───────────────┐            │
│  │ PromptOptimizer  │      │  OpenAI API   │            │
│  │ auto system prompt│─────►│  GPT-4o       │            │
│  └──────────────────┘      │  embedding-3  │            │
│                            └───────────────┘            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

| Component | File | Responsibility |
|---|---|---|
| **InitiatePanel** | `frontend/src/components/InitiatePanel.jsx` | URL input, optional file upload, SSE progress log |
| **ChatPanel** | `frontend/src/components/ChatPanel.jsx` | Message thread, mic button, language picker, TTS toggle |
| **Web Speech STT** | Browser-native | Records voice, transcribes to text in-browser (no server call) |
| **Web Speech TTS** | Browser-native | Reads bot responses aloud after stream completes |
| **FastAPI App** | `backend/main.py` | All routes, SSE streaming, shared in-memory session state |
| **WebCrawler** | `backend/crawler.py` | BFS crawl up to 50 pages, contact info extraction (email/phone regex) |
| **DocumentProcessor** | `backend/document_processor.py` | Text extraction from PDF/DOCX/TXT, token-aware chunking with overlap |
| **VectorStore** | `backend/vector_store.py` | ChromaDB wrapper — cosine similarity, add/query/reset |
| **ChatEngine** | `backend/chat.py` | Embeds user query, retrieves top-5 chunks, streams GPT-4o response |
| **PromptOptimizer** | `backend/prompt_optimizer.py` | Summarises crawled content, generates a tuned system prompt per website |

---

## 4. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 18 + Vite | Fast HMR, small production bundle |
| Speech-to-Text | Browser `SpeechRecognition` API | Zero dependency, free, EN + Hindi |
| Text-to-Speech | Browser `SpeechSynthesis` API | Zero dependency, free, all OS voices |
| Backend framework | FastAPI + Uvicorn | Async, native SSE, Python ecosystem |
| Vector database | ChromaDB (embedded) | No infrastructure, runs in-process |
| Embeddings | OpenAI `text-embedding-3-small` | High quality, low cost |
| LLM | OpenAI GPT-4o | Best reasoning, native streaming |
| Frontend hosting | Vercel | Git-connected auto-deploy, free tier |
| Backend hosting | Render | Git-connected auto-deploy, free tier |

---

## 5. Data Flows

### 5.1 Initiation Flow
```
User enters URL
  └─► POST /api/initiate (SSE)
        ├─► WebCrawler.crawl(url)
        │     ├─► BFS fetch up to 50 pages
        │     └─► yield page  ──► SSE progress event to browser
        ├─► extract_contact_info(pages)
        ├─► DocumentProcessor.chunk_text()  ──► ~1000 token chunks, 200 overlap
        ├─► DocumentProcessor.embed_texts() ──► OpenAI text-embedding-3-small
        ├─► VectorStore.add_documents()     ──► ChromaDB
        ├─► (optional) process uploaded file (same pipeline)
        ├─► PromptOptimizer.summarize_content()
        ├─► PromptOptimizer.generate_system_prompt()
        └─► SSE complete event  { system_prompt, chunk_count, contact_info }
```

### 5.2 Chat Flow
```
User submits question
  └─► POST /api/chat (SSE)
        ├─► ChatEngine.embed_query()     ──► OpenAI embedding
        ├─► VectorStore.query(top_k=5)  ──► cosine similarity search
        ├─► ChatEngine.stream_answer()  ──► GPT-4o with retrieved context
        │     └─► yield token           ──► SSE token event to browser
        └─► SSE done event
              └─► browser SpeechSynthesis.speak(full_response)
```

### 5.3 Audio Flow
```
User clicks mic button
  └─► SpeechRecognition.start()
        ├─► lang = 'en-US' or 'hi-IN'
        ├─► (user speaks)
        └─► onresult: transcript → fills chat input box
              └─► user submits → Chat Flow above
```

---

## 6. API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | Health check — returns `{"status": "ok"}` |
| `GET` | `/api/status` | None | Returns current session state (ready, url, chunk count) |
| `POST` | `/api/initiate` | None | `multipart/form-data`: `url` (required), `file` (optional). SSE stream. |
| `POST` | `/api/chat` | None | JSON: `{"question": "..."}`. SSE stream of tokens. |
| `DELETE` | `/api/reset` | None | Clears ChromaDB collection and resets session state |

**SSE Event Types**

| Type | Payload | When |
|---|---|---|
| `progress` | `{ message }` | During crawl/processing |
| `complete` | `{ system_prompt, chunk_count, contact_info }` | Initiation done |
| `token` | `{ content }` | Each streamed word from GPT-4o |
| `done` | — | Stream finished |
| `error` | `{ message }` | Any exception |

---

## 7. Current Limitations (POC)

| Limitation | Impact | Resolution in v2 |
|---|---|---|
| In-memory session state | Lost on Render restart/sleep | Redis or persistent DB |
| Single shared session | Only one website loaded at a time | Per-user session isolation |
| Ephemeral ChromaDB on Render | Data lost on redeploy | Persistent volume or cloud vector DB |
| No authentication | Anyone can reset or re-initiate | Auth layer (Clerk / Firebase) |
| STT requires Chrome/Edge | Firefox users must type | Graceful fallback (already in place) |

---

## 8. Future Architecture

### Phase 2 — Multi-User Sessions

```
Browser
  └─► POST /api/initiate?session_id=abc123
        └─► VectorStore.get_or_create_collection("session_abc123")
              └─► Isolated knowledge base per user/session

Session state:
  └─► Redis (Upstash free tier) — keyed by session_id, TTL 24h
```

Each browser tab gets a unique `session_id` (UUID generated on first load). The backend routes all operations to a ChromaDB collection scoped to that session ID. No user data crosses sessions.

### Phase 3 — Email from Audio Command

```
User says: "Send this answer to ankit@company.com"
  └─► SpeechRecognition transcript → ChatPanel
        └─► Intent detection (GPT-4o function calling)
              ├─► intent: "send_email"
              ├─► recipient: "ankit@company.com"
              └─► body: last bot response

  POST /api/send-email
    └─► Resend API (free tier: 3,000 emails/month)
          └─► Email sent ──► confirmation spoken via SpeechSynthesis
```

Intent detection uses GPT-4o function calling — no separate NLP model needed. Email delivery via Resend (open API, free tier, no domain required for POC).
