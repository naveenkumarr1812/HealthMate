from langgraph.graph import StateGraph, END
from agents.state import HealthMateState
from agents.nodes import (
    load_user_memory,
    retrieve_docs,
    grade_documents,
    web_search_node,
    generate_answer,
    location_search_node,
    summarize_document_node,
    route_after_grading,
)

def build_graph():
    graph = StateGraph(HealthMateState)

    graph.add_node("load_memory",     load_user_memory)
    graph.add_node("retrieve",        retrieve_docs)
    graph.add_node("grade_docs",      grade_documents)
    graph.add_node("web_search",      web_search_node)
    graph.add_node("location_search", location_search_node)
    graph.add_node("generate",        generate_answer)
    graph.add_node("summarize",       summarize_document_node)

    graph.set_entry_point("load_memory")
    graph.add_edge("load_memory", "retrieve")
    graph.add_edge("retrieve",    "grade_docs")

    graph.add_conditional_edges(
        "grade_docs",
        route_after_grading,
        {
            "web_search":      "web_search",
            "location_search": "location_search",
            "generate":        "generate",
            "summarize":       "summarize",
        },
    )

    graph.add_edge("web_search",      "generate")
    graph.add_edge("location_search", "generate")
    graph.add_edge("generate",        END)
    graph.add_edge("summarize",       END)

    return graph.compile()

compiled_graph = build_graph()
