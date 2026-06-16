import json
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import generate_api_key, get_current_account, hash_api_key
from chat import ChatEngine
from crawler import WebCrawler, extract_contact_info
from db import SessionLocal, get_db, init_db
from document_processor import DocumentProcessor
from models import Account, Plan
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

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
vector_store = VectorStore(persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"))
doc_processor = DocumentProcessor(
    openai_client,
    chunk_size=int(os.getenv("CHUNK_SIZE", 1000)),
    chunk_overlap=int(os.getenv("CHUNK_OVERLAP", 200)),
)
chat_engine = ChatEngine(openai_client)
prompt_optimizer = PromptOptimizer(openai_client)


@app.on_event("startup")
async def on_startup():
    init_db()
    db = SessionLocal()
    try:
        if not db.query(Plan).filter(Plan.name == "Free").first():
            db.add(Plan(name="Free", price_cents=0, monthly_conversation_limit=500))
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------
def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


# ---------------------------------------------------------------------------
# Payment seam — the one place a future Stripe integration plugs in.
# Today only the Free plan exists, so confirmation is immediate.
# ---------------------------------------------------------------------------
def process_payment(account: Account, plan: Plan) -> None:
    if plan.price_cents == 0:
        return
    raise HTTPException(status_code=400, detail="Paid plans are not available yet.")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
async def health():
    return {"status": "ok"}


@app.get("/api/plans")
async def list_plans(db: Session = Depends(get_db)):
    plans = db.query(Plan).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "price_cents": p.price_cents,
            "monthly_conversation_limit": p.monthly_conversation_limit,
        }
        for p in plans
    ]


class RegisterRequest(BaseModel):
    name: str
    website_url: str
    contact_email: str | None = None
    contact_phone: str | None = None
    plan_id: int | None = None


@app.post("/api/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    plan = None
    if request.plan_id is not None:
        plan = db.query(Plan).filter(Plan.id == request.plan_id).first()
    if not plan:
        plan = db.query(Plan).filter(Plan.name == "Free").first()
    if not plan:
        raise HTTPException(status_code=500, detail="No plans configured.")

    raw_key = generate_api_key()
    account = Account(
        name=request.name,
        website_url=request.website_url,
        contact_email=request.contact_email,
        contact_phone=request.contact_phone,
        plan_id=plan.id,
        api_key_hash=hash_api_key(raw_key),
        status="pending",
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    return {
        # Shown once — only the hash is persisted. The customer must save this.
        "account_id": account.id,
        "api_key": raw_key,
        "plan": {"id": plan.id, "name": plan.name, "price_cents": plan.price_cents},
    }


@app.post("/api/account/confirm")
async def confirm_account(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if account.status != "pending":
        raise HTTPException(status_code=400, detail=f"Account is already {account.status}.")

    process_payment(account, account.plan)

    account.status = "confirmed"
    db.commit()
    return {"status": account.status}


@app.post("/api/account/initiate")
async def initiate_account(
    file: UploadFile = File(None),
    account: Account = Depends(get_current_account),
):
    # get_current_account used its own short-lived session (already closed);
    # this route opens a fresh one that stays open for the whole SSE stream.
    db = SessionLocal()
    account = db.merge(account)
    if account.status not in ("confirmed", "ready"):
        status = account.status
        db.close()
        raise HTTPException(
            status_code=400,
            detail=f"Account must be confirmed before initiation (current status: {status}).",
        )

    url = account.website_url
    collection_name = account.chroma_collection or f"kb_{account.id}"

    async def event_stream():
        try:
            account.status = "crawling"
            account.chroma_collection = collection_name
            db.commit()
            vector_store.reset(collection_name)

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
                    vector_store.add_documents(collection_name, texts, embeddings, metadatas, ids)
                    chunk_id += len(chunks)
                    sample_texts.extend(texts[:2])

            yield sse({"type": "progress", "message": f"Crawled {pages_crawled} pages."})

            # ── 1b. Extract contact info ──────────────────────────────────
            contact_info = extract_contact_info(all_pages)
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
                    vector_store.add_documents(collection_name, texts, embeddings, metadatas, ids)
                    chunk_id += len(doc_chunks)
                    sample_texts.extend(texts[:2])
                yield sse({"type": "progress", "message": "Document processed."})

            # ── 3. Auto-generate system prompt ────────────────────────────
            yield sse({"type": "progress", "message": "Generating optimized system prompt …"})
            site_summary = prompt_optimizer.summarize_content(sample_texts)
            system_prompt = prompt_optimizer.generate_system_prompt(site_summary, url, contact_info)

            account.status = "ready"
            account.system_prompt = system_prompt
            account.chunk_count = vector_store.count(collection_name)
            account.contact_info_json = json.dumps(contact_info)
            db.commit()

            yield sse(
                {
                    "type": "complete",
                    "message": "Initialization complete! Chat is now ready.",
                    "system_prompt": system_prompt,
                    "chunk_count": account.chunk_count,
                    "contact_info": contact_info,
                }
            )

        except Exception as exc:
            # Roll back to "confirmed" so the customer (or us) can retry initiation.
            account.status = "confirmed"
            db.commit()
            yield sse({"type": "error", "message": str(exc)})
        finally:
            db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/account/status")
async def account_status(account: Account = Depends(get_current_account)):
    return {
        "ready": account.status == "ready",
        "status": account.status,
        "website_url": account.website_url,
        "system_prompt": account.system_prompt or "",
        "chunk_count": account.chunk_count,
        "contact_info": json.loads(account.contact_info_json or "{}") or {"emails": [], "phones": []},
    }


class ChatRequest(BaseModel):
    question: str


@app.post("/api/chat")
async def chat(
    request: ChatRequest,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if account.status != "ready":
        raise HTTPException(status_code=400, detail="This account's knowledge base is not ready yet.")

    plan = db.query(Plan).filter(Plan.id == account.plan_id).first()
    if plan and account.monthly_chat_count >= plan.monthly_conversation_limit:
        raise HTTPException(status_code=429, detail="Monthly conversation limit reached for your plan.")

    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    account.monthly_chat_count += 1
    db.commit()

    collection_name = account.chroma_collection or f"kb_{account.id}"
    system_prompt = account.system_prompt or ""

    async def event_stream():
        try:
            query_embedding = chat_engine.embed_query(question)
            results = vector_store.query(collection_name, query_embedding, n_results=5)
            context_chunks: list[str] = results.get("documents", [[]])[0]

            for token in chat_engine.stream_answer(question, context_chunks, system_prompt):
                yield sse({"type": "token", "content": token})

            yield sse({"type": "done"})
        except Exception as exc:
            yield sse({"type": "error", "message": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
