# HealthMate - Intelligent Medical Assistant

> LangGraph · Corrective RAG · Groq · FAISS · FastEmbed · Supabase · React · Tailwind · PWA

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Accounts: Supabase, Groq, Tavily, Google Cloud

### 1. Clone & Setup
```bash
git clone <your-repo>
cd HealthMate
```

### 2. Supabase Setup
1. Create project at [supabase.com](https://supabase.com)
2. SQL Editor → Run `supabase_complete_fix.sql` (complete DB setup)
3. Storage → Verify `medical-documents` bucket exists
4. Settings → API → Copy URL, anon key, service_role key

### 3. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux

pip install -r requirements.txt

cp .env.example .env
# Fill in all values in .env

python main.py
# → http://localhost:8000
# → http://localhost:8000/docs  (API docs)
```

### 4. Frontend
```bash
cd frontend
npm install

cp .env.example .env
# Fill in Supabase URL, anon key, Google client ID

npm run dev
# → http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Get from |
|---|---|---|
| `GROQ_API_KEY` | Groq LLM API key | [console.groq.com](https://console.groq.com) |
| `TAVILY_API_KEY` | Web search API key | [tavily.com](https://app.tavily.com) |
| `SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase anon key | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | Service role key | Supabase → Settings → API |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Google Cloud Console |
| `GMAIL_REDIRECT_URI` | OAuth callback URL | `http://localhost:5173/gmail-callback` |
| `FRONTEND_URL` | Production frontend URL | Your domain |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Same as backend SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Same as backend SUPABASE_ANON_KEY |
| `VITE_GOOGLE_CLIENT_ID` | Same as backend GOOGLE_CLIENT_ID |

---

## Features

| Feature | Description |
|---|---|
| **AI Chat** | Conversational medical assistant with memory |
| **Symptom Checker** | 4-step guided symptom assessment |
| **Hospital Search** | Real nearby hospitals via OpenStreetMap GPS |
| **Document Upload** | PDF/image upload → AI analysis |
| **Doc Summarizer** | Complex reports → simple English |
| **Medical News** | Personalized news per condition via Tavily |
| **Health Profile** | Persistent conditions & allergies |
| **Medication Tracker** | Ring + Gmail reminders |
| **My Documents** | Secure file storage via Supabase Storage |
| **PWA** | Install as mobile/desktop app |
| **Long-term Memory** | Remembers health context across sessions |

---

## Architecture

```
User
 │
 ▼
React + Tailwind (PWA)
 │ axios /api/*
 ▼
FastAPI + Middleware (JWT auth)
 │
 ├── LangGraph Pipeline
 │    ├── load_memory (Supabase profile)
 │    ├── retrieve_docs (FAISS + FastEmbed)
 │    ├── grade_docs (Corrective RAG)
 │    ├── web_search (Tavily / DuckDuckGo)
 │    ├── location_search (OpenStreetMap)
 │    └── generate_answer (Groq llama-3.3-70b)
 │
 ├── Supabase
 │    ├── Auth (JWT)
 │    ├── PostgreSQL (profiles, chats, meds)
 │    └── Storage (medical documents)
 │
 └── Background Scheduler
      └── Gmail medication reminders (every 60s)
```


## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Groq (llama-3.3-70b-versatile) |
| Orchestration | LangGraph StateGraph |
| RAG | LangChain + Corrective RAG |
| Embeddings | FastEmbed (BAAI/bge-small-en-v1.5) |
| Vector DB | FAISS (per-user, persistent) |
| Web Search | Tavily API + DuckDuckGo |
| Location | OpenStreetMap Overpass API (free) |
| Backend | FastAPI + Uvicorn |
| Auth + DB | Supabase (PostgreSQL + Auth + Storage) |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| PDF Parsing | PyMuPDF |
| Gmail | Gmail API (OAuth 2.0) |
| PWA | Service Worker + Web App Manifest |
