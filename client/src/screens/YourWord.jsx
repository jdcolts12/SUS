import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

function YourWord({
  word,
  turnOrderText,
  turnOrder,
  totalPlayers,
  isImposter,
  roundVariant,
  onNewRound,
  isHost,
  isCustom,
  hostId,
  onBackToLobby,
  players = [],
  playerId,
  votePhase,
  votedCount,
  revealData,
  onStartVote,
  isStartingVote,
  onSubmitVote,
  socket,
  gameId,
  gameCode,
  playerName,
  apiUrl,
  onRevealError,
  onRevealSuccess,
  error,
  onClearError,
  onRetryConnection,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [noImposterSelected, setNoImposterSelected] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showRevealPopup, setShowRevealPopup] = useState(true);
  const [isRevealing, setIsRevealing] = useState(false);
  const [voteWindowMinsLeft, setVoteWindowMinsLeft] = useState(30);
  const revealLastFired = useRef(0);
  const revealTimeoutRef = useRef(null);
  const revealRetryRef = useRef(null);
  const revealDoneRef = useRef(false);
  const retryIdsRef = useRef([]);
  const roundStartTimeRef = useRef(Date.now());

  useEffect(() => {
    roundStartTimeRef.current = Date.now();
  }, [word]);

  useEffect(() => {
    if (!isHost || votePhase === 'voting' || revealData) return;
    const tick = () => {
      const elapsed = (Date.now() - roundStartTimeRef.current) / 1000 / 60;
      const left = Math.max(0, Math.ceil(30 - elapsed));
      setVoteWindowMinsLeft(left);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [isHost, votePhase, revealData]);

  useEffect(() => {
    setSelectedIds([]);
    setNoImposterSelected(false);
    setHasSubmitted(false);
  }, [votePhase, word]);

  useEffect(() => {
    if (isRevealing) {
      const t = setTimeout(() => {
        setIsRevealing(false);
        if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
        retryIdsRef.current.forEach(clearTimeout);
        retryIdsRef.current = [];
      }, 90000);
      return () => clearTimeout(t);
    }
  }, [isRevealing]);

  useEffect(() => {
    if (votePhase === 'revealed' && revealData) {
      revealDoneRef.current = true;
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
      if (revealRetryRef.current) {
        clearTimeout(revealRetryRef.current);
        revealRetryRef.current = null;
      }
      retryIdsRef.current.forEach(clearTimeout);
      retryIdsRef.current = [];
      setShowRevealPopup(true);
      setIsRevealing(false);
    }
  }, [revealData, votePhase]);

  const togglePlayer = (id) => {
    if (hasSubmitted) return;
    if (noImposterSelected) {
      setNoImposterSelected(false);
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleNoImposter = () => {
    if (hasSubmitted) return;
    setNoImposterSelected((prev) => !prev);
    if (!noImposterSelected) setSelectedIds([]);
  };

  const handleSubmitVote = () => {
    if (hasSubmitted) return;
    onRetryConnection?.();
    setHasSubmitted(true);
    const promise = noImposterSelected
      ? onSubmitVote?.([], true, players)
      : onSubmitVote?.(selectedIds, false, players);
    promise?.catch?.((err) => {
      setHasSubmitted(false);
      onRevealError?.(err?.message || 'Vote failed.');
    });
  };

  const getHint = () => {
    if (isImposter) {
      return "You know the category but not the word. Describe vaguely and blend in!";
    }
    return "Describe your word without saying it. Listen for who might be faking.";
  };

  const getLabel = () => {
    if (roundVariant === 'no_imposter') return "Your word";
    if (isImposter) return "You're the imposter";
    return "Your word";
  };

  const otherPlayers = players.filter((p) =>
    p.id !== playerId && (!isCustom || p.id !== hostId)
  );
  const everyoneVoted = votedCount >= totalPlayers && totalPlayers > 0;

  const handleRevealImposter = () => {
    if (isRevealing) return;
    const now = Date.now();
    if (now - revealLastFired.current < 300) return;
    revealLastFired.current = now;
    onRetryConnection?.();
    let gid = gameId;
    let gc = gameCode;
    let pn = playerName;
    if (!gid || !gc || !pn) {
      try {
        const raw = sessionStorage.getItem('sus_game');
        const saved = raw ? JSON.parse(raw) : {};
        const savedName = sessionStorage.getItem('sus_playerName');
        if (!gid && saved?.gameId) gid = saved.gameId;
        if (!gc && saved?.code) gc = saved.code;
        if (!pn && savedName) pn = savedName;
      } catch (_) {}
    }
    if (!gid || !gc || !pn) {
      onRevealError?.('Missing game info. Go back to lobby and rejoin.');
      return;
    }
    setIsRevealing(true);
    revealDoneRef.current = false;

    const clearAll = () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
      if (revealRetryRef.current) {
        clearTimeout(revealRetryRef.current);
        revealRetryRef.current = null;
      }
      retryIdsRef.current.forEach(clearTimeout);
      retryIdsRef.current = [];
    };

    const handleResult = (response) => {
      if (revealDoneRef.current) return;
      revealDoneRef.current = true;
      clearAll();
      setIsRevealing(false);
      if (response?.error) {
        onRevealError?.(response.error);
      } else if (response?.ok || response?.imposterNames !== undefined || response?.category !== undefined || response?.noImposterRound !== undefined) {
        onClearError?.();
        const { ok, error: _, ...payload } = response;
        onRevealSuccess?.(payload);
      }
    };

    socket?.once('reveal-result', handleResult);
    socket?.once('imposter-revealed', (data) => handleResult({ ok: true, ...data }));
    if (socket?.connected) socket.emit('reveal-imposter', { gameId: gid });

    const tryHttp = () => {
      if (revealDoneRef.current) return;
      api.revealImposter(gid, gc, pn)
        .then(handleResult)
        .catch((err) => {
          if (revealDoneRef.current) return;
          clearAll();
          setIsRevealing(false);
          onRevealError?.(err?.message || 'Reveal failed. Tap Cancel and try again.');
        });
    };

    tryHttp();
    [5000, 11000, 17000].forEach((ms) => {
      retryIdsRef.current.push(setTimeout(() => {
        if (revealDoneRef.current) return;
        tryHttp();
      }, ms));
    });
    revealTimeoutRef.current = setTimeout(() => {
      if (revealDoneRef.current) return;
      clearAll();
      setIsRevealing(false);
      onRevealError?.('Still connecting. Tap Cancel, then try again.');
    }, 60000);
  };

  return (
    <div className="word">
      {error && (
        <p className="word__error" role="alert">
          {error}
          {onClearError && (
            <button type="button" className="word__error-dismiss" onClick={onClearError} aria-label="Dismiss">
              ✕
            </button>
          )}
        </p>
      )}
      {votePhase === 'revealed' && revealData ? (
        <>
          {showRevealPopup ? (
            <div className="word__popup-overlay" role="dialog" aria-modal="true">
              <div className="word__popup">
                {revealData.noImposterRound ? (
                  <>
                    <h2 className="word__reveal-title">There was no imposter!</h2>
                    <p className="word__reveal-names">
                      Everyone had the same word.
                    </p>
                    {revealData.votedPlayerName && (
                      <p className="word__reveal-voted">
                        The group voted out: {revealData.votedPlayerName}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="word__reveal-title">
                      {revealData.imposterNames?.length > 1
                        ? 'The imposters were'
                        : 'The imposter was'}
                    </h2>
                    <p className="word__reveal-names">
                      {revealData.imposterNames?.join(' & ') || 'Unable to determine'}
                    </p>
                    {revealData.votedPlayerName && (
                      <p className="word__reveal-voted">
                        You voted out: {revealData.votedPlayerName}
                      </p>
                    )}
                    <p className={`word__reveal-result ${revealData.teamWon ? 'word__reveal-result--win' : 'word__reveal-result--loss'}`}>
                      {revealData.teamWon
                        ? 'Crew wins!'
                        : revealData.voteTied
                          ? (revealData.teamWon ? 'Tie! Crew wins!' : 'Tie! Imposters win!')
                          : (() => {
                              const names = revealData.imposterNames?.filter(Boolean) || [];
                              const text = names.join(' & ') || 'The imposters';
                              return names.length === 1 ? `${text} wins!` : `${text} win!`;
                            })()}
                    </p>
                  </>
                )}
                <button className="btn btn--primary" onClick={() => setShowRevealPopup(false)}>
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="word__recap">
              <h2 className="word__recap-title">Game Recap</h2>
              <div className="word__recap-stats">
                {revealData.noImposterRound ? (
                  <p className="word__recap-winner word__recap-winner--crew">
                    Crew wins! (No imposter this round)
                  </p>
                ) : (
                  <p className={`word__recap-winner ${revealData.teamWon ? 'word__recap-winner--crew' : 'word__recap-winner--imposter'}`}>
                    {revealData.teamWon
                      ? 'Crew wins!'
                      : revealData.voteTied
                        ? (revealData.teamWon ? 'Tie! Crew wins!' : 'Tie! Imposters win!')
                        : (() => {
                            const names = revealData.imposterNames?.filter(Boolean) || [];
                            const text = names.join(' & ') || 'The imposters';
                            return names.length === 1 ? `${text} wins!` : `${text} win!`;
                          })()}
                  </p>
                )}
                {revealData.category && (
                  <p className="word__recap-row">
                    <span className="word__recap-label">Category</span>
                    <span className="word__recap-value">{revealData.category}</span>
                  </p>
                )}
                {revealData.word && (
                  <p className="word__recap-row">
                    <span className="word__recap-label">Word</span>
                    <span className="word__recap-value">{revealData.word}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="word__turn">
            {turnOrderText} of {totalPlayers}
          </div>
          <div className={`word__card ${isImposter ? 'word__card--imposter' : ''}`}>
            <div className="word__label">{getLabel()}</div>
            <div className="word__value">{word}</div>
          </div>
          <p className="word__hint">{getHint()}</p>
        </>
      )}

      {/* Host: Start voting (before vote phase) - guaranteed visible for 30 min */}
      {isHost && (() => {
        const msSinceStart = Date.now() - roundStartTimeRef.current;
        const within30Min = msSinceStart < 30 * 60 * 1000;
        const show = !revealData && (!votePhase || (within30Min && votePhase !== 'voting'));
        return show ? (
          <div className="word__vote-on-imposter">
            <button
              className="btn btn--primary"
              onClick={onStartVote}
              disabled={!!isStartingVote}
            >
              {isStartingVote ? 'Starting vote…' : 'Vote on Imposter'}
            </button>
            {voteWindowMinsLeft > 0 && (
              <p className="word__vote-timer">Available for {voteWindowMinsLeft} min</p>
            )}
          </div>
        ) : null;
      })()}

      {/* All players: Voting UI */}
      {votePhase === 'voting' && (
        <div className="word__vote">
          <h4>Who do you think is the imposter?</h4>
          <p className="word__vote-hint">Tap multiple names or &quot;No imposter&quot;</p>
          {hasSubmitted ? (
            <div className="word__vote-waiting">
              <p>Waiting for others... {votedCount}/{totalPlayers} voted</p>
              {isHost && (
                <div className="word__reveal-row">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleRevealImposter}
                    disabled={isRevealing}
                  >
                    {isRevealing ? 'Revealing…' : everyoneVoted ? 'Reveal Imposter' : `Reveal (${votedCount}/${totalPlayers})`}
                  </button>
                  {isRevealing && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        revealDoneRef.current = true;
                        if (revealTimeoutRef.current) {
                          clearTimeout(revealTimeoutRef.current);
                          revealTimeoutRef.current = null;
                        }
                        if (revealRetryRef.current) {
                          clearTimeout(revealRetryRef.current);
                          revealRetryRef.current = null;
                        }
                        retryIdsRef.current.forEach(clearTimeout);
                        retryIdsRef.current = [];
                        setIsRevealing(false);
                        onClearError?.();
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="word__vote-buttons">
                {otherPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn btn--small word__vote-btn ${selectedIds.includes(p.id) ? 'word__vote-btn--selected' : ''}`}
                    onClick={() => togglePlayer(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn btn--small word__vote-btn word__vote-btn--no-imposter ${noImposterSelected ? 'word__vote-btn--selected' : ''}`}
                  onClick={toggleNoImposter}
                >
                  No imposter
                </button>
              </div>
              <button
                className="btn btn--primary"
                onClick={handleSubmitVote}
              >
                Submit Vote
              </button>
            </>
          )}
        </div>
      )}

      <div className="word__actions">
        {isHost && votePhase === 'revealed' && (
          <button type="button" className="btn btn--secondary" onClick={onNewRound}>
            New Round
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

export default YourWord;
