// When using Vite's proxy, BASE_URL can be empty (requests go via /api/...).
// Override with VITE_API_URL env var for production deployments.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const fetchModels = () => request('/api/models');

export const fetchConversations = () => request('/api/conversations');

export const fetchConversation = (id) => request(`/api/conversations/${id}`);

export const createConversation = (data) =>
  request('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const updateConversation = (id, data) =>
  request(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const deleteConversation = (id) =>
  request(`/api/conversations/${id}`, { method: 'DELETE' });

/**
 * Sends a message and yields parsed SSE events:
 *   { token: string }  – streaming token
 *   { done: true, message_id: number }  – stream complete
 *   { error: string }  – backend error
 */
export async function* sendMessage(convId, content, model) {
  const res = await fetch(`${BASE_URL}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, model }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // hold incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        yield JSON.parse(jsonStr);
      } catch {
        // malformed – skip
      }
    }
  }

  // Flush remaining buffer
  if (buffer.startsWith('data: ')) {
    const jsonStr = buffer.slice(6).trim();
    if (jsonStr) {
      try {
        yield JSON.parse(jsonStr);
      } catch {
        // ignore
      }
    }
  }
}
