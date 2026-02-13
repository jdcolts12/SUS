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
}) {
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

  return (
    <div className="word">
      <div className="word__turn">
        {turnOrderText} of {totalPlayers}
      </div>
      <div className={`word__card ${isImposter ? 'word__card--imposter' : ''} ${roundVariant === 'no_imposter' ? 'word__card--no-imposter' : ''}`}>
        <div className="word__label">{getLabel()}</div>
        <div className="word__value">{word}</div>
      </div>
      <p className="word__hint">
        {getHint()}
      </p>
      <div className="word__actions">
        {isHost && (
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
