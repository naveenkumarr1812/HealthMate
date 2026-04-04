from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat import router as chat_router
from routers.documents import router as documents_router
from routers.auth import router as auth_router
from routers.symptoms_news import symptom_router, news_router
from middleware import SupabaseAuthMiddleware

app = FastAPI(
    title="MedAI Backend",
    description="Medical AI Assistant — LangGraph + Corrective RAG + Groq + FAISS",
    version="1.0.0",
)

# 1. CORS — must be before auth middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Supabase JWT auth middleware
app.add_middleware(SupabaseAuthMiddleware)

# Register all routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(symptom_router)
app.include_router(news_router)

@app.get("/")
def root():
    return {
        "name": "MedAI API",
        "status": "running",
        "endpoints": [
            "POST /auth/signup",
            "POST /auth/login",
            "GET  /auth/profile/{user_id}",
            "PUT  /auth/profile",
            "POST /chat",
            "GET  /chat/history/{user_id}",
            "POST /documents/upload",
            "GET  /documents/list/{user_id}",
            "POST /documents/summarize",
            "POST /symptoms/check",
            "GET  /news/medical",
            "GET  /news/personalized/{user_id}",
        ]
    }

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
