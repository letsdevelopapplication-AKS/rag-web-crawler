import re
import time
from typing import Generator
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Keywords that suggest a contact page
_CONTACT_KEYWORDS = {"contact", "about", "support", "help", "reach", "touch", "enquiry", "inquiry"}

# Regex patterns
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(
    r"(\+?\d{1,3}[\s\-.]?)?(\(?\d{2,4}\)?[\s\-.]?)(\d{3,4}[\s\-.]?\d{3,4})"
)
# Domains to exclude from extracted emails (noise)
_EMAIL_BLOCKLIST = {"example.com", "sentry.io", "schema.org", "w3.org", "google.com"}


def extract_contact_info(pages: list[dict]) -> dict:
    """Scan crawled pages for emails and phone numbers.

    Prioritises pages whose URL contains a contact-related keyword.
    Falls back to scanning all pages if none are found.
    """
    contact_pages = [
        p for p in pages
        if any(kw in p["url"].lower() for kw in _CONTACT_KEYWORDS)
    ]
    search_scope = contact_pages if contact_pages else pages

    emails: set[str] = set()
    phones: set[str] = set()

    for page in search_scope:
        text = page["text"]
        for email in _EMAIL_RE.findall(text):
            domain = email.split("@")[-1].lower()
            if domain not in _EMAIL_BLOCKLIST:
                emails.add(email.lower())
        for match in _PHONE_RE.finditer(text):
            phone = match.group().strip()
            if len(re.sub(r"\D", "", phone)) >= 7:   # at least 7 digits
                phones.add(phone)

    return {
        "emails": list(emails)[:3],
        "phones": list(phones)[:3],
    }


class WebCrawler:
    def __init__(self, max_pages: int = 50):
        self.max_pages = max_pages
        self.visited: set[str] = set()
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (compatible; RAGCrawler/1.0)"}
        )

    def _same_domain(self, base_url: str, url: str) -> bool:
        return urlparse(base_url).netloc == urlparse(url).netloc

    def _extract_text(self, soup: BeautifulSoup) -> str:
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        lines = [line.strip() for line in soup.get_text(separator=" ").splitlines() if line.strip()]
        return " ".join(lines)

    def _get_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        links = []
        for a in soup.find_all("a", href=True):
            full = urljoin(base_url, a["href"]).split("#")[0].rstrip("/")
            if self._same_domain(base_url, full) and full not in self.visited:
                links.append(full)
        return list(set(links))

    def crawl(self, start_url: str) -> Generator[dict, None, None]:
        if not start_url.startswith(("http://", "https://")):
            start_url = "https://" + start_url

        # ── Seed: collect ALL links from the home page first ──────────────
        home_links = self._seed_from_home(start_url)
        queue = [start_url] + home_links
        self.visited = set()

        while queue and len(self.visited) < self.max_pages:
            url = queue.pop(0)
            if url in self.visited:
                continue

            try:
                resp = self.session.get(url, timeout=10, allow_redirects=True)
                if resp.status_code != 200:
                    continue
                if "text/html" not in resp.headers.get("content-type", ""):
                    continue

                self.visited.add(url)
                soup = BeautifulSoup(resp.content, "lxml")
                text = self._extract_text(soup)
                title = soup.title.string.strip() if soup.title and soup.title.string else url

                if text:
                    yield {"url": url, "title": title, "text": text}

                # Continue discovering deeper links
                queue.extend(l for l in self._get_links(soup, start_url) if l not in self.visited)
                time.sleep(0.3)

            except Exception as exc:
                print(f"[crawler] skipping {url}: {exc}")

    def _seed_from_home(self, start_url: str) -> list[str]:
        """Fetch the home page and return all internal links found on it."""
        try:
            resp = self.session.get(start_url, timeout=10, allow_redirects=True)
            soup = BeautifulSoup(resp.content, "lxml")
            links = []
            for a in soup.find_all("a", href=True):
                full = urljoin(start_url, a["href"]).split("#")[0].rstrip("/")
                if self._same_domain(start_url, full) and full != start_url.rstrip("/"):
                    links.append(full)
            return list(dict.fromkeys(links))   # deduplicate, preserve order
        except Exception:
            return []
