import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import YourWord from './screens/YourWord';
import HostSetup from './screens/HostSetup';
import HostObserver from './screens/HostObserver';
import Profile from './screens/Profile';
import EditProfile from './screens/EditProfile';
import Friends from './screens/Friends';
import SignUp from './screens/SignUp';
import SignIn from './screens/SignIn';
import Leaderboard from './screens/Leaderboard';
import { api } from './api';

const API_URL = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') || (import.meta.env.DEV ? `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001` : null);

// In dev: use same host as page (so phone at 192.168.x.x:5173 connects to 192.168.x.x:3001)
// In prod: MUST set VITE_SOCKET_URL to your Render server URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001` : window.location.origin);

function App() {
  const [screen, setScreen] = useState('home');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (userId && !username) {
      api.getUser(userId)
        .then((u) => {
          if (u?.username) {
            localStorage.setItem('username', u.username);
            setUsername(u.username);
          }
        })
        .catch((err) => {
          if (/not found|404/i.test(err?.message || '')) {
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            setUserId(null);
            setUsername(null);
          }
        });
    }
  }, [userId, username]);
  const [gameState, setGameState] = useState({
    code: null,
    gameId: null,
    playerId: null,
    players: [],
    isHost: false,
    isCustom: false,
    hostId: null,
  });
  const [playerName, setPlayerName] = useState('');
  const [wordData, setWordData] = useState(null);
  const [votePhase, setVotePhase] = useState(null);
  const [votedCount, setVotedCount] = useState(0);
  const [votedPlayerNames, setVotedPlayerNames] = useState([]);
  const [revealData, setRevealData] = useState(null);
  const [hostRoundReady, setHostRoundReady] = useState(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [isStartingVote, setIsStartingVote] = useState(false);
  const gameStateRef = useRef(gameState);
  const playerNameRef = useRef(playerName);
  const isRefreshRef = useRef(false);
  useEffect(() => {
    gameStateRef.current = gameState;
    playerNameRef.current = playerName;
  }, [gameState, playerName]);

  useEffect(() => {
    const url = SOCKET_URL.replace(/\/$/, ''); // no trailing slash
    const isProd = !import.meta.env.DEV;
    const s = io(url, {
      autoConnect: false,
      transports: isProd ? ['polling', 'websocket'] : ['websocket', 'polling'],
      timeout: 120000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    setSocket(s);

    s.on('connect_error', (err) => {
      setConnecting(false);
      const isProd = !import.meta.env.DEV;
      const hasSocketUrl = !!import.meta.env.VITE_SOCKET_URL;
      let msg;
      if (isProd && !hasSocketUrl) {
        msg = "Server URL not configured. In Vercel: Settings → Environment Variables → Add VITE_SOCKET_URL = your Render URL (e.g. https://your-app.onrender.com) → Redeploy.";
      } else if (isProd) {
        const host = url.replace(/^https?:\/\//, '').split('/')[0] || 'server';
        msg = `Can't reach server. Tap Retry below (may take 30–60s if server was sleeping). Or check: ${url}/health`;
      } else {
        msg = "Can't reach game server. Run 'npm run dev:server' in another terminal.";
      }
      setError(msg);
      console.error('Socket connection failed:', err.message, 'URL:', url);
    });

    s.on('disconnect', () => { if (!isRefreshRef.current) setDisconnected(true); isRefreshRef.current = false; });
    s.on('connect', () => {
      setConnecting(false);
      setDisconnected(false);
      setError('');
      let gs = gameStateRef.current;
      let pn = playerNameRef.current;
      if ((!gs?.gameId || !gs?.code || !pn)) {
        try {
          const raw = sessionStorage.getItem('sus_game');
          const saved = raw ? JSON.parse(raw) : {};
          const savedName = sessionStorage.getItem('sus_playerName');
          if (saved?.gameId && saved?.code && savedName) {
            gs = { ...gs, gameId: saved.gameId, code: saved.code };
            pn = savedName;
            setGameState((prev) => ({ ...prev, gameId: saved.gameId, code: saved.code }));
            setPlayerName(savedName);
          }
        } catch (_) {}
      }
      if (gs?.gameId && gs?.code && pn) {
        s.emit('rejoin-game', {
          gameId: gs.gameId,
          code: gs.code,
          playerName: pn,
          isHost: !!gs.isHost,
        }, (res) => {
          if (res?.ok) {
            setGameState((prev) => ({
              ...prev,
              gameId: res.gameId ?? prev.gameId,
              code: res.code ?? prev.code,
              playerId: s.id,
              players: res.players || prev.players,
              isHost: res.isHost ?? prev.isHost,
              isCustom: res.isCustom ?? prev.isCustom,
              hostId: res.hostId ?? prev.hostId,
            }));
            if (res.screen === 'lobby') {
              setScreen('lobby');
              setWordData(null);
              setVotePhase(null);
              setRevealData(null);
            }
          }
        });
      }
    });

    s.on('game-created', ({ code, gameId, playerId, players, isCustom }) => {
      setGameState({ code, gameId, playerId, players, isHost: true, isCustom: !!isCustom });
      try {
        sessionStorage.setItem('sus_game', JSON.stringify({ gameId, code }));
        const pn = playerNameRef.current;
        if (pn) sessionStorage.setItem('sus_playerName', pn);
      } catch (_) {}
      setScreen('lobby');
    });

    s.on('joined-game', ({ gameId, playerId, players, code, isCustom, hostId }) => {
      setGameState((prev) => ({
        ...prev,
        gameId,
        playerId,
        players: players || [],
        isHost: false,
        isCustom: !!isCustom,
        hostId: hostId || prev.hostId,
        code: code || prev.code,
      }));
      try {
        sessionStorage.setItem('sus_game', JSON.stringify({ gameId, code: code }));
        const pn = playerNameRef.current;
        if (pn) sessionStorage.setItem('sus_playerName', pn);
      } catch (_) {}
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
      setVotedPlayerNames([]);
    });

    s.on('vote-received', ({ votedCount: n, totalPlayers, votedPlayerNames: names }) => {
      setVotedCount(n);
      setVotedPlayerNames(Array.isArray(names) ? names : []);
    });

    s.on('imposter-revealed', (data) => {
      setError('');
      setVotePhase('revealed');
      setRevealData(data);
    });

    s.on('game-started', ({ isCustom, needsSetup } = {}) => {
      if (isCustom && needsSetup) setScreen('host-setup');
      // Word is sent separately via your-word
    });

    s.on('round-started', () => {
      // New round - word will come via your-word
    });

    s.on('host-round-ready', (data) => {
      setHostRoundReady(data);
      setVotePhase(null);
      setRevealData(null);
      setScreen('host-observer');
    });

    s.on('start-error', ({ message }) => {
      setError(message);
    });

    s.on('reveal-error', ({ message }) => {
      setError(message);
    });

    s.on('new-host', ({ hostId }) => {
      setGameState((prev) => ({
        ...prev,
        isHost: prev.playerId === hostId,
      }));
    });

    return () => s.disconnect();
  }, []);

  const retryConnection = useCallback(async () => {
    if (!socket) return;
    setError('');
    setConnecting(true);
    const url = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '');
    if (url && !import.meta.env.DEV) {
      try {
        const c = new AbortController();
        setTimeout(() => c.abort(), 75000);
        await fetch(`${url}/health`, { mode: 'cors', signal: c.signal });
      } catch (_) {}
      socket.disconnect();
    }
    socket.connect();
  }, [socket]);

  useEffect(() => {
    if (!disconnected || !socket || connecting) return;
    const id = setInterval(retryConnection, 6000);
    return () => clearInterval(id);
  }, [disconnected, socket, connecting, retryConnection]);

  // Auto-connect when we have a saved game (e.g. after refresh) so rejoin can run
  useEffect(() => {
    if (!socket) return;
    try {
      const raw = sessionStorage.getItem('sus_game');
      const savedName = sessionStorage.getItem('sus_playerName');
      if (raw && savedName) {
        const saved = JSON.parse(raw);
        if (saved?.gameId && saved?.code) {
          socket.connect();
        }
      }
    } catch (_) {}
  }, [socket]);

  useEffect(() => {
    if (!socket || screen === 'home' || connecting) return;
    const REFRESH_MS = 10 * 60 * 1000;
    const id = setInterval(() => {
      if (!socket.connected || connecting) return;
      isRefreshRef.current = true;
      socket.disconnect();
      socket.connect();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [socket, screen, connecting]);

  const wakeServerThenConnect = (action) => {
    if (!socket) return;
    setError('');
    setConnecting(true);
    const url = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '');
    const runAction = () => {
      setConnecting(false);
      action();
    };
    const runWithConnect = () => {
      if (socket.connected) {
        runAction();
        return;
      }
      const timeout = setTimeout(() => {
        socket.off('connect', onConnect);
        setConnecting(false);
        setError("Connection timed out. Tap Create again—server may be waking (can take 60s).");
      }, 90000);
      const onConnect = () => {
        clearTimeout(timeout);
        runAction();
      };
      socket.once('connect', onConnect);
    };
    if (url && !import.meta.env.DEV) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 75000);
      fetch(`${url}/health`, { mode: 'cors', signal: ctrl.signal })
        .catch(() => {})
        .finally(() => {
          clearTimeout(t);
          socket.disconnect();
          socket.connect();
          runWithConnect();
        });
    } else {
      if (!socket.connected) {
        socket.connect();
      }
      runWithConnect();
    }
  };

  const persistGameInfo = (gameId, code, name) => {
    try {
      sessionStorage.setItem('sus_game', JSON.stringify({ gameId, code }));
      if (name) sessionStorage.setItem('sus_playerName', name);
    } catch (_) {}
  };

  const createGame = (name, isCustom = false) => {
    if (!socket) {
      setError('Loading... try again in a moment.');
      return;
    }
    setPlayerName(name);
    try {
      sessionStorage.removeItem('sus_game');
    } catch (_) {}
    wakeServerThenConnect(() => {
      socket.emit('create-game', { playerName: name, userId: userId || undefined, isCustom: !!isCustom });
    });
  };

  const joinGame = (code, name) => {
    if (!socket) {
      setError('Loading... try again in a moment.');
      return;
    }
    setPlayerName(name);
    persistGameInfo(null, code.toUpperCase().trim(), name);
    wakeServerThenConnect(() => {
      socket.emit('join-game', { code: code.toUpperCase().trim(), playerName: name, userId: userId || undefined });
    });
  };

  const clearStaleGameAndGoHome = (msg) => {
    try {
      sessionStorage.removeItem('sus_game');
      sessionStorage.removeItem('sus_playerName');
    } catch (_) {}
    setGameState({ code: null, gameId: null, playerId: null, players: [], isHost: false, isCustom: false });
    setWordData(null);
    setVotePhase(null);
    setRevealData(null);
    setHostRoundReady(null);
    setPlayerName('');
    setScreen('home');
    const friendly = /player not found/i.test(msg || '')
      ? 'Connection lost too long. Create or join a new game.'
      : (msg || 'Game ended (server may have restarted). Create or join a new game.');
    setError(friendly);
  };

  const getGameCreds = () => {
    let gid = gameState.gameId;
    let gc = gameState.code;
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
    return {
      gameId: gid,
      code: gc ? String(gc).toUpperCase().trim() : gc,
      playerName: pn ? String(pn).trim() : pn,
    };
  };

  const startGame = () => {
    if (!socket) { setError('Loading... try again in a moment.'); return; }
    if (!socket?.connected) retryConnection();
    const { gameId, code, playerName } = getGameCreds();
    if (socket?.connected && gameId) socket.emit('start-game', { gameId });
    if (gameId && code && playerName) {
      api.startGame(gameId, code, playerName)
        .then((data) => {
          setError('');
          if (data?.isCustom && data?.needsSetup) {
            setScreen('host-setup');
          } else if (data?.word !== undefined) {
            setWordData({
              word: data.word,
              turnOrderText: data.turnOrderText,
              turnOrder: data.turnOrder,
              totalPlayers: data.totalPlayers,
              isImposter: data.isImposter,
              roundVariant: data.roundVariant || 'normal',
            });
            setVotePhase(null);
            setRevealData(null);
            setScreen('word');
          }
        })
        .catch((err) => {
          const msg = err?.message || 'Start failed. Tap again.';
          if (/game not found|player not found/i.test(msg)) clearStaleGameAndGoHome(msg);
          else setError(msg);
        });
    } else {
      setError('Missing game info. Go back to lobby and rejoin.');
    }
  };

  const newCustomRound = () => {
    setHostRoundReady(null);
    setVotePhase(null);
    setRevealData(null);
    setScreen('host-setup');
  };

  const newRound = () => {
    // In custom games, host always picks the word — both buttons go to host-setup
    if (gameState.isCustom) {
      newCustomRound();
      return;
    }
    if (!socket) { setError('Loading... try again in a moment.'); return; }
    if (!socket?.connected) retryConnection();
    const { gameId, code, playerName } = getGameCreds();
    if (socket?.connected && gameId) socket.emit('new-round', { gameId });
    if (gameId && code && playerName) {
      api.newRound(gameId, code, playerName)
        .then((data) => {
          setError('');
          if (data?.word !== undefined) {
            setWordData({
              word: data.word,
              turnOrderText: data.turnOrderText,
              turnOrder: data.turnOrder,
              totalPlayers: data.totalPlayers,
              isImposter: data.isImposter,
              roundVariant: data.roundVariant || 'normal',
            });
            setVotePhase(null);
            setRevealData(null);
          }
        })
        .catch((err) => {
          const msg = err?.message || 'New round failed. Tap again.';
          if (/game not found|player not found/i.test(msg)) clearStaleGameAndGoHome(msg);
          else setError(msg);
        });
    } else {
      setError('Missing game info. Go back to lobby and rejoin.');
    }
  };

  const backToLobby = () => {
    setWordData(null);
    setVotePhase(null);
    setRevealData(null);
    setScreen('lobby');
  };

  const startVote = () => {
    const { gameId, code, playerName: pn } = getGameCreds();
    if (!gameId || !code || !pn) {
      setError('Missing game info. Go back to lobby and rejoin.');
      return;
    }
    if (socket && !socket.connected) retryConnection?.();
    if (socket?.connected && gameId) socket.emit('start-vote', { gameId });
    let done = false;
    const handleSuccess = () => {
      if (done) return;
      done = true;
      setIsStartingVote(false);
      setError('');
      setVotePhase('voting');
      setVotedCount(0);
    };
    const handleFail = (err) => {
      if (done) return;
      setIsStartingVote(false);
      const msg = err?.message || 'Start vote failed. Tap again.';
      if (/game not found|player not found/i.test(msg)) clearStaleGameAndGoHome(msg);
      else setError(msg);
    };
    setIsStartingVote(true);
    const url = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '');
    const wakeThenTry = () => {
      if (done) return;
      const doStartVote = () => {
        if (done) return;
        api.startVote(gameId, code, pn).then(handleSuccess).catch((e) => {
          if (done) return;
          handleFail(e);
        });
      };
      if (url && !import.meta.env.DEV) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 60000);
        fetch(`${url}/health`, { mode: 'cors', signal: ctrl.signal })
          .catch(() => {})
          .finally(() => {
            clearTimeout(t);
            doStartVote();
          });
      } else {
        doStartVote();
      }
    };
    wakeThenTry();
    [8000, 20000, 40000].forEach((ms) => {
      setTimeout(() => {
        if (done) return;
        wakeThenTry();
      }, ms);
    });
  };

  const submitVote = (votedPlayerIds, noImposter, players = []) => {
    const { gameId: gid, code: gc, playerName: pn } = getGameCreds();
    if (socket?.connected && gid) {
      socket.emit('submit-vote', {
        gameId: gid,
        votedPlayerIds: noImposter ? [] : votedPlayerIds,
        noImposter: !!noImposter,
      });
    }
    if (gid && gc && pn) {
      return api.submitVote(gid, gc, pn, noImposter ? [] : votedPlayerIds, !!noImposter, players)
        .then(() => { setError(''); return true; })
        .catch((err) => {
          const msg = err?.message || 'Vote failed. Tap Submit again.';
          if (/game not found|player not found/i.test(msg)) clearStaleGameAndGoHome(msg);
          else setError(msg);
          return Promise.reject(err);
        });
    }
    setError('Missing game info. Go back to lobby and rejoin.');
    return Promise.reject(new Error('Missing game info'));
  };

  if (screen === 'profile' && userId) {
    return (
      <Profile
        userId={userId}
        onEditProfile={() => setScreen('edit-profile')}
        onFriends={() => setScreen('friends')}
        onLeaderboard={() => setScreen('leaderboard')}
        onBack={() => setScreen('home')}
        onSignOut={() => { localStorage.removeItem('userId'); localStorage.removeItem('username'); setUserId(null); setUsername(null); setScreen('home'); }}
      />
    );
  }

  if (screen === 'edit-profile' && userId) {
    return (
      <EditProfile
        userId={userId}
        onSaved={(newUsername) => {
          if (newUsername) {
            localStorage.setItem('username', newUsername);
            setUsername(newUsername);
          }
          setScreen('profile');
        }}
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
        onSignedUp={(id, name) => { localStorage.setItem('userId', id); localStorage.setItem('username', name || ''); setUserId(id); setUsername(name || ''); setScreen('home'); }}
        onBack={() => setScreen('home')}
        onSignIn={() => setScreen('signin')}
      />
    );
  }

  if (screen === 'signin') {
    return (
      <SignIn
        onSignedIn={(id, name) => { localStorage.setItem('userId', id); localStorage.setItem('username', name || ''); setUserId(id); setUsername(name || ''); setScreen('home'); }}
        onBack={() => setScreen('home')}
        onSignUp={() => setScreen('signup')}
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
        onLeaderboard={() => setScreen('leaderboard')}
        onSignUp={() => setScreen('signup')}
        onSignIn={() => setScreen('signin')}
        username={username}
        error={error}
        connecting={connecting}
        onRetryConnection={retryConnection}
        serverHealthUrl={import.meta.env.VITE_SOCKET_URL ? `${import.meta.env.VITE_SOCKET_URL.replace(/\/$/, '')}/health` : null}
      />
    );
  }

  if (screen === 'lobby') {
    return (
      <>
        {disconnected && (
          <div className="app__reconnect" role="alert">
            Connection lost.{' '}
            <button type="button" className="app__reconnect-btn" onClick={retryConnection} disabled={connecting}>
              {connecting ? 'Reconnecting…' : 'Tap to retry'}
            </button>
          </div>
        )}
        <Lobby
          code={gameState.code}
          players={gameState.players}
          isHost={gameState.isHost}
          isCustom={gameState.isCustom}
          playerName={playerName}
          onStartGame={startGame}
          error={error?.includes("Can't reach server") ? null : error}
        />
      </>
    );
  }

  if (screen === 'host-setup') {
    const { players } = gameState;
    const { gameId, code, playerName: pn } = getGameCreds();
    return (
      <>
        {disconnected && (
          <div className="app__reconnect" role="alert">
            Connection lost.{' '}
            <button type="button" className="app__reconnect-btn" onClick={retryConnection} disabled={connecting}>
              {connecting ? 'Reconnecting…' : 'Tap to retry'}
            </button>
          </div>
        )}
        <HostSetup
          gameId={gameId}
          code={code}
          playerName={pn || playerName}
          players={players}
          socket={socket}
          onRoundStarted={() => {}}
          onHostRoundReady={(data) => {
            setHostRoundReady(data);
            setVotePhase(null);
            setRevealData(null);
            setScreen('host-observer');
          }}
          onBackToLobby={() => { setScreen('lobby'); setError(''); }}
          error={error}
          onClearError={() => setError('')}
          onError={(msg) => setError(msg)}
        />
      </>
    );
  }

  if (screen === 'host-observer' && hostRoundReady) {
    const { gameId, code, players, playerId } = gameState;
    return (
      <>
        {disconnected && (
          <div className="app__reconnect" role="alert">
            Connection lost.{' '}
            <button type="button" className="app__reconnect-btn" onClick={retryConnection} disabled={connecting}>
              {connecting ? 'Reconnecting…' : 'Tap to retry'}
            </button>
          </div>
        )}
        <HostObserver
          category={hostRoundReady.category}
          word={hostRoundReady.word}
          totalPlayers={hostRoundReady.totalPlayers || 0}
          players={players}
          playerId={playerId}
          gameId={gameId}
          gameCode={code}
          playerName={playerName}
          votePhase={votePhase}
          votedCount={votedCount}
          votedPlayerNames={votedPlayerNames}
          revealData={revealData}
          onStartVote={startVote}
          isStartingVote={isStartingVote}
          isCustom={gameState.isCustom}
          onNewRound={newRound}
          onNewCustomRound={newCustomRound}
          onBackToLobby={() => { setScreen('lobby'); setHostRoundReady(null); setVotePhase(null); setRevealData(null); setError(''); }}
          error={error}
          onClearError={() => setError('')}
          onRetryConnection={retryConnection}
          socket={socket}
        />
      </>
    );
  }

  if (screen === 'word' && wordData) {
    return (
      <>
        {disconnected && (
          <div className="app__reconnect" role="alert">
            Connection lost.{' '}
            <button type="button" className="app__reconnect-btn" onClick={retryConnection} disabled={connecting}>
              {connecting ? 'Reconnecting…' : 'Tap to retry'}
            </button>
          </div>
        )}
        <YourWord
        word={wordData.word}
        turnOrderText={wordData.turnOrderText}
        turnOrder={wordData.turnOrder}
        totalPlayers={wordData.totalPlayers}
        isImposter={wordData.isImposter}
        roundVariant={wordData.roundVariant || 'normal'}
        onNewRound={newRound}
        onNewCustomRound={newCustomRound}
        isHost={gameState.isHost}
        isCustom={gameState.isCustom}
        hostId={gameState.hostId}
        hostPlays={wordData.hostPlays}
        onBackToLobby={backToLobby}
        players={gameState.players}
        playerId={gameState.playerId}
        votePhase={votePhase}
        votedCount={votedCount}
        votedPlayerNames={votedPlayerNames}
        revealData={revealData}
        onStartVote={startVote}
        isStartingVote={isStartingVote}
        onSubmitVote={submitVote}
        socket={socket}
        gameId={gameState.gameId}
        gameCode={gameState.code}
        playerName={playerName}
        apiUrl={API_URL}
        onRevealError={(msg) => {
          if (/game not found|player not found/i.test(msg || '')) clearStaleGameAndGoHome(msg);
          else setError(msg || 'Reveal failed. Tap Cancel and try again.');
        }}
        onRevealSuccess={(data) => {
          setError('');
          setVotePhase('revealed');
          setRevealData(data);
        }}
        error={error?.includes("Can't reach server") ? null : error}
        onClearError={() => setError('')}
        onRetryConnection={retryConnection}
      />
      </>
    );
  }

  return null;
}

export default App;
