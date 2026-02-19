function Lobby({ code, players, isHost, isCustom, onStartGame, error }) {
  const shareUrl = typeof navigator !== 'undefined' && navigator.share
    ? () => {
        navigator.share({
          title: 'Join my Imposter game!',
          text: `Join my Imposter game! Code: ${code}`,
          url: window.location.href,
        });
      }
    : null;

  const copyCode = () => {
    navigator.clipboard?.writeText(code);
    // Could add a "Copied!" toast
  };

  return (
    <div className="lobby">
      <h2 className="lobby__title">Lobby</h2>
      <div className="lobby__code">
        <span className="lobby__code-label">Room code</span>
        <span className="lobby__code-value">{code}</span>
        <div className="lobby__code-buttons">
          <button className="btn btn--small" onClick={copyCode}>
            Copy
          </button>
          {shareUrl && (
            <button className="btn btn--small" onClick={shareUrl}>
              Share
            </button>
          )}
        </div>
      </div>

      <div className="lobby__players">
        <h3>Players ({players.length})</h3>
        <ul>
          {players.map((p, i) => (
            <li key={p.id}>{p.name} {i === 0 && '(host)'}</li>
          ))}
        </ul>
      </div>

      {isCustom ? (
        <>
          {players.length < 3 && (
            <p className="lobby__need">Custom games need at least 3 players (host + 2 players)</p>
          )}
          {players.length >= 10 && (
            <p className="lobby__need">Room full (max 10 players)</p>
          )}
        </>
      ) : (
        <>
          {players.length < 4 && (
            <p className="lobby__need">Need at least 4 players to start</p>
          )}
          {players.length >= 10 && (
            <p className="lobby__need">Room full (max 10 players)</p>
          )}
        </>
      )}

      {isHost && (
        <button
          className="btn btn--primary lobby__start"
          onClick={onStartGame}
          disabled={
            isCustom
              ? (players.length < 3 || players.length > 10)
              : (players.length < 4 || players.length > 10)
          }
        >
          {isCustom ? 'Start Game (Pick Word)' : 'Start Game'}
        </button>
      )}

      {!isHost && (
        <p className="lobby__waiting">Waiting for host to start...</p>
      )}

      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}

export default Lobby;
