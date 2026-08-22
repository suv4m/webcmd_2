# ResearchScout

ResearchScout is a hackathon MVP for a **self-learning research-paper browser**. Enter a research idea and it discovers matching OpenAlex papers, showing their publication year, venue, authors, citation count, abstract, and source link.

It is now a React + Vite frontend with an Express backend. The backend calls OpenAlex's public API, stores feedback in `server/data/feedback.json`, and applies that feedback when ranking later searches.

## Run locally

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The frontend proxies `/api` requests to the Express API at port 3001.

## Webcmd command

The reusable Webcmd source lives at `webcmd/openalex/search-papers.js`.

**Strategy note**

- Strategy: `PUBLIC_API` / `Strategy.PUBLIC`
- Contract: stable public API
- Evidence: `GET https://api.openalex.org/works?search=...` returned JSON containing `title`, `publication_year`, `authorships`, `primary_location`, and `cited_by_count` on 2026-08-22.
- Authentication: none.
- Why not browser scraping: the public API provides every required field, so UI selectors would add fragility without benefit.

Once the local Webcmd CLI is installed, place this command in the adapter location returned by `webcmd adapter path openalex/search-papers`, then run:

```powershell
webcmd openalex search-papers --query "LLMs for disease detection" --limit 10
```

## Learning loop

- **Save** adds the paper's title/abstract tokens to a positive profile.
- **Not relevant** adds them to a negative profile.
- On the next search, matching positive terms boost a result; matching negative terms reduce it.
- The initial score combines query-token overlap, citations, and recency.

This is intentionally transparent and local for a hackathon. Replacing the local profile with SQLite/Postgres and embeddings is the straightforward production path.

## Add sources next

Normalize each source into the same shape before merging and deduplicating by DOI/title:

`title`, `year`, `authors`, `venue`, `url`, `abstract`, `citations`, `source`.

Good next adapters: arXiv, Crossref, PubMed, then Semantic Scholar if its API access is configured.
