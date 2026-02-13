const API_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? `http://${window?.location?.hostname || 'localhost'}:3001` : window?.location?.origin || '');

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  createUser: (username) => fetchApi('/users', { method: 'POST', body: JSON.stringify({ username }) }),
  getUser: (id) => fetchApi(`/users/${id}`),
  updateUser: (id, updates) => fetchApi(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  searchUser: (username) => fetchApi(`/users/search/${encodeURIComponent(username)}`),
  sendFriendRequest: (userId, toUsername) => fetchApi(`/users/${userId}/friends/request`, { method: 'POST', body: JSON.stringify({ toUsername }) }),
  acceptFriendRequest: (userId, requestId) => fetchApi(`/users/${userId}/friends/accept`, { method: 'POST', body: JSON.stringify({ requestId }) }),
  getFriendRequests: (userId) => fetchApi(`/users/${userId}/friends/requests`),
  getFriends: (userId) => fetchApi(`/users/${userId}/friends`),
  getStats: (userId) => fetchApi(`/users/${userId}/stats`),
};
