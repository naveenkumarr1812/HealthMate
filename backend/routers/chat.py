from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.graph import compiled_graph
from memory.user_context import get_chat_history

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    user_id:              str
    query:                str
    mode:                 str = "chat"
    symptom_data:         dict = {}
    symptom_step:         int = 0
    long_term_memory:     str = ""
    location_context:     str = ""
    conversation_history: list = []   # last N messages for context

class ChatResponse(BaseModel):
    response:     str
    sources_used: list[str]
    mode:         str

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = await compiled_graph.ainvoke({
            "query":                request.query,
            "user_id":              request.user_id,
            "mode":                 request.mode,
            "symptom_data":         request.symptom_data,
            "symptom_step":         request.symptom_step,
            "long_term_memory":     request.long_term_memory,
            "location_context":     request.location_context,
            "conversation_history": request.conversation_history,
            "messages":             [{"role": "user", "content": request.query}],
            "retrieved_docs":       [],
            "web_results":          [],
            "osm_results":          [],
            "relevance_score":      0.0,
            "user_health_context":  {},
            "memory_prompt":        "",
            "final_answer":         "",
            "sources_used":         [],
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
    messages = get_chat_history(user_id, limit=limit)
    return {"history": messages}
