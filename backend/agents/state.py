from typing import TypedDict, List, Optional, Annotated
from langgraph.graph.message import add_messages

class HealthMateState(TypedDict):
    messages:             Annotated[list, add_messages]
    user_id:              str
    query:                str
    mode:                 str
    retrieved_docs:       List[str]
    web_results:          List[str]
    relevance_score:      float
    user_health_context:  dict
    memory_prompt:        str
    long_term_memory:     str
    location_context:     str
    osm_results:          List[dict]
    conversation_history: List[dict]
    symptom_data:         Optional[dict]
    symptom_step:         int
    document_text:        Optional[str]
    final_answer:         str
    sources_used:         List[str]
