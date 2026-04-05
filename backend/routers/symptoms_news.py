from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from rag.corrective_rag import fetch_medical_news
from memory.user_context import load_user_health_context, build_memory_system_prompt
from config import GROQ_API_KEY, GROQ_MODEL, TAVILY_API_KEY
from db.supabase_client import supabase
from tavily import TavilyClient

llm    = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.4)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

symptom_router = APIRouter(prefix="/symptoms", tags=["Symptoms"])
news_router    = APIRouter(prefix="/news",     tags=["News"])

# ─────────────────────────────────────────────────────────────
# SYMPTOM CHECKER — step-by-step guided flow
# ─────────────────────────────────────────────────────────────

STEP_INSTRUCTIONS = {
    0: """The user just told you their main complaint. 
Respond with empathy, then ask ONE focused question to understand better.
Ask about: location of pain/symptom, or how it started.
Keep response short — 2-3 lines max.""",

    1: """You now know the main complaint and location/onset.
Ask ONE question about duration: "How long have you had this?" 
or severity: "On a scale of 1-10, how severe is it?"
Keep it conversational and caring.""",

    2: """You know the complaint, location, and duration/severity.
Ask about associated symptoms: "Are you experiencing anything else along with this? 
Like fever, nausea, dizziness, or anything else unusual?"
One question only.""",

    3: """You now have enough information to give a proper assessment.
Provide:

**Possible Causes** (2-3 possibilities, NOT a diagnosis):
List the most likely explanations based on what they described.

**What You Can Do Right Now** 🏠:
2-3 practical home care tips.

**Warning Signs to Watch For** ⚠️:
Tell them when they MUST see a doctor immediately.

**Our Recommendation** 🩺:
End with: "Based on what you've described, I'd recommend consulting a doctor for proper diagnosis. This assessment is for informational purposes only."

Be warm, clear, and helpful."""
}

class SymptomRequest(BaseModel):
    user_id:        str
    message:        str
    step:           int = 0
    collected_data: dict = {}

@symptom_router.post("/check")
async def symptom_check(request: SymptomRequest):
    """
    Guided 4-step symptom assessment flow.
    Step 0: Chief complaint
    Step 1: Location / onset  
    Step 2: Duration / severity
    Step 3: Associated symptoms → Full analysis
    Always ends with doctor recommendation.
    """
    # Load user health profile for personalized advice
    health_context = load_user_health_context(request.user_id)
    memory_prompt  = build_memory_system_prompt(health_context)

    step_instruction = STEP_INSTRUCTIONS.get(request.step, STEP_INSTRUCTIONS[3])

    system = f"""You are MedAI, a compassionate medical symptom assessment assistant.
You are conducting a structured symptom assessment — step {request.step} of 3.

{memory_prompt if memory_prompt else ""}

Collected information so far:
{request.collected_data if request.collected_data else "Nothing yet — this is the first message."}

Your task for this step:
{step_instruction}

IMPORTANT RULES:
- Ask only ONE question per response
- Be warm, empathetic, and clear
- Use the user's health profile (conditions, allergies) when giving advice
- Never recommend medications the user is allergic to
- For emergencies (chest pain, can't breathe) say: "Please call emergency services immediately"
- Keep language simple and friendly"""

    try:
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=request.message),
        ])

        next_step  = min(request.step + 1, 3)
        is_complete = request.step >= 3

        return {
            "response":    response.content,
            "next_step":   next_step,
            "is_complete": is_complete,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# MEDICAL NEWS
# ─────────────────────────────────────────────────────────────

@news_router.get("/medical")
async def get_medical_news():
    news = fetch_medical_news()
    return {"news": news, "count": len(news)}

@news_router.get("/personalized/{user_id}")
async def get_personalized_news(user_id: str):
    """Fetches news specifically for each of user's saved conditions."""
    try:
        result = supabase.table("user_health_profiles") \
            .select("conditions, allergies") \
            .eq("user_id", user_id) \
            .maybe_single() \
            .execute()
        profile    = result.data or {}
        conditions = profile.get("conditions", [])
    except Exception as e:
        print(f"[News] Profile load error: {e}")
        conditions = []

    if not conditions:
        return {
            "news":       fetch_medical_news(),
            "conditions": [],
            "note":       "Add conditions in Health Profile for personalized news"
        }

    news_items = []
    seen_urls  = set()

    for condition in conditions[:4]:
        try:
            results = tavily.search(
                query=f"{condition} treatment news research 2025",
                search_depth="advanced",
                max_results=4,
                topic="news",
                include_domains=[
                    "pubmed.ncbi.nlm.nih.gov", "medscape.com", "webmd.com",
                    "healthline.com", "mayoclinic.org", "medicalnewstoday.com",
                    "nih.gov", "who.int", "diabetes.org", "heart.org",
                ]
            )
            for r in results.get("results", []):
                url = r.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                news_items.append({
                    "title":     r.get("title", ""),
                    "content":   r.get("content", "")[:300],
                    "url":       url,
                    "source":    url.split("/")[2].replace("www.", "") if url else "",
                    "condition": condition,
                })
        except Exception as e:
            print(f"[News] Search error for {condition}: {e}")

    return {"news": news_items, "conditions": conditions}
