import json
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import GROQ_API_KEY, GROQ_MODEL, RELEVANCE_THRESHOLD
from rag.vector_store import search
from rag.corrective_rag import grade_document_relevance, tavily_medical_search
from memory.user_context import (
    load_user_health_context,
    build_memory_system_prompt,
    save_chat_message,
)
from routers.search import search_nearby_places, duckduckgo_medical_search
from agents.state import HealthMateState
import asyncio

llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.4)
llm_precise = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.1)

# ─────────────────────────────────────────────
# NODE 1: Load User Memory
# ─────────────────────────────────────────────
def load_user_memory(state: HealthMateState) -> dict:
    context       = load_user_health_context(state["user_id"])
    memory_prompt = build_memory_system_prompt(context)
    return {"user_health_context": context, "memory_prompt": memory_prompt}

# ─────────────────────────────────────────────
# NODE 2: Retrieve Documents
# ─────────────────────────────────────────────
def retrieve_docs(state: HealthMateState) -> dict:
    docs = search(state["user_id"], state["query"])
    return {"retrieved_docs": docs}

# ─────────────────────────────────────────────
# NODE 3: Grade Relevance
# ─────────────────────────────────────────────
def grade_documents(state: HealthMateState) -> dict:
    score = grade_document_relevance(state["query"], state["retrieved_docs"])
    return {"relevance_score": score}

# ─────────────────────────────────────────────
# NODE 4: Web Search (Tavily + DuckDuckGo fallback)
# ─────────────────────────────────────────────
def web_search_node(state: HealthMateState) -> dict:
    query   = state["query"]
    results = tavily_medical_search(query)

    # If Tavily gives nothing, fall back to DuckDuckGo (free)
    if not results:
        try:
            loop    = asyncio.new_event_loop()
            results = loop.run_until_complete(duckduckgo_medical_search(query))
            loop.close()
        except Exception:
            pass

    return {"web_results": results, "sources_used": ["web"]}

# ─────────────────────────────────────────────
# NODE 5: Generate Answer - handles everything
# ─────────────────────────────────────────────
def generate_answer(state: HealthMateState) -> dict:
    query         = state["query"]
    memory_prompt = state.get("memory_prompt", "")
    long_term_mem = state.get("long_term_memory", "")
    location_ctx  = state.get("location_context", "")
    osm_results   = state.get("osm_results", [])   # real nearby places
    conv_history  = state.get("conversation_history", [])

    # Build RAG/web context
    context_parts = []
    sources = ["memory"]
    if state.get("retrieved_docs") and state.get("relevance_score", 0) >= RELEVANCE_THRESHOLD:
        context_parts.append("FROM YOUR UPLOADED DOCUMENTS:\n" + "\n\n".join(state["retrieved_docs"]))
        sources = ["rag"]
    elif state.get("web_results"):
        context_parts.append("FROM WEB SEARCH:\n" + "\n\n".join(state["web_results"][:4]))
        sources = ["web"]
    context_str = "\n\n".join(context_parts)

    # Format real OSM results if available
    nearby_str = ""
    if osm_results:
        lines = []
        for i, p in enumerate(osm_results[:8], 1):
            phone  = (" · 📞 " + p["phone"])    if p.get("phone")    else ""
            addr   = (" · 📍 " + p["address"])   if p.get("address")  else ""
            dist   = (" (" + str(p["dist_km"]) + " km away)") if p.get("dist_km") else ""
            maps   = ("\n   🗺️ [Open in Google Maps](" + p["maps_url"] + ")") if p.get("maps_url") else ""
            emerg  = " 🚨 Has Emergency" if p.get("emergency") == "yes" else ""
            lines.append(str(i) + ". **" + p["name"] + "**" + dist + " - " + p["type"] + emerg + phone + addr + maps)
        nearby_str = "\n".join(lines)

    # Build hospital section separately to avoid nested f-string
    if nearby_str:
        hospital_section = (
            "━━━ HOSPITAL/DOCTOR SEARCH ━━━\n"
            "REAL NEARBY FACILITIES FOUND (from OpenStreetMap):\n"
            + nearby_str +
            "\n\nPresent these as a clean numbered list. Tell user they can click Google Maps links "
            "for directions, reviews, and phone numbers. For specialists, add what to look for when choosing."
        )
    else:
        hospital_section = (
            "━━━ HOSPITAL/DOCTOR SEARCH ━━━\n"
            "No real-time location data available. Give general guidance on how to find "
            "hospitals/doctors and what to look for. Ask user to share their city/area."
        )

    profile_section  = memory_prompt  if memory_prompt  else "No profile loaded yet."
    memory_section   = long_term_mem  if long_term_mem  else "No previous sessions remembered yet."
    context_section  = context_str    if context_str    else "No documents or web results for this query."

    system_prompt = f"""You are HealthMate - an intelligent, warm medical assistant. Think of yourself as a brilliant doctor friend.

━━━ CONVERSATION STYLE ━━━
- Match energy: "hi" → casual reply. Medical question → thorough reply.
- Never dump health info unless directly relevant.
- Be conversational, warm, never robotic.
- Use markdown: **bold** for important things, bullet points for lists.
- For symptoms: ask ONE clarifying question at a time before giving advice.
- Offer structured choices when helpful, like:
  "Which describes it better?
  🅐 Sharp sudden pain
  🅑 Dull constant ache
  🅒 Throbbing pain"

━━━ SYMPTOM ASSESSMENT ━━━
When user mentions ANY symptom:
1. Acknowledge with empathy first
2. Ask ONE focused follow-up: duration, severity (1-10), location, triggers
3. After 2-3 exchanges, provide:
   - 🔍 Possible causes (2-3, not diagnosis)
   - 🏠 Home care tips right now
   - ⚠️ Warning signs to watch for
   - 🩺 "Please see a doctor if..." guidance
4. Consider their health profile for personalized advice
5. Never say "I can't diagnose" - just be clear it's guidance not diagnosis

{hospital_section}

━━━ DOCUMENT SUMMARIZATION ━━━
If user shares medical text → immediately summarize as:
**Simple Summary:** (plain English)
**Key Findings:** (bullets)
**What's Good ✅** / **What Needs Attention ⚠️** (with Low/Medium/High risk)
**Next Steps:** (actionable)

━━━ USER PROFILE ━━━
{profile_section}

━━━ LONG-TERM MEMORY ━━━
{memory_section}

━━━ DOCUMENT/WEB CONTEXT ━━━
{context_section}

━━━ RULES ━━━
- Never definitively diagnose
- Never suggest medications the user is allergic to
- For chest pain / can't breathe / severe bleeding → "🚨 Call emergency services immediately"
- Keep conversation flowing naturally - remember what was said earlier in this conversation
- After answering, sometimes ask a relevant follow-up: "Does that help? Any other symptoms?"
"""

    # Build full conversation for context (last 12 messages)
    chat_messages = [SystemMessage(content=system_prompt)]
    if conv_history:
        for msg in conv_history[-12:]:
            if msg.get("role") == "user":
                chat_messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                from langchain_core.messages import AIMessage
                chat_messages.append(AIMessage(content=msg["content"]))
    chat_messages.append(HumanMessage(content=query))

    response = llm.invoke(chat_messages)
    answer   = response.content

    save_chat_message(state["user_id"], "user",      query)
    save_chat_message(state["user_id"], "assistant", answer)

    return {"final_answer": answer, "sources_used": sources}

