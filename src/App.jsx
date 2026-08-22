import { useMemo, useState } from 'react';
import { searchPapers, sendFeedback } from './api.js';

const initialSearch = { idea: 'large language models in healthcare', fromYear: '', toYear: '', limit: 20 };
const memoryKey = 'researchscout:last-opened-paper';

function readLastVisited() {
  try { return JSON.parse(window.localStorage.getItem(memoryKey) || 'null'); } catch { return null; }
}

function ArrowUpRight() {
  return <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3.2 12.8 12.8 3.2M6 3.2h6.8V10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>;
}

function SearchForm({ value, onChange, onSubmit, loading, sort, onSort }) {
  return <form className="search-panel" onSubmit={onSubmit}>
    <div className="field-label"><span>01</span><label htmlFor="idea">Inquiry</label><span className="field-note">Natural language / semantic retrieval</span></div>
    <div className="search-row">
      <input id="idea" required minLength="3" value={value.idea} onChange={e => onChange({ ...value, idea: e.target.value })} placeholder="What are you investigating?" />
      <button className="search-button" disabled={loading}><span>{loading ? 'Scanning index' : 'Search index'}</span><ArrowUpRight /></button>
    </div>
    <div className="filter-row" aria-label="Search filters">
      <label><span>Published after</span><input type="number" min="1900" max="2100" value={value.fromYear} onChange={e => onChange({ ...value, fromYear: e.target.value })} placeholder="Any year" /></label>
      <label><span>Published before</span><input type="number" min="1900" max="2100" value={value.toYear} onChange={e => onChange({ ...value, toYear: e.target.value })} placeholder="Present" /></label>
      <label><span>Items to inspect</span><select value={value.limit} onChange={e => onChange({ ...value, limit: Number(e.target.value) })}><option value="10">10 records</option><option value="20">20 records</option><option value="50">50 records</option></select></label>
      <label><span>Sort records by</span><select value={sort} onChange={e => onSort(e.target.value)}><option value="relevance">Research relevance</option><option value="latest">Latest publication</option><option value="citations">Most cited</option><option value="india">Indian context</option></select></label>
      <p className="method-note">Indian context combines India mentions with affiliations in India. All sorting happens in this reading view.</p>
    </div>
  </form>;
}

function PaperCard({ paper, index, onFeedback, onVisit }) {
  const [sent, setSent] = useState('');
  const feedback = async action => {
    try { await onFeedback(paper, action); setSent(action); } catch { /* App status already surfaces the failure. */ }
  };
  const authors = paper.authors ? paper.authors.split(', ').slice(0, 3).join(', ') : 'Authors unavailable';
  const relevance = Math.min(100, Math.max(4, paper.score));

  return <article className="paper-card">
    <div className="record-index" aria-label={`Result ${index + 1}`}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <div className="relevance-mark"><i style={{ '--signal': `${relevance}%` }} /><small>{paper.score}</small></div>
    </div>
    <div className="paper-main">
      <div className="paper-meta"><span>{paper.year}</span><span>{paper.venue || 'Unclassified venue'}</span>{paper.indiaContext?.label && <span className="context-tag">{paper.indiaContext.label}</span>}</div>
      <h2><a href={paper.url} target="_blank" rel="noreferrer" onClick={() => onVisit(paper)}>{paper.title}<ArrowUpRight /></a></h2>
      <p className="authors">{authors}{paper.authors?.split(', ').length > 3 ? ' et al.' : ''}</p>
      <p className="abstract">{paper.abstract ? `${paper.abstract.slice(0, 340)}${paper.abstract.length > 340 ? '…' : ''}` : 'No abstract is indexed for this record.'}</p>
    </div>
    <footer className="record-footer">
      <div className="record-facts"><span><strong>{Number(paper.citations || 0).toLocaleString()}</strong> citations</span><span>via {paper.source}</span></div>
      <div className="actions" aria-label={`Reading actions for ${paper.title}`}>
        <button type="button" className={sent === 'save' ? 'selected' : ''} onClick={() => feedback('save')} disabled={Boolean(sent)}>{sent === 'save' ? 'Filed' : 'File for review'}</button>
        <button type="button" className="reject" onClick={() => feedback('reject')} disabled={Boolean(sent)}>{sent === 'reject' ? 'Excluded' : 'Exclude'}</button>
      </div>
    </footer>
  </article>;
}

function LastVisited({ paper }) {
  if (!paper) return <div className="last-visited"><p className="side-label">Last opened</p><p>No paper has been opened from this desk yet.</p></div>;
  return <div className="last-visited">
    <p className="side-label">Last opened</p>
    <a href={paper.url} target="_blank" rel="noreferrer">{paper.title}<ArrowUpRight /></a>
    <p>{paper.venue || 'Research source'} · {paper.year || 'Date unavailable'}</p>
    <time dateTime={paper.visitedAt}>Opened {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(paper.visitedAt))}</time>
  </div>;
}

