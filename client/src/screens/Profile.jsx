import { useState, useEffect } from 'react';
import { api } from '../api';

function Profile({ userId, onEditProfile, onFriends, onLeaderboard, onJoinGame, onBack, onSignOut }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getUser(userId).then(setUser).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="profile"><p>Loading...</p></div>;
  if (error) {
    const isNotFound = /not found|404/i.test(error);
    return (
      <div className="profile">
        <p className="profile__error">
          {isNotFound ? 'Your session expired (server may have restarted). Please sign in again.' : error}
        </p>
        <button className="btn" onClick={isNotFound && onSignOut ? onSignOut : onBack}>
          {isNotFound ? 'Sign in again' : 'Back'}
        </button>
      </div>
    );
  }
  if (!user) return null;

  const stats = user.stats || { teamWins: 0, teamLosses: 0, imposterWins: 0, imposterLosses: 0, correctVotes: 0, totalCrewVotes: 0 };
  const crewTotal = stats.teamWins + stats.teamLosses;
  const impTotal = stats.imposterWins + stats.imposterLosses;
  const crewWinPct = crewTotal > 0 ? Math.round((stats.teamWins / crewTotal) * 100) : null;
  const imposterWinPct = impTotal > 0 ? Math.round((stats.imposterWins / impTotal) * 100) : null;
  const correctVotePct = stats.totalCrewVotes > 0 ? Math.round((stats.correctVotes / stats.totalCrewVotes) * 100) : null;

  return (
    <div className="profile" style={{ '--profile-bg': user.bg_color || '#1a1a2e' }}>
      <div className="profile__top">
        <button className="btn btn--ghost" onClick={onBack}>← Back</button>
      </div>
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
          <button className="btn btn--secondary" onClick={onLeaderboard}>Leaderboard</button>
          <button className="btn btn--secondary" onClick={onJoinGame}>Join Game</button>
        </div>
        <div className="profile__actions profile__actions--secondary">
          <button className="btn btn--ghost" onClick={onEditProfile}>Edit Profile</button>
          <button className="btn btn--ghost" onClick={onFriends}>Friends</button>
        </div>
      </div>

      <div className="profile__stats">
        <h3>Stats</h3>
        <div className="profile__stat-grid">
          <div className="profile__stat">
            <span className="profile__stat-value">{crewWinPct !== null ? `${crewWinPct}%` : '—'}</span>
            <span className="profile__stat-label">Crew Win %</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{imposterWinPct !== null ? `${imposterWinPct}%` : '—'}</span>
            <span className="profile__stat-label">Imposter Win %</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{correctVotePct !== null ? `${correctVotePct}%` : '—'}</span>
            <span className="profile__stat-label">Correct Vote %</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{stats.teamWins + stats.teamLosses + stats.imposterWins + stats.imposterLosses}</span>
            <span className="profile__stat-label">Games Played</span>
          </div>
        </div>
      </div>

      <div className="profile__footer">
        <button className="btn btn--ghost" onClick={onBack}>Back</button>
        {onSignOut && (
          <button className="btn btn--ghost profile__signout" onClick={onSignOut}>Sign out</button>
        )}
      </div>
    </div>
  );
}

export default Profile;
