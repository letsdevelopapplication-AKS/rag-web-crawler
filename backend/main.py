import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

from chat import ChatEngine
from crawler import WebCrawler, extract_contact_info
from document_processor import DocumentProcessor
from prompt_optimizer import PromptOptimizer
from vector_store import VectorStore

load_dotenv()

app = FastAPI(title="RAG Web Crawler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared state (in-memory; survives for the lifetime of the server process)
# ---------------------------------------------------------------------------
state: dict = {
    "ready": False,
    "system_prompt": "",
    "website_url": "",
    "chunk_count": 0,
    "contact_info": {"emails": [], "phones": []},
}

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
vector_store = VectorStore(persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"))
doc_processor = DocumentProcessor(
    openai_client,
    chunk_size=int(os.getenv("CHUNK_SIZE", 1000)),
    chunk_overlap=int(os.getenv("CHUNK_OVERLAP", 200)),
)
chat_engine = ChatEngine(openai_client)
prompt_optimizer = PromptOptimizer(openai_client)


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------
def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/status")
async def get_status():
    return state


@app.post("/api/initiate")
async def initiate(url: str = Form(...), file: UploadFile = File(None)):
    async def event_stream():
        try:
            state["ready"] = False
            vector_store.reset()

            sample_texts: list[str] = []
            all_pages: list[dict] = []
            chunk_id = 0

            # ── 1. Crawl website ──────────────────────────────────────────
            yield sse({"type": "progress", "message": f"Starting crawl of {url} …"})
            crawler = WebCrawler(max_pages=int(os.getenv("MAX_PAGES", 50)))
            pages_crawled = 0

            for page in crawler.crawl(url):
                pages_crawled += 1
                all_pages.append(page)
                title_short = page["title"][:60]
                yield sse({"type": "progress", "message": f"[{pages_crawled}] {title_short}"})

                chunks = doc_processor.chunk_text(
                    page["text"],
                    {"source": page["url"], "title": page["title"], "type": "webpage"},
                )
                if chunks:
                    texts = [c["text"] for c in chunks]
                    embeddings = doc_processor.embed_texts(texts)
                    ids = [f"page_{chunk_id + i}" for i in range(len(chunks))]
                    metadatas = [c["metadata"] for c in chunks]
                    vector_store.add_documents(texts, embeddings, metadatas, ids)
                    chunk_id += len(chunks)
                    sample_texts.extend(texts[:2])

            yield sse({"type": "progress", "message": f"Crawled {pages_crawled} pages."})

            # ── 1b. Extract contact info ──────────────────────────────────
            contact_info = extract_contact_info(all_pages)
            state["contact_info"] = contact_info
            if contact_info["emails"] or contact_info["phones"]:
                emails = ", ".join(contact_info["emails"]) if contact_info["emails"] else "—"
                phones = ", ".join(contact_info["phones"]) if contact_info["phones"] else "—"
                yield sse({"type": "progress", "message": f"Contact found — Email: {emails} | Phone: {phones}"})

            # ── 2. Process uploaded document ──────────────────────────────
            if file and file.filename:
                yield sse({"type": "progress", "message": f"Processing document: {file.filename} …"})
                content = await file.read()
                doc_text = doc_processor.extract_text_from_file(content, file.filename)
                doc_chunks = doc_processor.chunk_text(
                    doc_text,
                    {"source": file.filename, "title": file.filename, "type": "document"},
                )
                if doc_chunks:
                    texts = [c["text"] for c in doc_chunks]
                    embeddings = doc_processor.embed_texts(texts)
                    ids = [f"doc_{chunk_id + i}" for i in range(len(doc_chunks))]
                    metadatas = [c["metadata"] for c in doc_chunks]
                    vector_store.add_documents(texts, embeddings, metadatas, ids)
                    chunk_id += len(doc_chunks)
                    sample_texts.extend(texts[:2])
                yield sse({"type": "progress", "message": "Document processed."})

            # ── 3. Auto-generate system prompt ────────────────────────────
            yield sse({"type": "progress", "message": "Generating optimized system prompt …"})
            site_summary = prompt_optimizer.summarize_content(sample_texts)
            system_prompt = prompt_optimizer.generate_system_prompt(site_summary, url, contact_info)

            state["ready"] = True
            state["system_prompt"] = system_prompt
            state["website_url"] = url
            state["chunk_count"] = vector_store.count()

            yield sse(
                {
                    "type": "complete",
                    "message": "Initialization complete! Chat is now ready.",
                    "system_prompt": system_prompt,
                    "chunk_count": state["chunk_count"],
                    "contact_info": contact_info,
                }
            )

        except Exception as exc:
            yield sse({"type": "error", "message": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class ChatRequest(BaseModel):
    question: str


@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not state["ready"]:
        raise HTTPException(status_code=400, detail="System not initialized. Please run initiation first.")

    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    async def event_stream():
        try:
            query_embedding = chat_engine.embed_query(question)
            results = vector_store.query(query_embedding, n_results=5)
            context_chunks: list[str] = results.get("documents", [[]])[0]

            for token in chat_engine.stream_answer(question, context_chunks, state["system_prompt"]):
                yield sse({"type": "token", "content": token})

            yield sse({"type": "done"})
        except Exception as exc:
            yield sse({"type": "error", "message": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.delete("/api/reset")
async def reset():
    vector_store.reset()
    state.update({"ready": False, "system_prompt": "", "website_url": "", "chunk_count": 0, "contact_info": {"emails": [], "phones": []}})
    return {"message": "Reset successful"}
