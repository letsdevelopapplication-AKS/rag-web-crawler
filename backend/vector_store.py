import chromadb


class VectorStore:
    """One persistent Chroma client shared across all tenants; each method
    takes a `collection_name` so every account gets an isolated collection
    (`kb_<account_id>`) within the same persist directory."""

    def __init__(self, persist_dir: str = "./chroma_db"):
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=persist_dir)

    def get_or_create_collection(self, collection_name: str):
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(
        self,
        collection_name: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        ids: list[str],
    ):
        collection = self.get_or_create_collection(collection_name)
        collection.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )

    def query(self, collection_name: str, query_embedding: list[float], n_results: int = 5) -> dict:
        collection = self.get_or_create_collection(collection_name)
        count = collection.count()
        n_results = min(n_results, count) if count > 0 else 1
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
        return results

    def count(self, collection_name: str) -> int:
        try:
            return self.get_or_create_collection(collection_name).count()
        except Exception:
            return 0

    def reset(self, collection_name: str):
        try:
            self.client.delete_collection(collection_name)
        except Exception:
            pass
