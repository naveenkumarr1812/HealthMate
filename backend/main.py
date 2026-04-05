import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat import router as chat_router
from routers.documents import router as documents_router
from routers.auth import router as auth_router
from routers.symptoms_news import symptom_router, news_router
from routers.memory_reminders import router as memory_router, medication_reminder_scheduler
from routers.gmail_auth import router as gmail_router
from routers.search import router as search_router
from middleware import SupabaseAuthMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(medication_reminder_scheduler())
    print("[Main] ✅ Background reminder scheduler running")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="MedAI Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SupabaseAuthMiddleware)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(symptom_router)
app.include_router(news_router)
app.include_router(memory_router)
app.include_router(gmail_router)
app.include_router(search_router)

@app.get("/")
def root():
    return {"name": "MedAI API", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
