async function request(path, options) {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

export function searchPapers({ idea, fromYear, toYear, limit }) {
  const params = new URLSearchParams({ idea, limit: String(limit) });
  if (fromYear) params.set('fromYear', fromYear);
  if (toYear) params.set('toYear', toYear);
  return request(`/papers?${params}`);
}

export function sendFeedback(paper, action) {
  return request('/feedback', { method: 'POST', body: JSON.stringify({ paper, action }) });
}
