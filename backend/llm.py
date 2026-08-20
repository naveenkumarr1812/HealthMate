import os
from langchain_groq import ChatGroq
from config import GROQ_API_KEYS, GROQ_MODEL, GROQ_FALLBACK_MODELS


def get_llm(temperature: float = 0.4, model: str = None):
    """
    Creates a ChatGroq LLM instance with automatic multi-key and multi-model fallbacks.
    If a key hits a rate limit (429), model 404, or any error, it automatically falls back
    to the next API key and/or fallback model seamlessly.
    """
    target_model = model or GROQ_MODEL
    keys = [k for k in GROQ_API_KEYS if k]

    if not keys:
        raise ValueError("No Groq API keys configured. Set GROQ_API_KEY or GROQ_API_KEYS.")

    llm_instances = []

    # 1. Primary model across all available API keys
    for key in keys:
        try:
            llm_instances.append(
                ChatGroq(model=target_model, api_key=key, temperature=temperature)
            )
        except Exception:
            pass

    # 2. Fallback models across all available API keys
    for fb_model in GROQ_FALLBACK_MODELS:
        if fb_model != target_model:
            for key in keys:
                try:
                    llm_instances.append(
                        ChatGroq(model=fb_model, api_key=key, temperature=temperature)
                    )
                except Exception:
                    pass

    if not llm_instances:
        # Fallback to single instance
        return ChatGroq(model=target_model, api_key=keys[0], temperature=temperature)

    primary = llm_instances[0]
    fallbacks = llm_instances[1:]

    if fallbacks:
        return primary.with_fallbacks(fallbacks)
    return primary
