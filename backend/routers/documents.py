from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from rag.vector_store import add_document, delete_user_index
from memory.user_context import extract_and_update_health_info
from db.supabase_client import supabase
from config import GROQ_API_KEY, GROQ_MODEL, CHUNK_SIZE, CHUNK_OVERLAP

router = APIRouter(prefix="/documents", tags=["Documents"])

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ".", " "],
)
llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0)


@router.post("/upload")
async def upload_document(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Uploads a medical PDF:
    1. Extracts text with PyMuPDF
    2. Splits into chunks
    3. Instantly embeds with FastEmbed + saves to FAISS (persistent)
    4. Auto-extracts health info with LLM → updates user profile
    5. Saves document metadata to Supabase
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()

    # Extract text
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text()
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")

    if not full_text.strip():
        raise HTTPException(status_code=422, detail="PDF appears to be empty or scanned (no extractable text).")

    # Split into chunks
    chunks = splitter.split_text(full_text)
    metadata = [
        {"text": chunk, "filename": file.filename, "user_id": user_id}
        for chunk in chunks
    ]

    # Embed instantly and save to FAISS
    add_document(user_id, chunks, metadata)

    # Auto-extract health info and update profile
    try:
        extract_and_update_health_info(user_id, llm, full_text)
    except Exception as e:
        print(f"[Upload] Health extraction warning: {e}")

    # Generate document summary for Supabase record
    try:
        summary_response = llm.invoke([
            SystemMessage(content="You are a medical document summarizer. Give a 2-sentence summary."),
            HumanMessage(content=full_text[:2000])
        ])
        summary = summary_response.content
    except:
        summary = "Medical document uploaded."

    # Save metadata to Supabase
    try:
        supabase.table("documents").insert({
            "user_id": user_id,
            "filename": file.filename,
            "summary": summary,
            "chunk_count": len(chunks),
        }).execute()
    except Exception as e:
        print(f"[Upload] Supabase metadata save warning: {e}")

    return {
        "status": "success",
        "filename": file.filename,
        "chunks_indexed": len(chunks),
        "summary": summary,
        "message": "Document embedded and ready for questions instantly."
    }


@router.get("/list/{user_id}")
async def list_documents(user_id: str):
    """Returns all documents uploaded by a user."""
    try:
        result = (
            supabase.table("documents")
            .select("id, filename, summary, chunk_count, uploaded_at")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .execute()
        )
        return {"documents": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/all")
async def delete_all_documents(user_id: str):
    """Deletes all user documents and their FAISS embeddings."""
    delete_user_index(user_id)
    supabase.table("documents").delete().eq("user_id", user_id).execute()
    return {"status": "deleted", "message": "All documents and embeddings removed."}


class SummarizeRequest(BaseModel):
    user_id: str
    document_text: str

@router.post("/summarize")
async def summarize_document(request: SummarizeRequest):
    """
    Directly summarizes provided text (for pasted or extracted content).
    Converts medical jargon → simple English + bullet points + risks.
    """
    system = """You are a medical document simplification expert.
Convert the medical document into:

## Simple Summary
(2-3 sentences in plain everyday language)

## Key Findings
- bullet points

## What's Looking Good ✅
- bullet points

## What Needs Attention ⚠️
- Each item with risk: Low / Medium / High

## Recommended Next Steps
- Simple action items

Be warm, clear, and non-alarming."""

    try:
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=request.document_text[:5000])
        ])
        return {"summary": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
