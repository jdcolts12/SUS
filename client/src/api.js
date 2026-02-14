const API_URL = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') || null;

function getApiUrl() {
  if (API_URL) return API_URL;
  if (import.meta.env.DEV) return `http://${window?.location?.hostname || 'localhost'}:3001`;
  return null;
}

async function fetchApi(path, options = {}) {
  const base = getApiUrl();
  if (!base) {
    throw new Error('Server URL not set. In Vercel: add VITE_SOCKET_URL = your Render server URL (e.g. https://sus-server.onrender.com), then redeploy.');
  }
  const url = `${base}/api${path}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch (e) {
    throw new Error(`Cannot reach server. Make sure VITE_SOCKET_URL is set in Vercel to your Render URL, and the server is running.`);
  }
  const contentType = res.headers.get('content-type');
  const data = contentType?.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (!contentType?.includes('application/json')) {
    throw new Error('Invalid server response. Set VITE_SOCKET_URL in Vercel to your Render server URL (e.g. https://sus-server.onrender.com), then redeploy.');
  }
  return data;
}

export const api = {
  createUser: async (username, password) => {
    const data = await fetchApi('/users', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (!data?.userId) throw new Error(data?.error || 'Account created but server returned invalid response. Try signing in.');
    return data;
  },
  signIn: async (username, password) => {
    const data = await fetchApi('/auth/sign-in', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (!data?.userId) throw new Error(data?.error || 'Sign in failed.');
    return data;
  },
  getUser: (id) => fetchApi(`/users/${id}`),
  updateUser: (id, updates) => fetchApi(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  searchUser: (username) => fetchApi(`/users/search/${encodeURIComponent(username)}`),
  sendFriendRequest: (userId, toUsername) => fetchApi(`/users/${userId}/friends/request`, { method: 'POST', body: JSON.stringify({ toUsername }) }),
  acceptFriendRequest: (userId, requestId) => fetchApi(`/users/${userId}/friends/accept`, { method: 'POST', body: JSON.stringify({ requestId }) }),
  getFriendRequests: (userId) => fetchApi(`/users/${userId}/friends/requests`),
  getFriends: (userId) => fetchApi(`/users/${userId}/friends`),
  getStats: (userId) => fetchApi(`/users/${userId}/stats`),
  revealImposter: async (gameId, code, playerName) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const data = await fetchApi('/reveal-imposter', {
        method: 'POST',
        body: JSON.stringify({ gameId, code, playerName }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      return data;
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  },
};
