from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from rag.corrective_rag import fetch_medical_news
from memory.user_context import load_user_health_context, build_memory_system_prompt
from config import GROQ_API_KEY, GROQ_MODEL

llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.4)

# ─────────────────────────────────────────────────
# SYMPTOM CHECKER ROUTER
# ─────────────────────────────────────────────────
symptom_router = APIRouter(prefix="/symptoms", tags=["Symptoms"])

SYMPTOM_STEPS = {
    0: "Ask for the user's main complaint. Be gentle and empathetic.",
    1: "Ask about associated symptoms: fever, cough, body ache, nausea, dizziness, fatigue, shortness of breath. Let them pick multiple.",
    2: "Ask how long the symptoms have lasted and rate severity from 1-10.",
    3: """Provide a structured assessment:
- Possible causes (2-3 differential possibilities, NOT diagnoses)
- Immediate care tips
- Red flags to watch for
- ALWAYS end with: "⚠️ This is not a medical diagnosis. Please consult a qualified doctor for proper evaluation and treatment. If you experience severe symptoms, seek emergency care immediately."
""",
}

class SymptomRequest(BaseModel):
    user_id: str
    message: str
    step: int = 0
    collected_data: dict = {}

@symptom_router.post("/check")
async def symptom_check(request: SymptomRequest):
    """
    Guided symptom collection flow.
    Step 0: Chief complaint → Step 1: Symptoms → Step 2: Duration → Step 3: Analysis
    Always ends with doctor referral.
    """
    health_context = load_user_health_context(request.user_id)
    memory_prompt = build_memory_system_prompt(health_context)

    step_instruction = SYMPTOM_STEPS.get(request.step, SYMPTOM_STEPS[3])

    system = f"""You are a compassionate medical symptom assessment assistant.
{memory_prompt}

Current assessment step {request.step}/3:
{step_instruction}

Collected information so far: {request.collected_data}

Keep your response focused, warm, and easy to understand.
Ask ONE question at a time. Be supportive."""

    try:
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=request.message),
        ])
        next_step = min(request.step + 1, 3)
        return {
            "response": response.content,
            "next_step": next_step,
            "is_complete": request.step >= 3,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────
# MEDICAL NEWS ROUTER
# ─────────────────────────────────────────────────
news_router = APIRouter(prefix="/news", tags=["News"])

@news_router.get("/medical")
async def get_medical_news():
    """
    Fetches latest medical news via Tavily.
    Used for the news panel in the sidebar.
    """
    news = fetch_medical_news()
    return {"news": news, "count": len(news)}

@news_router.get("/personalized/{user_id}")
async def get_personalized_news(user_id: str):
    """
    Fetches news relevant to the user's health conditions.
    e.g., diabetes patient gets diabetes-specific news.
    """
    context = load_user_health_context(user_id)
    conditions = context.get("conditions", [])

    from rag.corrective_rag import tavily
    news_items = []

    try:
        if conditions:
            query = f"latest research treatment {' '.join(conditions[:2])} 2025"
        else:
            query = "latest medical health news 2025"

        results = tavily.search(
            query=query,
            search_depth="basic",
            max_results=6,
            topic="news",
        )
        news_items = [
            {
                "title": r.get("title", ""),
                "content": r.get("content", "")[:250],
                "url": r.get("url", ""),
                "source": r.get("url", "").split("/")[2] if r.get("url") else "",
            }
            for r in results.get("results", [])
        ]
    except Exception as e:
        print(f"[News] Personalized fetch error: {e}")

    return {"news": news_items, "conditions": conditions}
