import { useState, useEffect } from 'react';
import ConnectionHelp from './ConnectionHelp';

function Home({ userId, username, onCreateGame, onJoinGame, onProfile, onLeaderboard, onSignUp, onSignIn, error, connecting = false, onRetryConnection, serverHealthUrl, initialMode, onConsumedInitialMode }) {
  const [mode, setMode] = useState(initialMode || null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createAsCustom, setCreateAsCustom] = useState(false);

  useEffect(() => {
    if (initialMode) onConsumedInitialMode?.();
  }, [initialMode, onConsumedInitialMode]);

  // Pre-fill name with username when logged in (ensures stats link to account)
  useEffect(() => {
    if (username && userId) setName((prev) => prev || username);
  }, [username, userId]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (name.trim()) onCreateGame(name.trim(), createAsCustom);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (name.trim() && code.trim()) onJoinGame(code, name.trim());
  };

  return (
    <div className="home">
      <div className="home__header">
        {userId ? (
          <>
            <span className="home__logged-in">Hi, {username || 'Player'}!</span>
            <div className="home__header-btns">
              <button className="home__profile-btn btn btn--secondary" onClick={onLeaderboard}>Leaderboard</button>
              <button className="home__profile-btn btn btn--secondary" onClick={onProfile}>Profile</button>
            </div>
          </>
        ) : (
          <>
            <div className="home__header-btns">
              <button className="home__profile-btn btn btn--secondary" onClick={onLeaderboard}>Leaderboard</button>
              <button className="home__profile-btn btn btn--secondary" onClick={onSignIn}>Sign in</button>
              <button className="home__profile-btn btn btn--primary" onClick={onSignUp}>Create account</button>
            </div>
          </>
        )}
      </div>

      <div className="home__hero">
        <h1 className="home__title">SUS</h1>
        <p className="home__subtitle">One of you isn't who they seem</p>
      </div>

      {!userId ? (
        <div className="home__auth-required">
          <p className="home__auth-required-text">Sign in to play. You&apos;ll stay signed in when you return.</p>
          <div className="home__auth-required-btns">
            <button className="btn btn--primary" onClick={onSignUp}>Create account</button>
            <button className="btn btn--secondary" onClick={onSignIn}>Sign in</button>
          </div>
        </div>
      ) : !mode ? (
        <div className="home__actions">
          <button
            className="btn btn--primary"
            onClick={() => { setMode('create'); setCreateAsCustom(false); }}
          >
            Create Game
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => { setMode('create'); setCreateAsCustom(true); }}
          >
            Create Custom Game
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => setMode('join')}
          >
            Join Game
          </button>
        </div>
      ) : mode === 'create' ? (
        <form className="home__form" onSubmit={handleCreate}>
          {createAsCustom && (
            <p className="home__custom-hint">You&apos;ll host and pick the category & word each round.</p>
          )}
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            required
          />
          <button type="submit" className="btn btn--primary" disabled={connecting}>
            {connecting ? 'Connecting… (may take 60s if server was sleeping)' : 'Create & Get Code'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { setMode(null); setName(''); setCreateAsCustom(false); }}
          >
            Back
          </button>
        </form>
      ) : (
        <form className="home__form" onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Room code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoFocus
            required
          />
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
          />
          <button type="submit" className="btn btn--primary" disabled={connecting}>
            {connecting ? 'Connecting...' : 'Join'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { setMode(null); setName(''); setCode(''); }}
          >
            Back
          </button>
        </form>
      )}

      {error && (
        <div className="home__error-block">
          <p className="home__error">{error}</p>
          {error.includes("Can't reach server") && onRetryConnection && (
            <>
              {serverHealthUrl && (
                <a
                  href={serverHealthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home__error-link"
                >
                  Test server in new tab →
                </a>
              )}
              <div
                className={`home__retry-btn ${connecting ? 'home__retry-btn--disabled' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => !connecting && onRetryConnection()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (!connecting) onRetryConnection();
                }}
                onKeyDown={(e) => e.key === 'Enter' && !connecting && onRetryConnection()}
              >
                {connecting ? 'Waking server…' : 'TAP TO RETRY'}
              </div>
            </>
          )}
          <ConnectionHelp />
        </div>
      )}

      <p className="home__hint">
        Share the room code with friends. Everyone gets a word on their phone—except who's SUS, who only knows the category.
      </p>
    </div>
  );
}

export default Home;
