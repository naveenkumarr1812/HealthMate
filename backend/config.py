import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

GROQ_MODEL = "llama-3.3-70b-versatile"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
FAISS_DIR = "faiss_indexes"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K_DOCS = 5
RELEVANCE_THRESHOLD = 0.5
