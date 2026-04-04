from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.graph import compiled_graph
from memory.user_context import get_chat_history

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    user_id: str
    query: str
    mode: str = "chat"  # "chat" | "symptom" | "summarize"
    symptom_data: dict = {}
    symptom_step: int = 0

class ChatResponse(BaseModel):
    response: str
    sources_used: list[str]
    mode: str

@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    Main chat endpoint. Routes through LangGraph:
    - Free chat: RAG → Corrective RAG → Tavily fallback
    - Symptom mode: Guided structured flow
    - Summarize mode: Document simplification
    """
    try:
        result = compiled_graph.invoke({
            "query": request.query,
            "user_id": request.user_id,
            "mode": request.mode,
            "symptom_data": request.symptom_data,
            "symptom_step": request.symptom_step,
            "messages": [{"role": "user", "content": request.query}],
            "retrieved_docs": [],
            "web_results": [],
            "relevance_score": 0.0,
            "user_health_context": {},
            "memory_prompt": "",
            "final_answer": "",
            "sources_used": [],
        })

        return ChatResponse(
            response=result["final_answer"],
            sources_used=result.get("sources_used", []),
            mode=request.mode,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}")
async def get_history(user_id: str, limit: int = 20):
    """Returns past chat messages for a user."""
    messages = get_chat_history(user_id, limit=limit)
    return {"history": messages}
