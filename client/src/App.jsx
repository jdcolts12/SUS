import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import YourWord from './screens/YourWord';

// In dev: use same host as page (so phone at 192.168.x.x:5173 connects to 192.168.x.x:3001)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001` : window.location.origin);

function App() {
  const [screen, setScreen] = useState('home');
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    code: null,
    gameId: null,
    playerId: null,
    players: [],
    isHost: false,
  });
  const [playerName, setPlayerName] = useState('');
  const [wordData, setWordData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = io(SOCKET_URL, { autoConnect: false });
    setSocket(s);

    s.on('game-created', ({ code, gameId, playerId, players }) => {
      setGameState({
        code,
        gameId,
        playerId,
        players,
        isHost: true,
      });
      setScreen('lobby');
    });

    s.on('joined-game', ({ gameId, playerId, players }) => {
      setGameState((prev) => ({
        ...prev,
        gameId,
        playerId,
        players,
        isHost: false,
      }));
      setScreen('lobby');
    });

    s.on('join-error', ({ message }) => {
      setError(message);
    });

    s.on('player-joined', ({ players }) => {
      setGameState((prev) => ({ ...prev, players }));
    });

    s.on('player-left', ({ players }) => {
      setGameState((prev) => ({ ...prev, players }));
    });

    s.on('your-word', (data) => {
      setWordData({
        ...data,
        roundVariant: data.roundVariant || 'normal',
      });
      setScreen('word');
    });

    s.on('game-started', () => {
      // Word is sent separately via your-word
    });

    s.on('round-started', () => {
      // New round - word will come via your-word
    });

    s.on('start-error', ({ message }) => {
      setError(message);
    });

    return () => s.disconnect();
  }, []);

  const createGame = (name) => {
    setError('');
    setPlayerName(name);
    socket.connect();
    socket.emit('create-game', { playerName: name });
  };

  const joinGame = (code, name) => {
    setError('');
    setPlayerName(name);
    socket.connect();
    socket.emit('join-game', { code: code.toUpperCase().trim(), playerName: name });
  };

  const startGame = () => {
    socket.emit('start-game', { gameId: gameState.gameId });
  };

  const newRound = () => {
    socket.emit('new-round', { gameId: gameState.gameId });
  };

  const backToLobby = () => {
    setWordData(null);
    setScreen('lobby');
  };

  if (screen === 'home') {
    return (
      <Home
        onCreateGame={createGame}
        onJoinGame={joinGame}
        error={error}
      />
    );
  }

  if (screen === 'lobby') {
    return (
      <Lobby
        code={gameState.code}
        players={gameState.players}
        isHost={gameState.isHost}
        playerName={playerName}
        onStartGame={startGame}
        error={error}
      />
    );
  }

  if (screen === 'word' && wordData) {
    return (
      <YourWord
        word={wordData.word}
        turnOrderText={wordData.turnOrderText}
        turnOrder={wordData.turnOrder}
        totalPlayers={wordData.totalPlayers}
        isImposter={wordData.isImposter}
        roundVariant={wordData.roundVariant || 'normal'}
        onNewRound={newRound}
        isHost={gameState.isHost}
        onBackToLobby={backToLobby}
      />
    );
  }

  return null;
}

export default App;
