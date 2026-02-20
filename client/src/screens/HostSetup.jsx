import { useState } from 'react';
import { api } from '../api';

function HostSetup({
  gameId,
  code,
  playerName,
  players,
  socket,
  onRoundStarted,
  onHostRoundReady,
  onBackToLobby,
  error,
  onClearError,
  onError,
}) {
  const [category, setCategory] = useState('');
  const [word, setWord] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const playingCount = Math.max(0, (players?.length || 1) - 1);
  const allPlayersCount = players?.length || 0;
  const categoryTrim = category?.trim() || '';
  const wordTrim = word?.trim() || '';

  const handleStartRound = (e) => {
    e.preventDefault();
    if (!categoryTrim || !wordTrim || submitting) return;
    setSubmitting(true);
    onClearError?.();

    const onSuccess = (data) => {
      if (data?.hostRoundReady) {
        onHostRoundReady?.(data.hostRoundReady);
      }
      onRoundStarted?.();
    };
    const onFail = (msg) => {
      setSubmitting(false);
      onError?.(msg || 'Failed to start round.');
    };

    // Prefer socket — stays on same server instance, avoids "Game not found" on Render
    if (socket?.connected && gameId) {
      let done = false;
      const t = setTimeout(() => {
        if (!done) {
          done = true;
          onFail('Start round timed out. Try again.');
        }
      }, 15000);
      socket.emit('start-custom-round', { gameId, category: categoryTrim, word: wordTrim }, (res) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        setSubmitting(false);
        if (res?.ok && res?.hostRoundReady) {
          onSuccess(res);
        } else {
          onFail(res?.error || 'Failed to start round.');
        }
      });
      return;
    }

    api.customRound(gameId, code, playerName, categoryTrim, wordTrim)
      .then(onSuccess)
      .catch((err) => onFail(err?.message))
      .finally(() => setSubmitting(false));
  };

  const handleAutoGenerate = () => {
    if (submitting || !socket?.connected || !gameId) return;
    if (allPlayersCount < 4) {
      onError?.('Need at least 4 players for auto-generate (you play too).');
      return;
    }
    setSubmitting(true);
    onClearError?.();
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        setSubmitting(false);
        onError?.('Start round timed out. Try again.');
      }
    }, 15000);
    socket.emit('start-custom-random-round', { gameId }, (res) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      setSubmitting(false);
      if (res?.ok) {
        onRoundStarted?.();
      } else {
        onError?.(res?.error || 'Failed to start round.');
      }
    });
  };

  return (
    <div className="host-setup">
      <h2 className="host-setup__title">Choose Round Type</h2>
      <p className="host-setup__hint">Pick a custom word (you observe) or auto-generate (you play).</p>

      <div className="host-setup__section">
        <h3 className="host-setup__subtitle">Custom word</h3>
        <p className="host-setup__players">{playingCount} player{playingCount !== 1 ? 's' : ''} will play (you observe)</p>

      {error && (
        <p className="host-setup__error" role="alert">
          {error}
          {onClearError && (
            <button type="button" className="host-setup__error-dismiss" onClick={onClearError} aria-label="Dismiss">
              ✕
            </button>
          )}
        </p>
      )}

      <form className="host-setup__form" onSubmit={handleStartRound}>
        <label className="host-setup__label">
          Category
          <input
            type="text"
            className="host-setup__input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Famous People"
            maxLength={100}
            required
          />
        </label>

        <label className="host-setup__label">
          Word
          <input
            type="text"
            className="host-setup__input"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="e.g. Taylor Swift"
            maxLength={100}
            required
          />
        </label>

        <button
          type="submit"
          className="btn btn--primary host-setup__submit"
          disabled={!wordTrim || !categoryTrim || submitting || playingCount < 1}
        >
          {submitting ? 'Starting…' : 'Start Round'}
        </button>
        {playingCount < 1 && (
          <p className="host-setup__need">Need at least 1 other player.</p>
        )}
      </form>
      </div>

      <div className="host-setup__divider">— or —</div>

      <div className="host-setup__section">
        <h3 className="host-setup__subtitle">Auto generate word</h3>
        <p className="host-setup__hint host-setup__hint--muted">Random word from the list. You play this round!</p>
        <button
          type="button"
          className="btn btn--secondary host-setup__auto"
          onClick={handleAutoGenerate}
          disabled={submitting || allPlayersCount < 4}
        >
          {submitting ? 'Starting…' : 'Auto Generate'}
        </button>
        {allPlayersCount < 4 && (
          <p className="host-setup__need">Need at least 4 players (including you).</p>
        )}
      </div>

      <button type="button" className="btn btn--ghost host-setup__back" onClick={onBackToLobby}>
        Back to Lobby
      </button>
    </div>
  );
}

export default HostSetup;
