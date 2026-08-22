import { cli, Strategy } from '@agentrhq/webcmd/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@agentrhq/webcmd/errors';

const API = 'https://api.openalex.org/works';

function abstractFromIndex(index) {
  if (!index || typeof index !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) words[position] = word;
  }
  return words.join(' ');
}

cli({
  site: 'openalex', name: 'search-papers', access: 'read',
  description: 'Search OpenAlex for research papers matching an idea.', domain: 'api.openalex.org',
  strategy: Strategy.PUBLIC, browser: false, tags: ['search'], keywords: ['papers', 'research', 'literature'],
  args: [
    { name: 'query', type: 'string', required: true, help: 'Research idea or paper topic' },
    { name: 'limit', type: 'int', default: 20, help: 'Number of papers, from 1 to 50' },
    { name: 'fromYear', type: 'int', help: 'Optional first publication year' },
    { name: 'toYear', type: 'int', help: 'Optional last publication year' },
  ],
  columns: ['title', 'year', 'authors', 'venue', 'url', 'abstract', 'citations', 'source'],
  func: async (args) => {
    const query = String(args.query || '').trim(); const limit = Number(args.limit ?? 20);
    const fromYear = args.fromYear == null ? null : Number(args.fromYear); const toYear = args.toYear == null ? null : Number(args.toYear);
    if (query.length < 3) throw new ArgumentError('query must contain at least 3 characters');
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ArgumentError('limit must be an integer from 1 to 50');
    if (fromYear !== null && (!Number.isInteger(fromYear) || fromYear < 1900 || fromYear > 2100)) throw new ArgumentError('fromYear must be a valid year');
    if (toYear !== null && (!Number.isInteger(toYear) || toYear < 1900 || toYear > 2100)) throw new ArgumentError('toYear must be a valid year');
    if (fromYear && toYear && fromYear > toYear) throw new ArgumentError('fromYear must not be after toYear');
    const params = new URLSearchParams({ search: query, 'per-page': String(limit), select: 'id,title,publication_year,authorships,primary_location,locations,cited_by_count,abstract_inverted_index' });
    const filters = []; if (fromYear) filters.push(`from_publication_date:${fromYear}-01-01`); if (toYear) filters.push(`to_publication_date:${toYear}-12-31`); if (filters.length) params.set('filter', filters.join(','));
    const response = await fetch(`${API}?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new CommandExecutionError(`OpenAlex request failed: HTTP ${response.status}`);
    const payload = await response.json(); if (!Array.isArray(payload?.results)) throw new CommandExecutionError('OpenAlex returned an unexpected response shape');
    if (!payload.results.length) throw new EmptyResultError('openalex search-papers', `No papers found for "${query}"`);
    return payload.results.map((work) => ({
      title: work.title || 'Untitled paper', year: work.publication_year || null,
      authors: (work.authorships || []).map(item => item.author?.display_name).filter(Boolean).join(', '),
      venue: work.primary_location?.source?.display_name || work.locations?.[0]?.source?.display_name || '',
      url: work.primary_location?.landing_page_url || work.doi || work.id,
      abstract: abstractFromIndex(work.abstract_inverted_index), citations: Number(work.cited_by_count || 0), source: 'OpenAlex',
    }));
  },
});
