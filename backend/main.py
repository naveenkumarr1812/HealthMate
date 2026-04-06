import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from routers.chat import router as chat_router
from routers.documents import router as documents_router
from routers.auth import router as auth_router
from routers.symptoms_news import symptom_router, news_router
from routers.memory_reminders import router as memory_router, medication_reminder_scheduler
from routers.gmail_auth import router as gmail_router
from routers.search import router as search_router
from middleware import SupabaseAuthMiddleware

# ── Allowed origins from env ──────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
# Add production URL if set
PROD_URL = os.getenv("FRONTEND_URL", "")
if PROD_URL:
    ALLOWED_ORIGINS.append(PROD_URL)

# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[HealthMate] Starting up...")
    task = asyncio.create_task(medication_reminder_scheduler())
    print("[HealthMate] ✅ Medication reminder scheduler started")
    yield
    print("[HealthMate] Shutting down...")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="HealthMate API",
    description="Medical AI Assistant - LangGraph + Corrective RAG + Groq + FAISS",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────
# 1. GZip compression for all responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# 3. Supabase JWT auth (skip public paths)
app.add_middleware(SupabaseAuthMiddleware)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(symptom_router)
app.include_router(news_router)
app.include_router(memory_router)
app.include_router(gmail_router)
app.include_router(search_router)

# ── Health endpoints ─────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "name":    "HealthMate API",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/docs",
    }

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}

# ── Global error handler ──────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"[Error] {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )

# ── Entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENV", "development") == "development",
        workers=1,  # 1 worker for LangGraph state consistency
        log_level="info",
    )
