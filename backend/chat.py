from typing import Generator

from openai import OpenAI


class ChatEngine:
    def __init__(self, client: OpenAI):
        self.client = client

    def embed_query(self, query: str) -> list[float]:
        resp = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=query,
        )
        return resp.data[0].embedding

    def stream_answer(
        self,
        question: str,
        context_chunks: list[str],
        system_prompt: str,
    ) -> Generator[str, None, None]:
        context = "\n\n---\n\n".join(context_chunks)
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Use the following context to answer the question.\n"
                    f"If the answer is not present in the context, respond with: "
                    f"\"I don't have information about that in the provided data.\"\n\n"
                    f"Context:\n{context}\n\n"
                    f"Question: {question}"
                ),
            },
        ]

        stream = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1000,
            stream=True,
        )

        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
