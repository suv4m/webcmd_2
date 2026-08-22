import express from 'express';
import cors from 'cors';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express(); const port = process.env.PORT || 3001;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const feedbackDir = path.join(root, 'server', 'data'); const feedbackFile = path.join(feedbackDir, 'feedback.json');
const stopWords = new Set('a an and are as at be by for from how in is it of on or that the to using with'.split(' '));
const tokens = text => [...new Set(String(text || '').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(word => !stopWords.has(word)) || [])];

app.use(cors()); app.use(express.json({ limit: '100kb' }));

async function profile() { if (!existsSync(feedbackFile)) return { positive: {}, negative: {} }; try { return JSON.parse(await readFile(feedbackFile, 'utf8')); } catch { return { positive: {}, negative: {} }; } }
async function saveProfile(data) { await mkdir(feedbackDir, { recursive: true }); const temp = `${feedbackFile}.tmp`; await writeFile(temp, JSON.stringify(data, null, 2)); await rename(temp, feedbackFile); }
function abstractFromIndex(index) { if (!index || typeof index !== 'object') return ''; const words = []; for (const [word, positions] of Object.entries(index)) if (Array.isArray(positions)) for (const position of positions) words[position] = word; return words.join(' '); }
function indiaContext(work, abstract) {
  const institutions = (work.authorships || []).flatMap(item => item.institutions || []);
  const indianAffiliations = institutions.filter(institution => institution.country_code === 'IN' || /\b(india|indian)\b/i.test(institution.display_name || '')).length;
  const mentionsIndia = /\b(india|indian)\b/i.test(`${work.title || ''} ${abstract}`);
  const score = indianAffiliations * 3 + (mentionsIndia ? 1 : 0);
  return { score, label: indianAffiliations ? 'Indian affiliation' : mentionsIndia ? 'India mentioned' : '' };
}
function normalize(work) {
  const abstract = abstractFromIndex(work.abstract_inverted_index);
  return { id: work.id, title: work.title || 'Untitled paper', year: work.publication_year || 'Unknown', authors: (work.authorships || []).map(item => item.author?.display_name).filter(Boolean).join(', '), venue: work.primary_location?.source?.display_name || work.locations?.[0]?.source?.display_name || '', url: work.primary_location?.landing_page_url || work.doi || work.id, abstract, citations: Number(work.cited_by_count || 0), indiaContext: indiaContext(work, abstract), source: 'OpenAlex' };
}
function relevance(paper, idea, data) { const paperTokens = new Set(tokens(`${paper.title} ${paper.abstract}`)); const overlap = tokens(idea).filter(term => paperTokens.has(term)).length * 20; const learned = [...paperTokens].reduce((total, term) => total + (data.positive[term] || 0) * 2 - (data.negative[term] || 0) * 3, 0); return Math.max(0, Math.round(overlap + Math.min(Math.log10(paper.citations + 1) * 6, 25) + Math.max(0, Number(paper.year) - 2018) + learned)); }
function validYear(value, name) { if (!value) return null; const year = Number(value); if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error(`${name} must be a valid year.`); return year; }

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/papers', async (req, res, next) => { try { const idea = String(req.query.idea || '').trim(); const limit = Number(req.query.limit || 20); const fromYear = validYear(req.query.fromYear, 'fromYear'); const toYear = validYear(req.query.toYear, 'toYear'); if (idea.length < 3) return res.status(400).json({ error: 'Research idea must contain at least 3 characters.' }); if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ error: 'limit must be between 1 and 50.' }); if (fromYear && toYear && fromYear > toYear) return res.status(400).json({ error: 'fromYear must not be after toYear.' }); const params = new URLSearchParams({ search: idea, 'per-page': String(limit), select: 'id,title,publication_year,authorships,primary_location,locations,cited_by_count,abstract_inverted_index' }); const filters = []; if (fromYear) filters.push(`from_publication_date:${fromYear}-01-01`); if (toYear) filters.push(`to_publication_date:${toYear}-12-31`); if (filters.length) params.set('filter', filters.join(',')); const response = await fetch(`https://api.openalex.org/works?${params}`); if (!response.ok) throw new Error(`OpenAlex request failed: HTTP ${response.status}`); const payload = await response.json(); if (!Array.isArray(payload.results)) throw new Error('OpenAlex returned an unexpected response.'); const data = await profile(); const papers = payload.results.map(normalize).map(paper => ({ ...paper, score: relevance(paper, idea, data) })).sort((a, b) => b.score - a.score); res.json({ papers }); } catch (error) { next(error); } });
app.post('/api/feedback', async (req, res, next) => { try { const { paper, action } = req.body || {}; if (!paper?.title || !['save', 'reject'].includes(action)) return res.status(400).json({ error: 'A paper and a valid feedback action are required.' }); const data = await profile(); const bucket = action === 'save' ? data.positive : data.negative; for (const token of tokens(`${paper.title} ${paper.abstract}`)) bucket[token] = (bucket[token] || 0) + 1; await saveProfile(data); res.status(201).json({ ok: true }); } catch (error) { next(error); } });
app.use((error, _req, res, _next) => { console.error(error); res.status(502).json({ error: error.message || 'The research service is unavailable.' }); });
if (process.env.NODE_ENV === 'production') app.use(express.static(path.join(root, 'dist')));
app.listen(port, () => console.log(`ResearchScout API listening on http://localhost:${port}`));
