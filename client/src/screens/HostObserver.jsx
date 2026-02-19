import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

function HostObserver({
  category,
  word,
  totalPlayers,
  players,
  playerId,
  gameId,
  gameCode,
  playerName,
  votePhase,
  votedCount,
  revealData,
  onStartVote,
  isStartingVote,
  isCustom,
  onRevealImposter,
  onNewRound,
  onNewCustomRound,
  onBackToLobby,
  error,
  onClearError,
  onRetryConnection,
  socket,
}) {
  const [isRevealing, setIsRevealing] = useState(false);
  const revealLastFired = useRef(0);
  const revealDoneRef = useRef(false);

  const everyoneVoted = votedCount >= totalPlayers && totalPlayers > 0;
  const otherPlayers = players.filter((p) => p.id !== playerId);

  useEffect(() => {
    if (votePhase === 'revealed' && revealData) {
      revealDoneRef.current = true;
      setIsRevealing(false);
    }
  }, [revealData, votePhase]);

  const handleReveal = () => {
    if (isRevealing) return;
    const now = Date.now();
    if (now - revealLastFired.current < 300) return;
    revealLastFired.current = now;
    onRetryConnection?.();
    setIsRevealing(true);
    revealDoneRef.current = false;

    const handleResult = (response) => {
      if (revealDoneRef.current) return;
      revealDoneRef.current = true;
      setIsRevealing(false);
      if (response?.error) {
        onClearError?.(response.error);
      } else if (response?.ok || response?.imposterNames !== undefined) {
        onClearError?.();
      }
    };

    socket?.once('reveal-result', handleResult);
    socket?.once('imposter-revealed', (data) => handleResult({ ok: true, ...data }));
    if (socket?.connected) socket.emit('reveal-imposter', { gameId });

    api.revealImposter(gameId, gameCode, playerName)
      .then(handleResult)
      .catch((err) => {
        if (revealDoneRef.current) return;
        setIsRevealing(false);
        onClearError?.(err?.message || 'Reveal failed. Tap again.');
      });
  };

  return (
    <div className="host-observer">
      {error && (
        <p className="host-observer__error" role="alert">
          {error}
          {onClearError && (
            <button type="button" className="host-observer__dismiss" onClick={onClearError} aria-label="Dismiss">
              ✕
            </button>
          )}
        </p>
      )}

      <h2 className="host-observer__title">You&apos;re the host</h2>
      <div className="host-observer__card">
        <p className="host-observer__label">Category</p>
        <p className="host-observer__value">{category}</p>
        <p className="host-observer__label">Word</p>
        <p className="host-observer__value">{word}</p>
      </div>
      <p className="host-observer__hint">Players are playing. Start the vote when everyone is done describing.</p>

      {votePhase !== 'voting' && !revealData && (
        <div className="host-observer__vote-start">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onStartVote}
            disabled={!!isStartingVote}
          >
            {isStartingVote ? 'Starting vote…' : 'Start Vote'}
          </button>
        </div>
      )}

      {votePhase === 'voting' && (
        <div className="host-observer__voting">
          <p>Votes: {votedCount}/{totalPlayers}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleReveal}
            disabled={isRevealing}
          >
            {isRevealing ? 'Revealing…' : everyoneVoted ? 'Reveal Imposter' : `Reveal (${votedCount}/${totalPlayers})`}
          </button>
        </div>
      )}

      {revealData && (
        <div className="host-observer__recap">
          <h3>Round Over</h3>
          {revealData.noImposterRound ? (
            <p className="host-observer__result">No imposter – crew wins!</p>
          ) : (
            <p className="host-observer__result">
              {revealData.imposterNames?.join(' & ')} {revealData.teamWon ? '– Crew wins!' : revealData.survivingImposterName ? `– ${revealData.survivingImposterName} wins!` : '– Imposter wins!'}
            </p>
          )}
        </div>
      )}

      <div className="host-observer__actions">
        {revealData && (
          <>
            <button type="button" className="btn btn--primary" onClick={onNewRound}>
              New Round
            </button>
            {/* In custom games, New Round and New Custom Round both go to host-setup; show both for normal games */}
            {!isCustom && (
              <button type="button" className="btn btn--secondary" onClick={onNewCustomRound}>
                New Custom Round
              </button>
            )}
          </>
        )}
        <button type="button" className="btn btn--ghost" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

export default HostObserver;