# ─────────────────────────────────────────────
# NODE 6: Location Search (OSM)
# ─────────────────────────────────────────────
def location_search_node(state: HealthMateState) -> dict:
    """Fetches REAL nearby hospitals using OpenStreetMap - free, no API key."""
    location_ctx = state.get("location_context", "")
    if not location_ctx:
        return {"osm_results": []}

    # Parse coordinates from location context
    try:
        import re
        lat_match = re.search(r"lat=([\-\d.]+)", location_ctx)
        lng_match = re.search(r"lng=([\-\d.]+)", location_ctx)
        if not lat_match or not lng_match:
            return {"osm_results": []}
        lat = float(lat_match.group(1))
        lng = float(lng_match.group(1))

        # Determine what type of place to search
        query_lower = state["query"].lower()
        search_type = "hospital"
        if any(w in query_lower for w in ["pharmacy","medicine","drug"]):
            search_type = "pharmacy"
        elif any(w in query_lower for w in ["clinic","general","gp","doctor"]):
            search_type = "clinic"

        loop    = asyncio.new_event_loop()
        results = loop.run_until_complete(search_nearby_places(search_type, lat, lng, radius_km=15))
        loop.close()
        return {"osm_results": results}
    except Exception as e:
        print(f"[Location] Error: {e}")
        return {"osm_results": []}

# ─────────────────────────────────────────────
# NODE 7: Summarizer
# ─────────────────────────────────────────────
def summarize_document_node(state: HealthMateState) -> dict:
    doc_text     = state.get("document_text", "")
    user_context = state.get("memory_prompt", "")

    if not doc_text:
        docs     = search(state["user_id"], "medical report blood test")
        doc_text = "\n\n".join(docs) if docs else ""

    system = f"""You are a medical report simplification expert.
{user_context}
Convert the report into:
## Simple Summary
(2-3 lines, plain English)
## Key Findings
(bullets)
## What's Normal ✅ / What Needs Attention ⚠️
(with risk level: Low / Medium / High)
## Next Steps
(simple actionable items)
Be warm, reassuring."""

    response = llm_precise.invoke([
        SystemMessage(content=system),
        HumanMessage(content=f"Summarize:\n\n{doc_text[:4000]}"),
    ])

    save_chat_message(state["user_id"], "user",      "Summarize my medical document")
    save_chat_message(state["user_id"], "assistant", response.content)

    return {"final_answer": response.content, "sources_used": ["rag"]}

# ─────────────────────────────────────────────
# ROUTING
# ─────────────────────────────────────────────
def route_after_grading(state: HealthMateState) -> str:
    mode  = state.get("mode", "chat")
    score = state.get("relevance_score", 0)

    if mode == "summarize":
        return "summarize"
    if state.get("location_context"):
        return "location_search"
    if score < RELEVANCE_THRESHOLD:
        return "web_search"
    return "generate"