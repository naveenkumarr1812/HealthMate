import os
from dotenv import load_dotenv

load_dotenv()

# ── Groq API Keys (Supports single or multiple fallback keys) ───────────────
_keys = []
if os.getenv("GROQ_API_KEYS"):
    _keys.extend([k.strip() for k in os.getenv("GROQ_API_KEYS").split(",") if k.strip()])

# Also check individual numbered keys: GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEY_2, etc.
for env_name in ["GROQ_API_KEY", "GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4", "GROQ_API_KEY_5"]:
    val = os.getenv(env_name)
    if val and val.strip() and val.strip() not in _keys:
        _keys.append(val.strip())

GROQ_API_KEYS = _keys
GROQ_API_KEY = GROQ_API_KEYS[0] if GROQ_API_KEYS else None

# Models
GROQ_MODEL = os.getenv("GROQ_MODEL", "meta-llama/llama-prompt-guard-2-22m")
GROQ_FALLBACK_MODELS = [
    "meta-llama/llama-prompt-guard-2-86m",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-120b",
]

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
FAISS_DIR = os.getenv("FAISS_DIR", "faiss_indexes")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K_DOCS = 5
RELEVANCE_THRESHOLD = 0.5

