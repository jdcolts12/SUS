import { useState, useEffect } from 'react';
import { api } from '../api';

function formatPct(val) {
  if (val === null || val === undefined) return '—';
  return `${val}%`;
}

function Leaderboard({ onBack }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getLeaderboard()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="leaderboard"><p>Loading...</p></div>;
  if (error) {
    return (
      <div className="leaderboard">
        <p className="leaderboard__error">{error}</p>
        <button className="btn" onClick={onBack}>← Back</button>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard__top">
        <button className="btn btn--ghost" onClick={onBack}>← Back</button>
      </div>
      <h1 className="leaderboard__title">Leaderboard</h1>
      <p className="leaderboard__subtitle">Players with at least 1 game played</p>

      {list.length === 0 ? (
        <p className="leaderboard__empty">No players yet. Play some games to appear here!</p>
      ) : (
        <div className="leaderboard__table-wrap">
          <table className="leaderboard__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Crew Win %</th>
                <th>Imposter Win %</th>
                <th>Correct Vote %</th>
                <th>Games</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, i) => (
                <tr key={row.id}>
                  <td className="leaderboard__rank">{i + 1}</td>
                  <td className="leaderboard__name">{row.username}</td>
                  <td>{formatPct(row.crewWinPct)}</td>
                  <td>{formatPct(row.imposterWinPct)}</td>
                  <td>{formatPct(row.correctVotePct)}</td>
                  <td className="leaderboard__games">{row.gamesPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
