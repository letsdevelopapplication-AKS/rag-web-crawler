import io

from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI


class DocumentProcessor:
    def __init__(self, openai_client: OpenAI, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.client = openai_client
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

    def extract_text_from_file(self, file_content: bytes, filename: str) -> str:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext == "pdf":
            return self._from_pdf(file_content)
        elif ext in ("docx", "doc"):
            return self._from_docx(file_content)
        return file_content.decode("utf-8", errors="ignore")

    def _from_pdf(self, content: bytes) -> str:
        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(content))
        return " ".join(page.extract_text() or "" for page in reader.pages)

    def _from_docx(self, content: bytes) -> str:
        from docx import Document

        doc = Document(io.BytesIO(content))
        return " ".join(p.text for p in doc.paragraphs if p.text)

    def chunk_text(self, text: str, metadata: dict) -> list[dict]:
        return [{"text": chunk, "metadata": metadata} for chunk in self.splitter.split_text(text)]

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        # Batch into groups of 100 to stay within API limits
        all_embeddings = []
        for i in range(0, len(texts), 100):
            batch = texts[i : i + 100]
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=batch,
            )
            all_embeddings.extend(item.embedding for item in response.data)
        return all_embeddings
