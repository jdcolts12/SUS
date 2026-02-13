import { useState, useEffect } from 'react';

function YourWord({
  word,
  turnOrderText,
  turnOrder,
  totalPlayers,
  isImposter,
  roundVariant,
  onNewRound,
  isHost,
  onBackToLobby,
  players = [],
  playerId,
  votePhase,
  votedCount,
  revealData,
  onStartVote,
  onSubmitVote,
  onRevealImposter,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [noImposterSelected, setNoImposterSelected] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setNoImposterSelected(false);
    setHasSubmitted(false);
  }, [votePhase, word]);

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
    setHasSubmitted(true);
    if (noImposterSelected) {
      onSubmitVote?.([], true);
    } else {
      onSubmitVote?.(selectedIds, false);
    }
  };

  const getHint = () => {
    if (roundVariant === 'no_imposter') {
      return "Everyone has the same word! Describe it together—no one to catch.";
    }
    if (isImposter) {
      return roundVariant === 'two_imposters'
        ? "You're one of 2 imposters! You know the category but not the word. Blend in—you have an ally!"
        : "You know the category but not the word. Describe vaguely and blend in!";
    }
    return roundVariant === 'two_imposters'
      ? "There are 2 imposters this round. Describe your word and listen for who might be faking."
      : "Describe your word without saying it. Listen for who might be faking.";
  };

  const getLabel = () => {
    if (roundVariant === 'no_imposter') return "Your word";
    if (isImposter) return roundVariant === 'two_imposters' ? "You're an imposter (1 of 2)" : "You're the imposter";
    return "Your word";
  };

  const otherPlayers = players.filter((p) => p.id !== playerId);
  const everyoneVoted = votedCount >= totalPlayers && totalPlayers > 0;

  return (
    <div className="word">
      {votePhase === 'revealed' && revealData ? (
        <div className="word__reveal">
          <h2 className="word__reveal-title">The Imposter{revealData.imposterNames?.length > 1 ? 's' : ''} was...</h2>
          <p className="word__reveal-names">
            {revealData.imposterNames?.join(' & ') || 'Unknown'}
          </p>
          {revealData.votedPlayerName && (
            <p className="word__reveal-voted">
              You voted out: {revealData.votedPlayerName}
            </p>
          )}
          <p className={`word__reveal-result ${revealData.teamWon ? 'word__reveal-result--win' : 'word__reveal-result--loss'}`}>
            {revealData.teamWon ? 'Team wins!' : 'Imposter wins!'}
          </p>
        </div>
      ) : (
        <>
          <div className="word__turn">
            {turnOrderText} of {totalPlayers}
          </div>
          <div className={`word__card ${isImposter ? 'word__card--imposter' : ''} ${roundVariant === 'no_imposter' ? 'word__card--no-imposter' : ''}`}>
            <div className="word__label">{getLabel()}</div>
            <div className="word__value">{word}</div>
          </div>
          <p className="word__hint">{getHint()}</p>
        </>
      )}

      {/* Host: Start voting (before vote phase) */}
      {isHost && roundVariant !== 'no_imposter' && !votePhase && (
        <button className="btn btn--primary" onClick={onStartVote}>
          Vote on Imposter
        </button>
      )}

      {/* All players: Voting UI */}
      {votePhase === 'voting' && roundVariant !== 'no_imposter' && (
        <div className="word__vote">
          <h4>Who do you think is the imposter?</h4>
          <p className="word__vote-hint">Tap multiple names or &quot;No imposter&quot;</p>
          {hasSubmitted ? (
            <div className="word__vote-waiting">
              <p>Waiting for others... {votedCount}/{totalPlayers} voted</p>
              {isHost && everyoneVoted && (
                <button className="btn btn--primary" onClick={onRevealImposter}>
                  Reveal Imposter
                </button>
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
        {isHost && (votePhase === 'revealed' || roundVariant === 'no_imposter') && (
          <button className="btn btn--secondary" onClick={onNewRound}>
            New Round
          </button>
        )}
        <button className="btn btn--ghost" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

export default YourWord;