function EmptyState() {
  return <section className="empty-state">
    <div><p className="kicker">Begin an inquiry</p><h2>Turn a broad question into a reading trail.</h2><p>Search across the OpenAlex scholarly index, then file or exclude records to tune the next pass.</p></div>
    <div className="empty-diagram" aria-hidden="true"><span className="node node-a" /><span className="node node-b" /><span className="node node-c" /><i /><i /><i /></div>
  </section>;
}

export default function App() {
  const [form, setForm] = useState(initialSearch);
  const [papers, setPapers] = useState([]);
  const [sort, setSort] = useState('relevance');
  const [lastVisited, setLastVisited] = useState(readLastVisited);
  const [message, setMessage] = useState('Set an inquiry, then search the index.');
  const [loading, setLoading] = useState(false);
  const statistics = useMemo(() => {
    if (!papers.length) return null;
    const cited = papers.reduce((sum, paper) => sum + Number(paper.citations || 0), 0);
    const years = papers.map(paper => Number(paper.year)).filter(Number.isFinite);
    return { cited, newest: years.length ? Math.max(...years) : '—' };
  }, [papers]);
  const sortedPapers = useMemo(() => [...papers].sort((left, right) => {
    if (sort === 'latest') return Number(right.year || 0) - Number(left.year || 0) || right.score - left.score;
    if (sort === 'citations') return Number(right.citations || 0) - Number(left.citations || 0) || right.score - left.score;
    if (sort === 'india') return Number(right.indiaContext?.score || 0) - Number(left.indiaContext?.score || 0) || right.score - left.score;
    return right.score - left.score;
  }), [papers, sort]);
  const submit = async event => {
    event.preventDefault();
    if (form.fromYear && form.toYear && Number(form.fromYear) > Number(form.toYear)) return setMessage('The start year must precede the end year.');
    setLoading(true); setMessage('Searching the scholarly index…');
    try { const data = await searchPapers(form); setPapers(data.papers); setMessage(`${data.papers.length} records retrieved. Ranking incorporates your prior reading decisions.`); }
    catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  };
  const feedback = async (paper, action) => {
    try { await sendFeedback(paper, action); setMessage(action === 'save' ? 'Filed. Related work will gain weight in future searches.' : 'Excluded. Similar work will recede in future searches.'); }
    catch (error) { setMessage(error.message); throw error; }
  };
  const rememberVisit = paper => {
    const snapshot = { title: paper.title, url: paper.url, venue: paper.venue, year: paper.year, visitedAt: new Date().toISOString() };
    try { window.localStorage.setItem(memoryKey, JSON.stringify(snapshot)); } catch { /* Reading links still work if storage is unavailable. */ }
    setLastVisited(snapshot);
  };

  return <main>
    <header className="masthead">
      <a className="wordmark" href="#top" aria-label="ResearchScout home"><span>RS</span>ResearchScout</a>
    </header>

    <section className="intro" id="top">
      <div className="intro-index intro-workflow"><span>ResearchScout method</span><b>Find<br />→ Learn</b><i>Discover literature<br />Evaluate evidence<br />Build a reading trail</i></div>
      <div><p className="eyebrow">OpenAlex-powered research discovery</p><h1>Find the work.<br /><em>Build the evidence.</em></h1></div>
      <p className="intro-copy">Find scholarly papers, rank them by relevance, date, citations, or Indian context, then refine future searches through your reading decisions.</p>
    </section>

    <section className="workspace">
      <aside className="margin-notes">
        <div><p className="side-label">Protocol</p><p>Searches the public OpenAlex works index. Results are ranked locally and never sent to a model.</p></div>
        <div><p className="side-label">Reading memory</p><p>Filing or excluding a record adjusts later rankings using title and abstract terms.</p></div>
        <LastVisited paper={lastVisited} />
        <div className="source-stamp">Source verified<br /><strong>OpenAlex</strong><br />Public scholarly catalog</div>
      </aside>
      <div className="desk">
        <SearchForm value={form} onChange={setForm} onSubmit={submit} loading={loading} sort={sort} onSort={setSort} />
        <div className="status-wrap" aria-live="polite"><span className={loading ? 'status-pulse' : ''} /> <p>{message}</p>{statistics && <div className="statistics"><span><b>{statistics.cited.toLocaleString()}</b> cited by</span><span><b>{statistics.newest}</b> newest</span></div>}</div>
        {papers.length ? <section className="results" aria-label="Research papers"><div className="results-header"><span>Retrieved records</span><span>Relevance signal</span><span>Reading decision</span></div>{sortedPapers.map((paper, index) => <PaperCard key={paper.id} paper={paper} index={index} onFeedback={feedback} onVisit={rememberVisit} />)}</section> : <EmptyState />}
      </div>
    </section>
    <footer className="page-footer"><span>ResearchScout / 2026</span><span>Evidence first, automation second.</span></footer>
  </main>;
}
