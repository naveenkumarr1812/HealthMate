from typing import TypedDict, List, Optional, Annotated
from langgraph.graph.message import add_messages

class MedAIState(TypedDict):
    # Core LangGraph message thread
    messages: Annotated[list, add_messages]

    # Request info
    user_id: str
    query: str
    mode: str  # "chat" | "symptom" | "summarize"

    # RAG pipeline
    retrieved_docs: List[str]
    web_results: List[str]
    relevance_score: float

    # Personalized memory
    user_health_context: dict
    memory_prompt: str

    # Symptom checker state
    symptom_data: Optional[dict]
    symptom_step: int  # 0=complaint, 1=symptoms, 2=duration, 3=severity

    # Document summarizer
    document_text: Optional[str]

    # Final response
    final_answer: str
    sources_used: List[str]  # "rag" | "web" | "memory"
