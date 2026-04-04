from db.supabase_client import supabase
from typing import Optional

def load_user_health_context(user_id: str) -> dict:
    """
    Loads user's complete health profile from Supabase.
    Includes: conditions, allergies, sugar/BP trends, report summaries.
    """
    try:
        result = (
            supabase.table("user_health_profiles")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data or {}
    except Exception as e:
        print(f"[Memory] Failed to load context for {user_id}: {e}")
        return {}

def update_health_context(user_id: str, updates: dict):
    """
    Upserts health context. Called after document upload or when
    LLM extracts new conditions/trends from reports.
    """
    try:
        supabase.table("user_health_profiles").upsert(
            {"user_id": user_id, **updates}
        ).execute()
    except Exception as e:
        print(f"[Memory] Failed to update context for {user_id}: {e}")

def build_memory_system_prompt(context: dict) -> str:
    """
    Builds the personalized system prompt injected into every LLM call.
    This is what makes answers contextual: "Based on your previous reports..."
    """
    if not context:
        return ""

    conditions = ", ".join(context.get("conditions", [])) or "None recorded"
    allergies = ", ".join(context.get("allergies", [])) or "None recorded"
    sugar_trend = context.get("sugar_trend", "Unknown")
    bp_trend = context.get("bp_trend", "Unknown")
    reports_summary = context.get("recent_reports_summary", "No recent reports")

    return f"""
=== PATIENT HEALTH MEMORY ===
Known Conditions: {conditions}
Allergies: {allergies}
Blood Sugar Trend: {sugar_trend}
Blood Pressure Trend: {bp_trend}
Recent Reports Summary: {reports_summary}

IMPORTANT INSTRUCTIONS:
- Always personalize your response based on this health profile.
- If the user's trend is worsening, mention it compassionately.
- Avoid recommending medications the user is allergic to.
- Reference past data naturally: "Based on your previous reports..."
- Always recommend consulting a doctor for serious concerns.
=============================
"""

def extract_and_update_health_info(user_id: str, llm, document_text: str):
    """
    Uses LLM to auto-extract health info from uploaded reports and
    updates the user's health profile in Supabase.
    """
    from langchain.prompts import PromptTemplate
    from langchain_core.output_parsers import JsonOutputParser

    extract_prompt = PromptTemplate.from_template("""
You are a medical data extractor. From the following medical document, extract:
1. conditions (list of diagnosed conditions)
2. allergies (list of allergies mentioned)
3. sugar_trend (one of: "normal", "increasing", "decreasing", "stable", "unknown")
4. bp_trend (one of: "normal", "increasing", "decreasing", "stable", "unknown")
5. recent_reports_summary (2-3 sentence summary in simple English)

Return ONLY valid JSON with these exact keys.

Document:
{text}
""")

    try:
        chain = extract_prompt | llm | JsonOutputParser()
        extracted = chain.invoke({"text": document_text[:3000]})
        update_health_context(user_id, extracted)
        return extracted
    except Exception as e:
        print(f"[Memory] Extraction failed: {e}")
        return {}

def save_chat_message(user_id: str, role: str, content: str):
    """Persists chat history to Supabase."""
    try:
        supabase.table("chat_history").insert({
            "user_id": user_id,
            "role": role,
            "content": content
        }).execute()
    except Exception as e:
        print(f"[Memory] Chat save failed: {e}")

def get_chat_history(user_id: str, limit: int = 10) -> list[dict]:
    """Fetches recent chat history for context."""
    try:
        result = (
            supabase.table("chat_history")
            .select("role, content")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        messages = result.data or []
        return list(reversed(messages))
    except Exception as e:
        print(f"[Memory] Chat fetch failed: {e}")
        return []
