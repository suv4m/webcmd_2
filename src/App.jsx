import { useState } from 'react';
import { searchPapers, sendFeedback } from './api.js';

const initialSearch = { idea: 'large language models in healthcare', fromYear: '', toYear: '', limit: 20 };

function SearchForm({ value, onChange, onSubmit, loading }) {
  return <form className="search-panel" onSubmit={onSubmit}>
    <label htmlFor="idea">Research idea</label>
    <div className="search-row"><input id="idea" required minLength="3" value={value.idea} onChange={e => onChange({ ...value, idea: e.target.value })} placeholder="e.g. LLMs for early disease detection" /><button disabled={loading}>{loading ? 'Searching…' : 'Find papers'}</button></div>
    <div className="filter-row">
      <label>From <input type="number" min="1900" max="2100" value={value.fromYear} onChange={e => onChange({ ...value, fromYear: e.target.value })} placeholder="2020" /></label>
      <label>To <input type="number" min="1900" max="2100" value={value.toYear} onChange={e => onChange({ ...value, toYear: e.target.value })} placeholder="2026" /></label>
      <label>Results <select value={value.limit} onChange={e => onChange({ ...value, limit: Number(e.target.value) })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
    </div>
  </form>;
}

function PaperCard({ paper, onFeedback }) {
  const [sent, setSent] = useState('');
  const feedback = async action => { await onFeedback(paper, action); setSent(action); };
  return <article className="paper-card">
    <div className="paper-head"><span className="score">{paper.score} relevance</span><span className="year">{paper.year}</span></div>
    <h2><a href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a></h2>
    <p className="authors">{paper.authors || 'Authors unavailable'}</p><p className="venue">{paper.venue || 'Venue unavailable'}</p>
    <p className="abstract">{paper.abstract ? `${paper.abstract.slice(0, 260)}${paper.abstract.length > 260 ? '…' : ''}` : 'Abstract unavailable.'}</p>
    <footer><span className="citations">{paper.citations.toLocaleString()} citations</span><span className="source">{paper.source}</span><div className="actions">
      <button type="button" className={sent === 'save' ? 'selected' : ''} onClick={() => feedback('save')} disabled={Boolean(sent)}>Save</button>
      <button type="button" className="reject" onClick={() => feedback('reject')} disabled={Boolean(sent)}>Not relevant</button>
    </div></footer>
  </article>;
}

export default function App() {
  const [form, setForm] = useState(initialSearch); const [papers, setPapers] = useState([]); const [message, setMessage] = useState('Enter an idea to begin.'); const [loading, setLoading] = useState(false);
  const submit = async event => { event.preventDefault(); if (form.fromYear && form.toYear && Number(form.fromYear) > Number(form.toYear)) return setMessage('“From” year must be before “To” year.'); setLoading(true); setMessage('Asking the research agent…'); try { const data = await searchPapers(form); setPapers(data.papers); setMessage(`${data.papers.length} papers found. Ranking reflects your saved feedback.`); } catch (error) { setMessage(error.message); } finally { setLoading(false); } };
  const feedback = async (paper, action) => { try { await sendFeedback(paper, action); setMessage(action === 'save' ? 'Saved. Similar papers will rank higher next time.' : 'Feedback recorded. Similar papers will rank lower next time.'); } catch (error) { setMessage(error.message); } };
  return <main><header><p className="eyebrow">WEB-CMD HACKATHON</p><h1>ResearchScout</h1><p className="subtitle">A self-learning research browser that finds papers—and learns which ones matter to you.</p></header><SearchForm value={form} onChange={setForm} onSubmit={submit} loading={loading}/><section className="status-wrap" aria-live="polite"><p>{message}</p></section><section className="results" aria-label="Research papers">{papers.map(paper => <PaperCard key={paper.id} paper={paper} onFeedback={feedback}/>)}</section></main>;
}
