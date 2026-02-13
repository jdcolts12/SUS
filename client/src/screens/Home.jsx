import { useState } from 'react';

function Home({ onCreateGame, onJoinGame, error }) {
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
      <div className="home__hero">
        <h1 className="home__title">SUS</h1>
        <p className="home__subtitle">One of you isn't who they seem</p>
      </div>

      {!mode ? (
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
          <button type="submit" className="btn btn--primary">
            Create & Get Code
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
          <button type="submit" className="btn btn--primary">
            Join
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

      {error && <p className="home__error">{error}</p>}

      <p className="home__hint">
        Share the room code with friends. Everyone gets a word on their phone—except who's SUS, who only knows the category.
      </p>
    </div>
  );
}

export default Home;
