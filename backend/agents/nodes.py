from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from config import GROQ_API_KEY, GROQ_MODEL, RELEVANCE_THRESHOLD
from rag.vector_store import search
from rag.corrective_rag import grade_document_relevance, tavily_medical_search
from memory.user_context import (
    load_user_health_context,
    build_memory_system_prompt,
    save_chat_message,
)
from agents.state import MedAIState

llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.3)

# ─────────────────────────────────────────────
# NODE 1: Load User Memory
# ─────────────────────────────────────────────
def load_user_memory(state: MedAIState) -> dict:
    """Fetches user health profile from Supabase and builds memory prompt."""
    context = load_user_health_context(state["user_id"])
    memory_prompt = build_memory_system_prompt(context)
    return {
        "user_health_context": context,
        "memory_prompt": memory_prompt,
    }

# ─────────────────────────────────────────────
# NODE 2: Retrieve Documents from FAISS
# ─────────────────────────────────────────────
def retrieve_docs(state: MedAIState) -> dict:
    """Searches user's FAISS index for relevant chunks."""
    docs = search(state["user_id"], state["query"])
    return {"retrieved_docs": docs}

# ─────────────────────────────────────────────
# NODE 3: Grade Document Relevance (Corrective RAG)
# ─────────────────────────────────────────────
def grade_documents(state: MedAIState) -> dict:
    """
    Scores the relevance of retrieved docs.
    If score < threshold, graph routes to web search.
    """
    score = grade_document_relevance(state["query"], state["retrieved_docs"])
    print(f"[Corrective RAG] Relevance score: {score:.2f}")
    return {"relevance_score": score}

# ─────────────────────────────────────────────
# NODE 4: Web Search Fallback (Tavily)
# ─────────────────────────────────────────────
def web_search_node(state: MedAIState) -> dict:
    """Called when RAG docs are not relevant enough — fetches from Tavily."""
    results = tavily_medical_search(state["query"])
    return {
        "web_results": results,
        "sources_used": ["web"],
    }

# ─────────────────────────────────────────────
# NODE 5: Generate Final Answer
# ─────────────────────────────────────────────
def generate_answer(state: MedAIState) -> dict:
    """
    Generates the final answer using:
    - Retrieved RAG docs (if relevant)
    - Tavily web results (if RAG was insufficient)
    - User health memory (always injected)
    """
    context_parts = []

    if state.get("retrieved_docs") and state.get("relevance_score", 0) >= RELEVANCE_THRESHOLD:
        context_parts.append("=== FROM YOUR DOCUMENTS ===\n" + "\n\n".join(state["retrieved_docs"]))
        sources = ["rag"]
    elif state.get("web_results"):
        context_parts.append("=== FROM MEDICAL SOURCES ===\n" + "\n\n".join(state["web_results"][:3]))
        sources = ["web"]
    else:
        sources = ["memory"]

    context_str = "\n\n".join(context_parts) if context_parts else "No specific documents available."

    system_prompt = f"""You are MedAI, a compassionate and knowledgeable medical assistant.
You help patients understand their health, medical reports, and conditions.

{state.get('memory_prompt', '')}

CONTEXT FROM DOCUMENTS/WEB:
{context_str}

CRITICAL RULES:
- Always respond in simple, easy-to-understand language
- Never diagnose definitively — always suggest consulting a doctor
- If the user has allergies in their profile, never recommend those medications
- Reference the user's health history naturally when relevant
- Be warm, supportive, and empathetic
- For serious symptoms, always say: "Please consult a doctor immediately"
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=state["query"]),
    ]

    response = llm.invoke(messages)
    answer = response.content

    save_chat_message(state["user_id"], "user", state["query"])
    save_chat_message(state["user_id"], "assistant", answer)

    return {
        "final_answer": answer,
        "sources_used": sources,
    }

# ─────────────────────────────────────────────
# NODE 6: Symptom Checker Flow
# ─────────────────────────────────────────────
def symptom_checker_node(state: MedAIState) -> dict:
    """
    Guided symptom checker. Builds structured context step by step.
    Always ends with: "Please consult a qualified doctor."
    """
    symptom_data = state.get("symptom_data", {})
    step = state.get("symptom_step", 0)
    query = state["query"]

    system = f"""You are a medical symptom assessment assistant.
Guide the user through structured symptom collection.
Current step: {step}
Collected symptoms so far: {symptom_data}

{state.get('memory_prompt', '')}

Steps:
- Step 0: Ask for chief complaint
- Step 1: Ask about associated symptoms (fever, cough, pain, etc.)
- Step 2: Ask about duration and severity (1-10 scale)
- Step 3: Provide analysis and ALWAYS end with: 
  "⚠️ This assessment is for informational purposes only. Please consult a qualified doctor for proper diagnosis and treatment."

Keep responses focused and structured. Ask ONE question at a time."""

    messages = [
        SystemMessage(content=system),
        HumanMessage(content=query),
    ]

    response = llm.invoke(messages)

    return {
        "final_answer": response.content,
        "symptom_step": min(step + 1, 3),
        "sources_used": ["memory"],
    }

# ─────────────────────────────────────────────
# NODE 7: Document Summarizer
# ─────────────────────────────────────────────
def summarize_document_node(state: MedAIState) -> dict:
    """
    Converts complex medical reports into:
    - Simple English
    - Bullet points
    - Key risks highlighted
    """
    doc_text = state.get("document_text", "")
    user_context = state.get("memory_prompt", "")

    if not doc_text:
        docs = search(state["user_id"], "medical report blood test")
        doc_text = "\n\n".join(docs) if docs else ""

    system = f"""You are a medical report simplification expert.
{user_context}

Convert the following medical report into:
1. **Simple Summary** (2-3 lines in plain English, no jargon)
2. **Key Findings** (bullet points)
3. **What's Normal** ✅ (bullet points)
4. **What Needs Attention** ⚠️ (bullet points with risk level: Low/Medium/High)
5. **Recommended Next Steps** (simple action items)

Be warm and reassuring. Avoid causing unnecessary panic."""

    messages = [
        SystemMessage(content=system),
        HumanMessage(content=f"Please summarize this medical document:\n\n{doc_text[:4000]}"),
    ]

    response = llm.invoke(messages)

    save_chat_message(state["user_id"], "user", "Summarize my medical document")
    save_chat_message(state["user_id"], "assistant", response.content)

    return {
        "final_answer": response.content,
        "sources_used": ["rag"],
    }

# ─────────────────────────────────────────────
# ROUTING FUNCTION for Corrective RAG
# ─────────────────────────────────────────────
def route_after_grading(state: MedAIState) -> str:
    """
    Conditional edge: decides whether to use web search or generate directly.
    """
    mode = state.get("mode", "chat")

    if mode == "symptom":
        return "symptom"
    if mode == "summarize":
        return "summarize"

    score = state.get("relevance_score", 0)
    if score < RELEVANCE_THRESHOLD:
        print(f"[Router] Low relevance ({score:.2f}) — routing to web search")
        return "web_search"
    print(f"[Router] Good relevance ({score:.2f}) — generating from RAG")
    return "generate"
