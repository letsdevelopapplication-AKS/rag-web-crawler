from openai import OpenAI


def _format_contact(contact_info: dict) -> str:
    parts = []
    if contact_info.get("emails"):
        parts.append("Email: " + ", ".join(contact_info["emails"]))
    if contact_info.get("phones"):
        parts.append("Phone: " + ", ".join(contact_info["phones"]))
    return " | ".join(parts) if parts else ""


class PromptOptimizer:
    def __init__(self, client: OpenAI):
        self.client = client

    def summarize_content(self, texts: list[str]) -> str:
        sample = " ".join(texts[:5])[:3000]
        resp = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": f"Summarize what this website/content is about in 3-4 sentences:\n\n{sample}",
                }
            ],
            max_tokens=200,
        )
        return resp.choices[0].message.content.strip()

    def generate_system_prompt(
        self,
        site_summary: str,
        website_url: str,
        contact_info: dict | None = None,
    ) -> str:
        contact_str = _format_contact(contact_info or {})
        fallback_instruction = (
            f'If the answer is not found in the provided context, respond with: '
            f'"I\'m sorry, I don\'t have that information. Kindly contact us at {contact_str}."'
            if contact_str
            else (
                'If the answer is not found in the provided context, respond with: '
                '"I\'m sorry, I don\'t have that information in the provided data."'
            )
        )

        resp = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert at crafting system prompts for RAG-based chatbots. "
                        "Write a focused, professional prompt — no markdown, no headings."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Generate a system prompt for a chatbot that answers questions strictly "
                        f"about the following website and its attached documents.\n\n"
                        f"Website: {website_url}\n"
                        f"Content summary: {site_summary}\n\n"
                        f"Requirements:\n"
                        f"1. Define the chatbot role and domain based on the site content.\n"
                        f"2. Answer ONLY from the provided context — never from general knowledge.\n"
                        f"3. {fallback_instruction}\n"
                        f"4. Keep a professional, helpful tone.\n\n"
                        f"Return only the system prompt text."
                    ),
                },
            ],
            max_tokens=500,
        )
        return resp.choices[0].message.content.strip()
