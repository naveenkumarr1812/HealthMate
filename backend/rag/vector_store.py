import faiss
import pickle
import numpy as np
from pathlib import Path
from fastembed import TextEmbedding
from config import FAISS_DIR, EMBED_MODEL, TOP_K_DOCS

embedder = TextEmbedding(model_name=EMBED_MODEL)

def get_user_index_path(user_id: str) -> Path:
    path = Path(FAISS_DIR) / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path

def add_document(user_id: str, chunks: list[str], metadata: list[dict]):
    """
    Instantly embeds chunks using FastEmbed and saves to user-specific FAISS index.
    Called immediately on document upload - persistent across sessions.
    """
    if not chunks:
        return

    path = get_user_index_path(user_id)
    index_file = path / "index.faiss"
    meta_file = path / "metadata.pkl"

    vectors = list(embedder.embed(chunks))
    dim = len(vectors[0])
    matrix = np.array(vectors, dtype=np.float32)

    if index_file.exists():
        index = faiss.read_index(str(index_file))
        with open(meta_file, "rb") as f:
            existing_meta = pickle.load(f)
    else:
        index = faiss.IndexFlatL2(dim)
        existing_meta = []

    index.add(matrix)
    existing_meta.extend(metadata)

    faiss.write_index(index, str(index_file))
    with open(meta_file, "wb") as f:
        pickle.dump(existing_meta, f)

    print(f"[VectorStore] Indexed {len(chunks)} chunks for user {user_id}")

def search(user_id: str, query: str, k: int = TOP_K_DOCS) -> list[str]:
    """
    Searches the user's FAISS index for relevant document chunks.
    Returns list of matching text chunks.
    """
    path = get_user_index_path(user_id)
    index_file = path / "index.faiss"
    meta_file = path / "metadata.pkl"

    if not index_file.exists():
        return []

    index = faiss.read_index(str(index_file))
    with open(meta_file, "rb") as f:
        meta = pickle.load(f)

    q_vec = list(embedder.embed([query]))
    q_matrix = np.array(q_vec, dtype=np.float32)

    distances, indices = index.search(q_matrix, k)

    results = []
    for i in indices[0]:
        if i != -1 and i < len(meta):
            results.append(meta[i]["text"])

    return results

def delete_user_index(user_id: str):
    """Deletes all FAISS data for a user (on account deletion)."""
    import shutil
    path = get_user_index_path(user_id)
    if path.exists():
        shutil.rmtree(path)
        print(f"[VectorStore] Deleted index for user {user_id}")
