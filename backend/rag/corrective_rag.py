from langchain_groq import ChatGroq
from langchain.prompts import PromptTemplate
from tavily import TavilyClient
from config import GROQ_API_KEY, TAVILY_API_KEY, GROQ_MODEL, RELEVANCE_THRESHOLD

llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

GRADER_PROMPT = PromptTemplate.from_template("""
You are a document relevance grader for a medical assistant.
Given a user query and a document chunk, return ONLY a float between 0.0 and 1.0
representing how relevant the document is to the query.
1.0 = perfectly relevant, 0.0 = completely irrelevant.

Query: {query}
Document: {document}

Return only the number, nothing else.
""")

def grade_document_relevance(query: str, docs: list[str]) -> float:
    """
    Corrective RAG: Grades retrieved docs for relevance.
    If score < RELEVANCE_THRESHOLD, the graph falls back to web search.
    """
    if not docs:
        return 0.0

    combined = "\n\n".join(docs[:2])
    grader_chain = GRADER_PROMPT | llm
    response = grader_chain.invoke({"query": query, "document": combined[:1000]})

    try:
        score = float(response.content.strip())
        return max(0.0, min(1.0, score))
    except (ValueError, AttributeError):
        return 0.0

def tavily_medical_search(query: str) -> list[str]:
    """
    Fallback web search using Tavily when local docs are not relevant.
    Filters to medical/health domains.
    """
    try:
        results = tavily.search(
            query=f"medical health {query}",
            search_depth="advanced",
            max_results=5,
            include_domains=[
                "pubmed.ncbi.nlm.nih.gov",
                "mayoclinic.org",
                "webmd.com",
                "healthline.com",
                "medlineplus.gov",
                "who.int",
                "cdc.gov",
                "nih.gov"
            ]
        )
        return [r["content"] for r in results.get("results", [])]
    except Exception as e:
        print(f"[Tavily] Search error: {e}")
        return []

def fetch_medical_news() -> list[dict]:
    """
    Fetches current medical news via Tavily for the news panel.
    """
    try:
        results = tavily.search(
            query="latest medical health news 2025",
            search_depth="basic",
            max_results=8,
            topic="news"
        )
        return [
            {
                "title": r.get("title", ""),
                "content": r.get("content", "")[:200],
                "url": r.get("url", ""),
                "source": r.get("url", "").split("/")[2] if r.get("url") else ""
            }
            for r in results.get("results", [])
        ]
    except Exception as e:
        print(f"[Tavily News] Error: {e}")
        return []
