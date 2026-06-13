import chromadb
import os


class VectorStore:
    def __init__(self, persist_dir: str = "./chroma_db"):
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection_name = "knowledge_base"

    def get_or_create_collection(self):
        return self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(
        self,
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        ids: list[str],
    ):
        collection = self.get_or_create_collection()
        collection.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )

    def query(self, query_embedding: list[float], n_results: int = 5) -> dict:
        collection = self.get_or_create_collection()
        count = collection.count()
        n_results = min(n_results, count) if count > 0 else 1
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
        return results

    def count(self) -> int:
        try:
            return self.get_or_create_collection().count()
        except Exception:
            return 0

    def reset(self):
        try:
            self.client.delete_collection(self.collection_name)
        except Exception:
            pass
