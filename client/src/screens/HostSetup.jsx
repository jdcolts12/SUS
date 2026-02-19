import { useState, useEffect } from 'react';
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
}) {
  const [categories, setCategories] = useState([]);
  const [words, setWords] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWord, setSelectedWord] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getCategories()
      .then((data) => {
        setCategories(data.categories || []);
        setWords(data.words || {});
        if (data.categories?.length) {
          setSelectedCategory(data.categories[0]);
        }
      })
      .catch((err) => {
        onClearError?.();
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSelectedWord('');
  }, [selectedCategory]);

  const availableWords = words[selectedCategory] || [];
  const playingCount = Math.max(0, (players?.length || 1) - 1);

  const handleStartRound = (e) => {
    e.preventDefault();
    if (!selectedCategory || !selectedWord || submitting) return;
    setSubmitting(true);
    onClearError?.();
    api.customRound(gameId, code, playerName, selectedCategory, selectedWord)
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

  if (loading) {
    return (
      <div className="host-setup">
        <p className="host-setup__loading">Loading categories…</p>
      </div>
    );
  }

  return (
    <div className="host-setup">
      <h2 className="host-setup__title">Custom Round</h2>
      <p className="host-setup__hint">Pick the category and word for this round. You won&apos;t play—you&apos;re the host.</p>
      <p className="host-setup__players">{playingCount} player{playingCount !== 1 ? 's' : ''} will play</p>

      <form className="host-setup__form" onSubmit={handleStartRound}>
        <label className="host-setup__label">
          Category
          <select
            className="host-setup__select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            required
          >
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="host-setup__label">
          Word
          <select
            className="host-setup__select"
            value={selectedWord}
            onChange={(e) => setSelectedWord(e.target.value)}
            required
            disabled={!selectedCategory}
          >
            <option value="">— Select —</option>
            {availableWords.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="btn btn--primary host-setup__submit"
          disabled={!selectedWord || submitting || playingCount < 2}
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
