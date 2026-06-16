# Pricing

How the `Free` plan seeded in `backend/models.py` was sized, and what paid
tiers should look like once that flow is validated with real customers.
The only plan wired up to billing today is `Free` (`price_cents = 0`) —
this is the input to the next plan(s), not a finished price list.

> ⚠ The per-token rates below are estimates from when this was written —
> re-check them against [OpenAI's pricing page](https://openai.com/api/pricing/)
> before quoting a customer or setting a real tier price.

## Cost basis

**Hosting (fixed, per-deployment, not per-customer):**
| Item | Cost |
|---|---|
| Render web service (backend) | Free tier sleeps when idle; ~$7/mo "Starter" for always-on + avoids the cold-start re-crawl problem |
| Postgres (accounts/plans) | Free tier on Neon/Render Postgres comfortably covers thousands of accounts |
| Vercel (frontend) | Free tier is sufficient at low-to-moderate traffic |

**OpenAI (variable, scales with usage):**
- One-time per registration: crawling + embedding a typical site (~50 pages, `text-embedding-3-small`) costs a fraction of a cent — negligible.
- Per conversation: each `/api/chat` call sends ~5 retrieved chunks + the system prompt as context (roughly 5,000–6,000 input tokens) to `gpt-4o` and gets back a few hundred output tokens. At illustrative `gpt-4o` rates (~$2.50/1M input, ~$10/1M output tokens), that's **roughly $0.015–0.02 per conversation**.
- The Free plan's 500-conversation/month cap (`models.py`) bounds worst-case OpenAI exposure on an unpaid account to roughly **$7–10/month** — this cap exists specifically so Free accounts can't run up an unbounded bill.

## Suggested paid tiers (for when `process_payment` grows real Stripe handling)

These are starting points, not commitments — refine once actual conversation volume per customer is known from the Free-plan pilot.

| Plan | Price | Conversations/mo | Notes |
|---|---|---|---|
| Free | $0 | 500 | Today's only active plan — for validating the funnel |
| Starter | ~$29/mo | 2,000 | Single website, covers cost (~$30-40 worst-case OpenAI) at typical (non-worst-case) usage + thin margin |
| Growth | ~$79/mo | 8,000 | Multiple websites, healthier margin once usage is below the cap most months |
| Pro | ~$199/mo | 25,000 | Priority support, higher limits |

Price each tier so the conversation cap's worst-case OpenAI cost stays comfortably under the price — actual usage is typically well under the cap, which is where the margin comes from.

## Business benefits (the pitch)

- **24/7 instant answers** — no waiting on a support queue for things already documented on the site.
- **Deflects support load** — per `PITCH.md`, 40–60% of tickets are already answered somewhere on the company's own website; this surfaces that content directly.
- **Bilingual reach** — English + Hindi voice and text out of the box, no extra integration work.
- **Zero engineering effort** — one `<iframe>` snippet (see the Dashboard's "Embed on your site" card) and it's live; no SDK, no backend work on the customer's side.
- **Self-updating** — a "Re-crawl" re-indexes the site whenever content changes, no manual content upload required.
