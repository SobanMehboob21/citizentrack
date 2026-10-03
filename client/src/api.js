// VITE_API_URL is baked in at BUILD time. Default "/api" works with the dev proxy
// and with a reverse proxy (Nginx) that forwards /api to the backend.
const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

export const api = {
  submit: (body) => request('/applications', { method: 'POST', body }),
  track: (id) => request(`/applications/${encodeURIComponent(id)}`),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  list: (token, qs = '') => request(`/applications${qs}`, { token }),
  update: (token, id, body) => request(`/applications/${id}`, { method: 'PATCH', body, token }),
  audit: (token) => request('/audit', { token }),
};
