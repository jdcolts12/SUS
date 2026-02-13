import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import YourWord from './screens/YourWord';
import Profile from './screens/Profile';
import EditProfile from './screens/EditProfile';
import Friends from './screens/Friends';
import SignUp from './screens/SignUp';

// In dev: use same host as page (so phone at 192.168.x.x:5173 connects to 192.168.x.x:3001)
// In prod: MUST set VITE_SOCKET_URL to your Railway server URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001` : window.location.origin);

function App() {
  const [screen, setScreen] = useState('home');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
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
  const [votePhase, setVotePhase] = useState(null);
  const [votedCount, setVotedCount] = useState(0);
  const [revealData, setRevealData] = useState(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const url = SOCKET_URL.replace(/\/$/, ''); // no trailing slash
    const s = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    setSocket(s);

    s.on('connect_error', (err) => {
      setConnecting(false);
      const isProd = !import.meta.env.DEV;
      const hasSocketUrl = !!import.meta.env.VITE_SOCKET_URL;
      let msg;
      if (isProd && !hasSocketUrl) {
        msg = "Server URL not configured. In Vercel: Settings → Environment Variables → Add VITE_SOCKET_URL = your Railway URL (e.g. https://sus-xxx.up.railway.app) → Redeploy.";
      } else if (isProd) {
        const host = url.replace(/^https?:\/\//, '').split('/')[0] || 'server';
        msg = `Can't reach server at ${host}. Verify: 1) Railway shows green/deployed 2) Open that URL/health in a new tab — should show {"ok":true} 3) VITE_SOCKET_URL in Vercel matches exactly 4) Redeployed after setting it.`;
      } else {
        msg = "Can't reach game server. Run 'npm run dev:server' in another terminal.";
      }
      setError(msg);
      console.error('Socket connection failed:', err.message, 'URL:', url);
    });

    s.on('connect', () => {
      setConnecting(false);
      setError('');
    });

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
      setVotePhase(null);
      setRevealData(null);
      setScreen('word');
    });

    s.on('vote-started', () => {
      setVotePhase('voting');
      setVotedCount(0);
    });

    s.on('vote-received', ({ votedCount: n, totalPlayers }) => {
      setVotedCount(n);
    });

    s.on('imposter-revealed', (data) => {
      setVotePhase('revealed');
      setRevealData(data);
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
    if (!socket) {
      setError('Loading... try again in a moment.');
      return;
    }
    setError('');
    setPlayerName(name);
    setConnecting(true);
    socket.connect();
    socket.emit('create-game', { playerName: name, userId: userId || undefined });
  };

  const joinGame = (code, name) => {
    if (!socket) {
      setError('Loading... try again in a moment.');
      return;
    }
    setError('');
    setPlayerName(name);
    setConnecting(true);
    socket.connect();
    socket.emit('join-game', { code: code.toUpperCase().trim(), playerName: name, userId: userId || undefined });
  };

  const startGame = () => {
    socket.emit('start-game', { gameId: gameState.gameId });
  };

  const newRound = () => {
    socket.emit('new-round', { gameId: gameState.gameId });
  };

  const backToLobby = () => {
    setWordData(null);
    setVotePhase(null);
    setRevealData(null);
    setScreen('lobby');
  };

  const startVote = () => {
    if (socket && gameState.gameId) {
      socket.emit('start-vote', { gameId: gameState.gameId });
    }
  };

  const submitVote = (votedPlayerIds, noImposter) => {
    if (socket && gameState.gameId) {
      socket.emit('submit-vote', {
        gameId: gameState.gameId,
        votedPlayerIds: noImposter ? [] : votedPlayerIds,
        noImposter: !!noImposter,
      });
    }
  };

  const revealImposter = () => {
    if (socket && gameState.gameId) {
      socket.emit('reveal-imposter', { gameId: gameState.gameId });
    }
  };

  if (screen === 'profile' && userId) {
    return (
      <Profile
        userId={userId}
        onEditProfile={() => setScreen('edit-profile')}
        onFriends={() => setScreen('friends')}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'edit-profile' && userId) {
    return (
      <EditProfile
        userId={userId}
        onSaved={() => setScreen('profile')}
        onBack={() => setScreen('profile')}
      />
    );
  }

  if (screen === 'friends' && userId) {
    return <Friends userId={userId} onBack={() => setScreen('profile')} />;
  }

  if (screen === 'signup') {
    return (
      <SignUp
        onSignedUp={(id) => { setUserId(id); setScreen('home'); }}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'home') {
    return (
      <Home
        userId={userId}
        onCreateGame={createGame}
        onJoinGame={joinGame}
        onProfile={() => setScreen('profile')}
        onSignUp={() => setScreen('signup')}
        error={error}
        connecting={connecting}
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
        players={gameState.players}
        playerId={gameState.playerId}
        votePhase={votePhase}
        votedCount={votedCount}
        revealData={revealData}
        onStartVote={startVote}
        onSubmitVote={submitVote}
        onRevealImposter={revealImposter}
      />
    );
  }

  return null;
}

export default App;
