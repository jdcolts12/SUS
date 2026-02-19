import { useState } from 'react';
import { api } from '../api';

function HostSetup({
  gameId,
  code,
  playerName,
  players,
  onRoundStarted,
  onBackToLobby,
  error,
  onClearError,
  onError,
}) {
  const [category, setCategory] = useState('');
  const [word, setWord] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const playingCount = Math.max(0, (players?.length || 1) - 1);
  const categoryTrim = category?.trim() || '';
  const wordTrim = word?.trim() || '';

  const handleStartRound = (e) => {
    e.preventDefault();
    if (!categoryTrim || !wordTrim || submitting) return;
    setSubmitting(true);
    onClearError?.();
    api.customRound(gameId, code, playerName, categoryTrim, wordTrim)
      .then(() => {
        onRoundStarted?.();
      })
      .catch((err) => {
        setSubmitting(false);
        const msg = err?.message || 'Failed to start round.';
        onError?.(msg);
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="host-setup">
      <h2 className="host-setup__title">Custom Round</h2>
      <p className="host-setup__hint">Type the category and word for this round. You won&apos;t play—you&apos;re the host.</p>
      <p className="host-setup__players">{playingCount} player{playingCount !== 1 ? 's' : ''} will play</p>

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
          disabled={!wordTrim || !categoryTrim || submitting || playingCount < 2}
        >
          {submitting ? 'Starting…' : 'Start Round'}
        </button>
      </form>

      {playingCount < 2 && (
        <p className="host-setup__need">Need at least 2 players (excluding you) to start a round.</p>
      )}

      <button type="button" className="btn btn--ghost host-setup__back" onClick={onBackToLobby}>
        Back to Lobby
      </button>
    </div>
  );
}

export default HostSetup;
