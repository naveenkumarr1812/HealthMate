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

def sync_local_to_supabase(user_id: str, index_file: Path, meta_file: Path):
    """Uploads the local FAISS files to Supabase Storage."""
    try:
        import io
        from db.supabase_client import supabase
        bucket = "medical-documents"

        if index_file.exists():
            with open(index_file, "rb") as f:
                index_data = f.read()
            supabase.storage.from_(bucket).upload(
                path=f"_faiss/{user_id}/index.faiss",
                file=io.BytesIO(index_data),
                file_options={"upsert": "true"}
            )

        if meta_file.exists():
            with open(meta_file, "rb") as f:
                meta_data = f.read()
            supabase.storage.from_(bucket).upload(
                path=f"_faiss/{user_id}/metadata.pkl",
                file=io.BytesIO(meta_data),
                file_options={"upsert": "true"}
            )
        print(f"[VectorStore] Synced FAISS index to Supabase Storage for user {user_id}")
    except Exception as e:
        print(f"[VectorStore] Failed to sync FAISS index to Supabase Storage: {e}")

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

    # Make sure we have the latest index from Supabase before adding
    if not index_file.exists():
        download_index_from_supabase(user_id, index_file, meta_file)

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
    
    # Sync the updated files to Supabase
    sync_local_to_supabase(user_id, index_file, meta_file)

def download_index_from_supabase(user_id: str, index_file: Path, meta_file: Path) -> bool:
    """Downloads the FAISS files from Supabase Storage to the local path."""
    try:
        from db.supabase_client import supabase
        bucket = "medical-documents"
        print(f"[VectorStore] Downloading index from Supabase Storage for user {user_id}...")
        
        index_data = supabase.storage.from_(bucket).download(f"_faiss/{user_id}/index.faiss")
        meta_data = supabase.storage.from_(bucket).download(f"_faiss/{user_id}/metadata.pkl")
        
        with open(index_file, "wb") as f:
            f.write(index_data)
        with open(meta_file, "wb") as f:
            f.write(meta_data)
        print(f"[VectorStore] Successfully downloaded FAISS index for user {user_id}")
        return True
    except Exception as e:
        # Ignore if file not found in Supabase (expected for new users)
        print(f"[VectorStore] No FAISS index found in Supabase Storage for user {user_id} (or error occurred): {e}")
        return False

def search(user_id: str, query: str, k: int = TOP_K_DOCS) -> list[str]:
    """
    Searches the user's FAISS index for relevant document chunks.
    Returns list of matching text chunks.
    """
    path = get_user_index_path(user_id)
    index_file = path / "index.faiss"
    meta_file = path / "metadata.pkl"

    if not index_file.exists():
        download_index_from_supabase(user_id, index_file, meta_file)

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
        print(f"[VectorStore] Deleted local index for user {user_id}")
        
    try:
        from db.supabase_client import supabase
        bucket = "medical-documents"
        supabase.storage.from_(bucket).remove([
            f"_faiss/{user_id}/index.faiss",
            f"_faiss/{user_id}/metadata.pkl"
        ])
        print(f"[VectorStore] Deleted index in Supabase Storage for user {user_id}")
    except Exception as e:
        print(f"[VectorStore] Error deleting Supabase Storage index files for user {user_id}: {e}")
