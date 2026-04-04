# MedAI — Intelligent Medical Assistant

> LangGraph + Corrective RAG + Groq + FAISS + FastEmbed + Supabase + React + Tailwind

---

## Features

- **Corrective RAG** — Grades doc relevance; falls back to Tavily web search if docs are insufficient
- **Instant Embeddings** — FastEmbed + FAISS: embedded the moment you upload, persists forever
- **Personalized Health Memory** — Remembers your conditions, allergies, report trends across sessions
- **Symptom Checker** — Guided 4-step flow; always ends with doctor recommendation
- **Document Summarizer** — Complex reports → simple English + bullet points + risk flags
- **Medical News** — Tavily-powered live news, personalized to your conditions
- **Auth** — Supabase Auth (email/password) with per-user data isolation

---

## Project Structure

```
medai/
├── backend/           # FastAPI + LangGraph + Groq
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── agents/        # LangGraph graph, nodes, state
│   ├── rag/           # FAISS vector store, corrective RAG, Tavily
│   ├── memory/        # User health context engine
│   ├── routers/       # FastAPI endpoints
│   └── db/            # Supabase client
├── frontend/          # React + Tailwind + Vite
│   ├── src/
│   │   ├── pages/     # Login, Signup, Dashboard
│   │   ├── components/ # ChatWindow, SymptomChecker, DocSummarizer, etc.
│   │   ├── context/   # AuthContext
│   │   └── api/       # axios calls + supabase client
└── supabase_schema.sql
```

---

## Setup Guide

### Step 1 — Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Paste and run the contents of `supabase_schema.sql`
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (keep this secret!)

### Step 2 — Get API Keys

- **Groq**: [console.groq.com](https://console.groq.com) → Create API Key
- **Tavily**: [tavily.com](https://tavily.com) → Get API Key

### Step 3 — Backend Setup

```bash
cd medai/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Fill in your keys in .env

# Run the server
python main.py
# OR
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### Step 4 — Frontend Setup

```bash
cd medai/frontend
npm install

# Create .env from template
cp .env.example .env
# Fill in Supabase URL and anon key

npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## LangGraph Flow

```
User Query
    │
    ▼
load_user_memory          ← Loads conditions, allergies, trends from Supabase
    │
    ▼
retrieve_docs             ← Searches user's FAISS index with FastEmbed
    │
    ▼
grade_documents           ← Corrective RAG: scores doc relevance (0.0–1.0)
    │
    ├── score < 0.5 ──→ web_search (Tavily) ──→ generate_answer
    ├── score ≥ 0.5 ──────────────────────────→ generate_answer
    ├── mode=symptom ──────────────────────────→ symptom_checker
    └── mode=summarize ────────────────────────→ summarize_document
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login, get JWT |
| GET | `/auth/profile/{user_id}` | Get health profile |
| PUT | `/auth/profile` | Update conditions/allergies |
| POST | `/chat` | Main chat (RAG + memory) |
| GET | `/chat/history/{user_id}` | Chat history |
| POST | `/documents/upload` | Upload + embed PDF |
| GET | `/documents/list/{user_id}` | List uploaded docs |
| POST | `/documents/summarize` | Summarize pasted text |
| POST | `/symptoms/check` | Guided symptom check |
| GET | `/news/medical` | General medical news |
| GET | `/news/personalized/{user_id}` | Condition-specific news |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| LLM | Groq (llama-3.3-70b-versatile) |
| Orchestration | LangGraph StateGraph |
| RAG Framework | LangChain |
| Embeddings | FastEmbed (BAAI/bge-small-en-v1.5) |
| Vector DB | FAISS (per-user, persistent) |
| Web Search | Tavily API |
| Backend | FastAPI + Uvicorn |
| Auth + DB | Supabase (PostgreSQL + Auth) |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| PDF Parsing | PyMuPDF (fitz) |
