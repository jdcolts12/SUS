import { useState, useEffect } from 'react';
import { api } from '../api';

function Profile({ userId, onEditProfile, onFriends, onBack }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getUser(userId).then(setUser).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="profile"><p>Loading...</p></div>;
  if (error) return <div className="profile"><p className="profile__error">{error}</p><button className="btn" onClick={onBack}>Back</button></div>;
  if (!user) return null;

  const stats = user.stats || { teamWins: 0, teamLosses: 0, imposterWins: 0, imposterLosses: 0 };

  return (
    <div className="profile" style={{ '--profile-bg': user.bg_color || '#1a1a2e' }}>
      <div className="profile__header">
        <div className="profile__avatar" style={{ backgroundColor: user.bg_color }}>
          {user.profile_pic ? (
            <img src={user.profile_pic} alt="" />
          ) : (
            <span>{user.username?.charAt(0)?.toUpperCase() || '?'}</span>
          )}
        </div>
        <h1 className="profile__name">{user.username}</h1>
        <div className="profile__actions">
          <button className="btn btn--secondary" onClick={onEditProfile}>Edit Profile</button>
          <button className="btn btn--secondary" onClick={onFriends}>Friends</button>
        </div>
      </div>

      <div className="profile__stats">
        <h3>Stats</h3>
        <div className="profile__stat-grid">
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.teamWins}</span>
            <span className="profile__stat-label">Team Wins</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.teamLosses}</span>
            <span className="profile__stat-label">Team Losses</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.imposterWins}</span>
            <span className="profile__stat-label">Imposter Wins</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.imposterLosses}</span>
            <span className="profile__stat-label">Imposter Losses</span>
          </div>
        </div>
      </div>

      <button className="btn btn--ghost" onClick={onBack}>Back</button>
    </div>
  );
}

export default Profile;
