from langgraph.graph import StateGraph, END
from agents.state import MedAIState
from agents.nodes import (
    load_user_memory,
    retrieve_docs,
    grade_documents,
    web_search_node,
    generate_answer,
    symptom_checker_node,
    summarize_document_node,
    route_after_grading,
)

def build_graph():
    """
    MedAI LangGraph workflow:

    load_memory
        ↓
    retrieve_docs
        ↓
    grade_documents
        ↓ (conditional)
    ┌──────────────────────────────────────────┐
    │ web_search → generate    (low relevance) │
    │ generate                 (high relevance)│
    │ symptom_checker          (symptom mode)  │
    │ summarize_document       (summarize mode)│
    └──────────────────────────────────────────┘
        ↓
       END
    """
    graph = StateGraph(MedAIState)

    # Register all nodes
    graph.add_node("load_memory", load_user_memory)
    graph.add_node("retrieve", retrieve_docs)
    graph.add_node("grade_docs", grade_documents)
    graph.add_node("web_search", web_search_node)
    graph.add_node("generate", generate_answer)
    graph.add_node("symptom", symptom_checker_node)
    graph.add_node("summarize", summarize_document_node)

    # Entry point
    graph.set_entry_point("load_memory")

    # Linear edges
    graph.add_edge("load_memory", "retrieve")
    graph.add_edge("retrieve", "grade_docs")

    # Conditional routing after grading
    graph.add_conditional_edges(
        "grade_docs",
        route_after_grading,
        {
            "web_search": "web_search",
            "generate": "generate",
            "symptom": "symptom",
            "summarize": "summarize",
        },
    )

    # All paths lead to END
    graph.add_edge("web_search", "generate")
    graph.add_edge("generate", END)
    graph.add_edge("symptom", END)
    graph.add_edge("summarize", END)

    return graph.compile()


# Singleton compiled graph
compiled_graph = build_graph()
