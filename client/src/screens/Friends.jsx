import { useState, useEffect } from 'react';
import { api } from '../api';

function Friends({ userId, onBack }) {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingTo, setSendingTo] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getFriends(userId), api.getFriendRequests(userId)])
      .then(([f, r]) => { setFriends(f); setRequests(r); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [userId]);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSendingTo(search);
    setError('');
    try {
      await api.sendFriendRequest(userId, search.trim());
      setSearch('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSendingTo('');
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await api.acceptFriendRequest(userId, requestId);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="friends">
      <h2>Friends</h2>

      <form onSubmit={handleSendRequest} className="friends__search">
        <input
          type="text"
          placeholder="Search by username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" disabled={sendingTo}>Add</button>
      </form>

      <div className="friends__tabs">
        <button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>
          Friends ({friends.length})
        </button>
        <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
          Requests ({requests.length})
        </button>
      </div>

      {error && <p className="friends__error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : tab === 'friends' ? (
        <ul className="friends__list">
          {friends.length === 0 ? <li>No friends yet</li> : friends.map((f) => (
            <li key={f.id}>
              <div className="friends__avatar" style={{ backgroundColor: f.bg_color }}>
                {f.profile_pic ? <img src={f.profile_pic} alt="" /> : <span>{f.username?.charAt(0)}</span>}
              </div>
              <span>{f.username}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="friends__list">
          {requests.length === 0 ? <li>No pending requests</li> : requests.map((r) => (
            <li key={r.id}>
              <div className="friends__avatar" style={{ backgroundColor: r.bg_color || '#252542' }}>
                {r.profile_pic ? <img src={r.profile_pic} alt="" /> : <span>{r.username?.charAt(0)}</span>}
              </div>
              <span>{r.username}</span>
              <button className="btn btn--small" onClick={() => handleAccept(r.id)}>Accept</button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn--ghost" onClick={onBack}>Back</button>
    </div>
  );
}

export default Friends;
