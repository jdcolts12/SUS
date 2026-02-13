import { useState } from 'react';
import ConnectionHelp from './ConnectionHelp';

function Home({ userId, onCreateGame, onJoinGame, onProfile, onSignUp, onSignIn, error, connecting = false }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (name.trim()) onCreateGame(name.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (name.trim() && code.trim()) onJoinGame(code, name.trim());
  };

  return (
    <div className="home">
      <div className="home__header">
        {userId && (
          <button className="home__profile-btn btn btn--secondary" onClick={onProfile}>
            Profile
          </button>
        )}
        <button className="home__profile-btn btn btn--secondary" onClick={onSignIn}>
          Sign in
        </button>
        <button className="home__profile-btn btn btn--primary" onClick={onSignUp}>
          Create account
        </button>
      </div>

      <div className="home__auth-strip">
        <button className="btn btn--primary" onClick={onSignUp}>Create account</button>
        <button className="btn btn--secondary" onClick={onSignIn}>Sign in</button>
      </div>

      <div className="home__hero">
        <h1 className="home__title">SUS</h1>
        <p className="home__subtitle">One of you isn't who they seem</p>
      </div>

      {!userId ? (
        <div className="home__auth-gate">
          <h3 className="home__auth-title">Sign in to play</h3>
          <p className="home__auth-msg">Create an account or sign in with your username and password.</p>
          <div className="home__actions home__auth-buttons">
            <button className="btn btn--primary btn--large" onClick={onSignUp}>
              Create Account
            </button>
            <button className="btn btn--secondary btn--large" onClick={onSignIn}>
              Sign In
            </button>
          </div>
        </div>
      ) : !mode ? (
        <div className="home__actions">
          <button
            className="btn btn--primary"
            onClick={() => setMode('create')}
          >
            Create Game
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
            {connecting ? 'Connecting...' : 'Create & Get Code'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { setMode(null); setName(''); }}
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
        <>
          <p className="home__error">{error}</p>
          <ConnectionHelp />
        </>
      )}

      <p className="home__hint">
        Share the room code with friends. Everyone gets a word on their phone—except who's SUS, who only knows the category.
      </p>
    </div>
  );
}

export default Home;
