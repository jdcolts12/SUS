import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createRound, createRoundCustom } from './gameLogic.js';
import { wordCategories, categoryNames } from './words.js';
import apiRouter from './api.js';
import * as db from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check for Railway/deployment
app.get('/health', (req, res) => res.json({ ok: true }));

// Categories + words for custom game host (must be before /api router)
app.get('/api/categories', (req, res) => {
  res.json({ categories: categoryNames, words: wordCategories });
});

app.use('/api', apiRouter);

const httpServer = createServer(app);

const games = new Map();
const roomCodes = new Map();
const disconnectTimeouts = new Map();

function getPlayingCount(game) {
  return game.isCustom ? Math.max(0, game.players.length - 1) : game.players.length;
}

function getVotedCount(game) {
  const voters = game.isCustom ? game.players.filter((p) => p.id !== game.hostId) : game.players;
  return voters.filter(
    (p) => game.votes?.[p.id] !== undefined || game.votes?.[`__http__${p.name}`] !== undefined
  ).length;
}

function getVotesForTally(game) {
  const out = [];
  game.players.forEach((p) => {
    const v = game.votes?.[p.id] ?? game.votes?.[`__http__${p.name}`];
    if (v !== undefined) out.push(v);
  });
  return out;
}

function getVoteForPlayer(game, player) {
  return game.votes?.[player.id] ?? game.votes?.[`__http__${player.name}`];
}

function isVoteCorrect(game, round, player, votedPlayerId, votedWasImposter, teamWon) {
  if (round.imposterIds.includes(player.id)) return null;
  const vote = getVoteForPlayer(game, player);
  if (vote === undefined) return null;
  if (round.roundVariant === 'no_imposter') {
    return vote === '__no_imposter__' ? 1 : 0;
  }
  if (teamWon) {
    const votedImposter = Array.isArray(vote) && vote.some((id) => round.imposterIds.includes(id));
    return votedImposter ? 1 : 0;
  }
  return 0;
}

function recordRoundResults(game, round, votedPlayerId, votedWasImposter, teamWon) {
  game.players.forEach((p) => {
    if (!p.userId) return;
    if (game.isCustom && p.id === game.hostId) return;
    const wasImposter = round.imposterIds.includes(p.id);
    const won = wasImposter ? !votedWasImposter : teamWon;
    const voteCorrect = isVoteCorrect(game, round, p, votedPlayerId, votedWasImposter, teamWon);
    db.recordRoundResult(p.userId, wasImposter, won, voteCorrect)
      .catch((e) => console.warn('[recordRoundResult] failed:', e?.message));
  });
}

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 5 * 60 * 1000,
  pingInterval: 25000,
});

// HTTP reveal fallback (reliable on mobile when Socket.IO drops)
app.post('/api/reveal-imposter', (req, res) => {
  try {
    const { gameId, code, playerName } = req.body;
    if (!gameId || !code || !playerName) {
      return res.status(400).json({ ok: false, error: 'gameId, code, and playerName required' });
    }
    const game = games.get(gameId);
    if (!game || game.code !== String(code).toUpperCase()) {
      return res.status(404).json({ ok: false, error: 'Game not found.' });
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) return res.status(403).json({ ok: false, error: 'Player not found.' });
    if (game.hostId !== player.id) {
      return res.status(403).json({ ok: false, error: 'Only the host can reveal.' });
    }
    if (game.status !== 'playing' || game.votePhase !== 'voting') {
      return res.status(400).json({ ok: false, error: 'Cannot reveal right now.' });
    }
    const round = game.currentRound;
    if (!round) return res.status(400).json({ ok: false, error: 'No active round.' });
    const totalPlayers = getPlayingCount(game);
    const votedCount = getVotedCount(game);
    if (votedCount < totalPlayers) {
      return res.status(400).json({ ok: false, error: `Waiting for votes (${votedCount}/${totalPlayers}).` });
    }
    const tally = {};
    game.players.forEach((p) => { tally[p.id] = 0; });
    getVotesForTally(game).forEach((vote) => {
      if (vote === '__no_imposter__') return;
      if (Array.isArray(vote)) vote.forEach((id) => { if (tally[id] !== undefined) tally[id]++; });
    });
    let votedPlayerId = null;
    let maxVotes = 0;
    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) maxVotes = count;
    }
    const imposterNames = round.imposterNames?.length ? round.imposterNames : (round.imposterIds || []).map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    const isImposterByName = (id) => {
      const name = game.players.find((p) => p.id === id)?.name;
      return name && imposterNames.some((n) => (n || '').toLowerCase() === (name || '').toLowerCase());
    };
    const tied = Object.entries(tally).filter(([, c]) => c === maxVotes && c > 0);
    if (tied.length === 1) {
      votedPlayerId = tied[0][0];
    } else if (tied.length > 1) {
      const imposterInTie = tied.find(([id]) => round.imposterIds.includes(id) || isImposterByName(id));
      if (imposterInTie) votedPlayerId = imposterInTie[0];
    }
    const votedPlayerName = votedPlayerId ? game.players.find((p) => p.id === votedPlayerId)?.name : null;
    const votedWasImposter = votedPlayerId ? (round.imposterIds.includes(votedPlayerId) || (votedPlayerName && imposterNames.some((n) => (n || '').toLowerCase() === (votedPlayerName || '').toLowerCase()))) : false;
    const voteTied = tied.length > 1;
    const teamWon = votedPlayerId
      ? (votedWasImposter && round.roundVariant !== 'two_imposters') // two imposters: crew must vote both out; voting only one = imposters win
      : (voteTied && tied.some(([id]) => round.imposterIds.includes(id) || isImposterByName(id)))
        ? true
        : (round.roundVariant === 'no_imposter');
    recordRoundResults(game, round, votedPlayerId, votedWasImposter, teamWon);
    game.votePhase = 'revealed';
    const survivingImposter = round.roundVariant === 'two_imposters' && votedWasImposter && votedPlayerId
      ? game.players.find((p) => round.imposterIds.includes(p.id) && p.id !== votedPlayerId)?.name
      : null;
    const payload = {
      imposterIds: round.imposterIds,
      imposterNames,
      votedPlayerId,
      votedPlayerName,
      voteTied,
      wasImposter: votedWasImposter,
      teamWon,
      survivingImposterName: survivingImposter || undefined,
      category: round.category,
      word: round.word,
      noImposterRound: round.roundVariant === 'no_imposter',
    };
    game.lastReveal = payload;
    io.to(game.code).emit('imposter-revealed', payload);
    res.json({ ok: true, ...payload });
  } catch (err) {
    console.error('[reveal-imposter HTTP]', err);
    const msg = err?.message || 'Something went wrong.';
    res.status(500).json({ ok: false, error: msg.startsWith('game') || msg.length > 80 ? 'Something went wrong.' : msg });
  }
});

// HTTP vote fallback (always works when socket is flaky)
app.post('/api/submit-vote', (req, res) => {
  try {
    const { gameId, code, playerName, votedPlayerIds, noImposter } = req.body;
    if (!gameId || !code || !playerName) {
      return res.status(400).json({ ok: false, error: 'gameId, code, and playerName required' });
    }
    const game = games.get(gameId);
    if (!game || game.code !== String(code).toUpperCase()) {
      return res.status(404).json({ ok: false, error: 'Game not found.' });
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) return res.status(403).json({ ok: false, error: 'Player not found.' });
    if (game.status !== 'playing' || game.votePhase !== 'voting') {
      return res.status(400).json({ ok: false, error: 'Voting is not open.' });
    }
    let voteIds = [];
    if (noImposter) {
      voteIds = null;
    } else if (Array.isArray(req.body.votedPlayerNames) && req.body.votedPlayerNames.length > 0) {
      voteIds = req.body.votedPlayerNames
        .map((n) => game.players.find((p) => p.name.toLowerCase() === String(n).toLowerCase())?.id)
        .filter(Boolean);
    } else {
      voteIds = (Array.isArray(votedPlayerIds) ? votedPlayerIds : []).filter((id) =>
        game.players.some((p) => p.id === id)
      );
    }
    if (game.isCustom && player.id === game.hostId) {
      return res.status(403).json({ ok: false, error: 'Host does not vote in custom games.' });
    }
    const vote = noImposter ? '__no_imposter__' : voteIds;
    if (!game.votes) game.votes = {};
    delete game.votes[player.id];
    delete game.votes[`__http__${player.name}`];
    game.votes[`__http__${player.name}`] = vote;
    const votedCount = getVotedCount(game);
    io.to(game.code).emit('vote-received', { votedCount, totalPlayers: getPlayingCount(game) });
    res.json({ ok: true, votedCount });
  } catch (err) {
    console.error('[submit-vote HTTP]', err);
    res.status(500).json({ ok: false, error: err?.message || 'Vote failed.' });
  }
});

app.post('/api/start-game', (req, res) => {
  try {
    const { gameId, code, playerName } = req.body;
    if (!gameId || !code || !playerName) {
      return res.status(400).json({ ok: false, error: 'gameId, code, and playerName required' });
    }
    const game = games.get(gameId);
    if (!game || game.code !== String(code).toUpperCase()) {
      return res.status(404).json({ ok: false, error: 'Game not found.' });
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) return res.status(403).json({ ok: false, error: 'Player not found.' });
    if (game.hostId !== player.id) return res.status(403).json({ ok: false, error: 'Only the host can start.' });
    if (game.isCustom) {
      if (game.players.length < 3) {
        return res.status(400).json({ ok: false, error: 'Custom games need at least 3 players (host + 2 players)!' });
      }
      game.status = 'playing';
      io.to(game.code).emit('game-started', { players: game.players, isCustom: true, needsSetup: true });
      return res.json({ ok: true, isCustom: true, needsSetup: true });
    }
    if (game.players.length < 4) {
      return res.status(400).json({ ok: false, error: 'Need at least 4 players to start!' });
    }
    const playerIds = game.players.map((p) => p.id);
    const recentRounds = [game.currentRound, ...(game.roundHistory || [])].filter(Boolean).slice(-10);
    const round = createRound(playerIds, recentRounds);
    round.imposterNames = round.imposterIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    round.assignmentsByName = {};
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      if (a) round.assignmentsByName[(p.name || '').toLowerCase()] = a;
    });
    if (game.currentRound) game.roundHistory = [...(game.roundHistory || []), game.currentRound].slice(-10);
    game.currentRound = round;
    game.status = 'playing';
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      const payload = {
        turnOrderText: a.turnOrderText,
        turnOrder: a.turnOrder,
        totalPlayers: game.players.length,
        roundVariant: a.roundVariant,
        word: a.isImposter ? `${a.category}\n\nIMPOSTER` : a.word,
        isImposter: a.isImposter,
      };
      io.to(p.id).emit('your-word', payload);
    });
    io.to(game.code).emit('game-started', {
      players: game.players,
      turnOrder: round.turnOrder.map((id) => game.players.find((p) => p.id === id)?.name),
    });
    const a = round.assignments[player.id];
    res.json({
      ok: true,
      word: a.isImposter ? `${a.category}\n\nIMPOSTER` : a.word,
      turnOrderText: a.turnOrderText,
      turnOrder: a.turnOrder,
      totalPlayers: game.players.length,
      isImposter: a.isImposter,
      roundVariant: a.roundVariant,
    });
  } catch (err) {
    console.error('[start-game HTTP]', err);
    res.status(500).json({ ok: false, error: err?.message || 'Start failed.' });
  }
});

app.post('/api/new-round', (req, res) => {
  try {
    const { gameId, code, playerName } = req.body;
    if (!gameId || !code || !playerName) {
      return res.status(400).json({ ok: false, error: 'gameId, code, and playerName required' });
    }
    const game = games.get(gameId);
    if (!game || game.code !== String(code).toUpperCase()) {
      return res.status(404).json({ ok: false, error: 'Game not found.' });
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) return res.status(403).json({ ok: false, error: 'Player not found.' });
    if (game.hostId !== player.id || game.status !== 'playing') {
      return res.status(403).json({ ok: false, error: 'Only the host can start a new round.' });
    }
    game.votePhase = null;
    game.votes = null;
    const playerIds = game.players.map((p) => p.id);
    const recentRounds = [game.currentRound, ...(game.roundHistory || [])].filter(Boolean).slice(-10);
    const round = createRound(playerIds, recentRounds);
    round.imposterNames = round.imposterIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    round.assignmentsByName = {};
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      if (a) round.assignmentsByName[(p.name || '').toLowerCase()] = a;
    });
    if (game.currentRound) game.roundHistory = [...(game.roundHistory || []), game.currentRound].slice(-10);
    game.currentRound = round;
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      io.to(p.id).emit('your-word', {
        turnOrderText: a.turnOrderText,
        turnOrder: a.turnOrder,
        totalPlayers: game.players.length,
        roundVariant: a.roundVariant,
        word: a.isImposter ? `${a.category}\n\nIMPOSTER` : a.word,
        isImposter: a.isImposter,
      });
    });
    io.to(game.code).emit('round-started');
    const a2 = round.assignments[player.id];
    res.json({
      ok: true,
      word: a2.isImposter ? `${a2.category}\n\nIMPOSTER` : a2.word,
      turnOrderText: a2.turnOrderText,
      turnOrder: a2.turnOrder,
      totalPlayers: game.players.length,
      isImposter: a2.isImposter,
      roundVariant: a2.roundVariant,
    });
  } catch (err) {
    console.error('[new-round HTTP]', err);
    res.status(500).json({ ok: false, error: err?.message || 'New round failed.' });
  }
});

app.post('/api/custom-round', (req, res) => {
  try {
    const { gameId, code, playerName, category, word } = req.body;
    if (!gameId || !code || !playerName || !category || !word) {
      return res.status(400).json({ ok: false, error: 'gameId, code, playerName, category, and word required' });
    }
    const game = games.get(gameId);
    if (!game || game.code !== String(code).toUpperCase()) {
      return res.status(404).json({ ok: false, error: 'Game not found.' });
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) return res.status(403).json({ ok: false, error: 'Player not found.' });
    if (game.hostId !== player.id || game.status !== 'playing') {
      return res.status(403).json({ ok: false, error: 'Only the host can set up a custom round.' });
    }
    const words = wordCategories[category];
    if (!Array.isArray(words) || !words.includes(word)) {
      return res.status(400).json({ ok: false, error: 'Invalid category or word.' });
    }
    game.votePhase = null;
    game.votes = null;
    const playerIds = game.players.filter((p) => p.id !== game.hostId).map((p) => p.id);
    if (playerIds.length < 2) {
      return res.status(400).json({ ok: false, error: 'Need at least 2 players (excluding host) for a round!' });
    }
    const recentRounds = [game.currentRound, ...(game.roundHistory || [])].filter(Boolean).slice(-10);
    const round = createRoundCustom(category, word, playerIds, recentRounds);
    round.imposterNames = round.imposterIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    round.assignmentsByName = {};
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      if (a) round.assignmentsByName[(p.name || '').toLowerCase()] = a;
    });
    if (game.currentRound) game.roundHistory = [...(game.roundHistory || []), game.currentRound].slice(-10);
    game.currentRound = round;
    const playingCount = getPlayingCount(game);
    game.players.forEach((p) => {
      if (p.id === game.hostId) {
        io.to(p.id).emit('host-round-ready', { category, word, totalPlayers: playingCount });
      } else {
        const a = round.assignments[p.id];
        if (a) {
          io.to(p.id).emit('your-word', {
            turnOrderText: a.turnOrderText,
            turnOrder: a.turnOrder,
            totalPlayers: playingCount,
            roundVariant: a.roundVariant,
            word: a.isImposter ? `${a.category}\n\nIMPOSTER` : a.word,
            isImposter: a.isImposter,
          });
        }
      }
    });
    io.to(game.code).emit('round-started');
    res.json({ ok: true, isHost: true });
  } catch (err) {
    console.error('[custom-round HTTP]', err);
    res.status(500).json({ ok: false, error: err?.message || 'Custom round failed.' });
  }
});

app.post('/api/start-vote', (req, res) => {
  try {
    const { gameId, code, playerName } = req.body;
    if (!gameId || !code || !playerName) {
      return res.status(400).json({ ok: false, error: 'gameId, code, and playerName required' });
    }
    const game = games.get(gameId);
    if (!game || game.code !== String(code).toUpperCase()) {
      return res.status(404).json({ ok: false, error: 'Game not found.' });
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) return res.status(403).json({ ok: false, error: 'Player not found.' });
    if (game.hostId !== player.id || game.status !== 'playing' || !game.currentRound) {
      return res.status(403).json({ ok: false, error: 'Only the host can start voting.' });
    }
    game.votePhase = 'voting';
    game.votes = {};
    io.to(game.code).emit('vote-started', { players: game.players, totalPlayers: getPlayingCount(game) });
    res.json({ ok: true });
  } catch (err) {
    console.error('[start-vote HTTP]', err);
    res.status(500).json({ ok: false, error: err?.message || 'Start vote failed.' });
  }
});

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createGame(hostId, hostName, hostUserId, isCustom = false) {
  const gameId = uuidv4();
  let code = generateRoomCode();
  while (roomCodes.has(code)) code = generateRoomCode();

  const game = {
    id: gameId,
    code,
    hostId,
    isCustom: !!isCustom,
    players: [{ id: hostId, name: hostName, userId: hostUserId || null }],
    status: 'lobby',
    currentRound: null,
    roundHistory: [],
  };

  games.set(gameId, game);
  roomCodes.set(code, gameId);
  return game;
}

io.on('connection', (socket) => {
  socket.on('create-game', ({ playerName, userId, isCustom }) => {
    const game = createGame(socket.id, playerName, userId, isCustom);
    socket.join(game.code);
    socket.emit('game-created', {
      code: game.code,
      gameId: game.id,
      playerId: socket.id,
      players: game.players,
      isCustom: game.isCustom,
    });
  });

  socket.on('rejoin-game', ({ gameId, code, playerName, isHost }, ack) => {
    const game = games.get(gameId);
    if (!game || game.code !== code?.toUpperCase()) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Game not found.' });
      return;
    }
    const player = game.players.find((p) => (p.name || '').toLowerCase().trim() === String(playerName || '').toLowerCase().trim());
    if (!player) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Player not found.' });
      return;
    }
    const oldId = player.id;
    player.id = socket.id;
    if (isHost || game.hostId === oldId) {
      game.hostId = socket.id;
    }
    // Migrate vote from old socket id or HTTP key so reveal count stays correct
    const httpKey = `__http__${player.name}`;
    if (game.votes) {
      const existingVote = game.votes[oldId] ?? game.votes[httpKey];
      if (existingVote !== undefined) {
        game.votes[socket.id] = existingVote;
        delete game.votes[oldId];
        delete game.votes[httpKey];
      }
    }
    // Update votes-for: anyone who voted for this player's old id should reference new id for tally
    if (game.votes) {
      for (const sid of Object.keys(game.votes)) {
        const v = game.votes[sid];
        if (Array.isArray(v)) {
          const idx = v.indexOf(oldId);
          if (idx >= 0) v[idx] = socket.id;
        }
      }
    }
    const tid = disconnectTimeouts.get(oldId);
    if (tid) {
      clearTimeout(tid);
      disconnectTimeouts.delete(oldId);
    }
    socket.join(game.code);

    const isHost = game.hostId === socket.id;
    const ackPayload = {
      ok: true,
      gameId: game.id,
      code: game.code,
      players: game.players,
      isHost,
      isCustom: game.isCustom,
      hostId: game.hostId,
      status: game.status,
      screen: game.status === 'lobby' ? 'lobby' : 'word',
    };

    if (game.status === 'playing' && game.currentRound) {
      const round = game.currentRound;
      const playingCount = getPlayingCount(game);
      if (game.isCustom && isHost) {
        socket.emit('host-round-ready', {
          category: round.category,
          word: round.word,
          totalPlayers: playingCount,
        });
      } else {
        const assignment = round.assignmentsByName?.[(player.name || '').toLowerCase()]
          || round.assignments[oldId]
          || round.assignments[socket.id];
        if (assignment) {
          const payload = {
            turnOrderText: assignment.turnOrderText,
            turnOrder: assignment.turnOrder,
            totalPlayers: playingCount,
            roundVariant: assignment.roundVariant,
            word: assignment.isImposter ? `${assignment.category}\n\nIMPOSTER` : assignment.word,
            isImposter: assignment.isImposter,
          };
          socket.emit('your-word', payload);
        }
      }
      if (game.votePhase === 'voting') {
        socket.emit('vote-started', { players: game.players });
        if (game.votes) {
          const vc = getVotedCount(game);
          socket.emit('vote-received', { votedCount: vc, totalPlayers: playingCount });
        }
      } else if (game.votePhase === 'revealed' && game.lastReveal) {
        socket.emit('imposter-revealed', game.lastReveal);
      }
    }

    if (typeof ack === 'function') ack(ackPayload);
  });

  socket.on('join-game', ({ code, playerName, userId }) => {
    const gameId = roomCodes.get(code?.toUpperCase());
    if (!gameId) {
      socket.emit('join-error', { message: 'Room not found. Check the code!' });
      return;
    }
    const game = games.get(gameId);
    if (!game || game.status !== 'lobby') {
      socket.emit('join-error', { message: 'Game has already started!' });
      return;
    }
    if (game.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
      socket.emit('join-error', { message: 'That name is already taken!' });
      return;
    }
    if (game.players.length >= 10) {
      socket.emit('join-error', { message: 'Room is full! Max 10 players.' });
      return;
    }
    game.players.push({ id: socket.id, name: playerName, userId: userId || null });
    socket.join(game.code);
    socket.emit('joined-game', {
      gameId: game.id,
      playerId: socket.id,
      players: game.players,
      code: game.code,
      isCustom: game.isCustom,
      hostId: game.hostId,
    });
    io.to(game.code).emit('player-joined', { players: game.players });
  });

  socket.on('start-game', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id) return;
    if (game.isCustom) {
      if (game.players.length < 3) {
        socket.emit('start-error', { message: 'Custom games need at least 3 players (host + 2 players)!' });
        return;
      }
      game.status = 'playing';
      io.to(game.code).emit('game-started', { players: game.players, isCustom: true, needsSetup: true });
      return;
    }
    if (game.players.length < 4) {
      socket.emit('start-error', { message: 'Need at least 4 players to start!' });
      return;
    }
    const playerIds = game.players.map((p) => p.id);
    const recentRounds = [game.currentRound, ...(game.roundHistory || [])].filter(Boolean).slice(-10);
    const round = createRound(playerIds, recentRounds);
    round.imposterNames = round.imposterIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    round.assignmentsByName = {};
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      if (a) round.assignmentsByName[(p.name || '').toLowerCase()] = a;
    });
    if (game.currentRound) game.roundHistory = [...(game.roundHistory || []), game.currentRound].slice(-10);
    game.currentRound = round;
    game.status = 'playing';

    // Send each player their secret assignment
    game.players.forEach((player) => {
      const assignment = round.assignments[player.id];
      const payload = {
        turnOrderText: assignment.turnOrderText,
        turnOrder: assignment.turnOrder,
        totalPlayers: game.players.length,
        roundVariant: assignment.roundVariant,
      };
      if (assignment.isImposter) {
        payload.word = `${assignment.category}\n\nIMPOSTER`;
        payload.isImposter = true;
      } else {
        payload.word = assignment.word;
        payload.isImposter = false;
      }
      io.to(player.id).emit('your-word', payload);
    });

    io.to(game.code).emit('game-started', {
      players: game.players,
      turnOrder: round.turnOrder.map((id) => game.players.find((p) => p.id === id)?.name),
    });
  });

  socket.on('new-round', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id || game.status !== 'playing') return;

    game.votePhase = null;
    game.votes = null;
    const playerIds = game.players.map((p) => p.id);
    const recentRounds = [game.currentRound, ...(game.roundHistory || [])].filter(Boolean).slice(-10);
    const round = createRound(playerIds, recentRounds);
    round.imposterNames = round.imposterIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    round.assignmentsByName = {};
    game.players.forEach((p) => {
      const a = round.assignments[p.id];
      if (a) round.assignmentsByName[(p.name || '').toLowerCase()] = a;
    });
    if (game.currentRound) game.roundHistory = [...(game.roundHistory || []), game.currentRound].slice(-10);
    game.currentRound = round;

    game.players.forEach((player) => {
      const assignment = round.assignments[player.id];
      const payload = {
        turnOrderText: assignment.turnOrderText,
        turnOrder: assignment.turnOrder,
        totalPlayers: game.players.length,
        roundVariant: assignment.roundVariant,
      };
      if (assignment.isImposter) {
        payload.word = `${assignment.category}\n\nIMPOSTER`;
        payload.isImposter = true;
      } else {
        payload.word = assignment.word;
        payload.isImposter = false;
      }
      io.to(player.id).emit('your-word', payload);
    });

    io.to(game.code).emit('round-started');
  });

  // Host starts voting phase - all players can then vote
  socket.on('start-vote', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id || game.status !== 'playing' || !game.currentRound) return;
    game.votePhase = 'voting';
    game.votes = {};
    io.to(game.code).emit('vote-started', { players: game.players, totalPlayers: getPlayingCount(game) });
  });

  // Any player submits their vote (multiple player IDs and/or no-imposter)
  socket.on('submit-vote', ({ gameId, votedPlayerIds, noImposter }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing' || game.votePhase !== 'voting') return;
    const player = game.players.find((p) => p.id === socket.id);
    if (!player) return;
    if (game.isCustom && player.id === game.hostId) return;

    const vote = noImposter
      ? '__no_imposter__'
      : (Array.isArray(votedPlayerIds) ? votedPlayerIds : []).filter((id) =>
          game.players.some((p) => p.id === id)
        );
    if (!game.votes) game.votes = {};
    delete game.votes[`__http__${player.name}`];
    game.votes[socket.id] = vote;

    const votedCount = getVotedCount(game);
    io.to(game.code).emit('vote-received', { votedCount, totalPlayers: getPlayingCount(game) });
  });

  // Host reveals imposter after everyone has voted
  socket.on('reveal-imposter', ({ gameId }) => {
    const sendResult = (result) => { socket.emit('reveal-result', result); };
    try {
      console.log('[reveal-imposter] received', { gameId, socketId: socket.id });
      const game = games.get(gameId);
      if (!game) {
        socket.emit('reveal-error', { message: 'Game not found.' });
        sendResult({ ok: false, error: 'Game not found.' });
        return;
      }
      if (game.hostId !== socket.id) {
        const hostLeft = !game.players.some((p) => p.id === game.hostId);
        if (hostLeft && game.players.some((p) => p.id === socket.id)) {
          game.hostId = socket.id;
        } else {
          socket.emit('reveal-error', { message: 'Only the host can reveal.' });
          sendResult({ ok: false, error: 'Only the host can reveal.' });
          return;
        }
      }
      if (game.status !== 'playing' || game.votePhase !== 'voting') {
        socket.emit('reveal-error', { message: 'Cannot reveal right now.' });
        sendResult({ ok: false, error: 'Cannot reveal right now.' });
        return;
      }

      const round = game.currentRound;
      const totalPlayers = getPlayingCount(game);
      const votedCount = getVotedCount(game);
      if (votedCount < totalPlayers) {
        console.log('[reveal-imposter] rejected: waiting for votes', { votedCount, totalPlayers });
        socket.emit('reveal-error', { message: `Waiting for votes (${votedCount}/${totalPlayers}).` });
        sendResult({ ok: false, error: `Waiting for votes (${votedCount}/${totalPlayers}).` });
        return;
      }

      console.log('[reveal-imposter] success');
      const tally = {};
      game.players.forEach((p) => { tally[p.id] = 0; });
      getVotesForTally(game).forEach((vote) => {
        if (vote === '__no_imposter__') return;
        if (Array.isArray(vote)) {
          vote.forEach((id) => { if (tally[id] !== undefined) tally[id]++; });
        }
      });

      let votedPlayerId = null;
      let maxVotes = 0;
      for (const [id, count] of Object.entries(tally)) {
        if (count > maxVotes) maxVotes = count;
      }
      const imposterNames = round.imposterNames?.length ? round.imposterNames : round.imposterIds.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
      const isImposterByName = (id) => {
        const name = game.players.find((p) => p.id === id)?.name;
        return name && imposterNames.some((n) => (n || '').toLowerCase() === (name || '').toLowerCase());
      };
      const tied = Object.entries(tally).filter(([, c]) => c === maxVotes && c > 0);
      if (tied.length === 1) {
        votedPlayerId = tied[0][0];
      } else if (tied.length > 1) {
        const imposterInTie = tied.find(([id]) => round.imposterIds.includes(id) || isImposterByName(id));
        if (imposterInTie) votedPlayerId = imposterInTie[0];
      }
      const votedPlayerName = votedPlayerId ? game.players.find((p) => p.id === votedPlayerId)?.name : null;
      const votedWasImposter = votedPlayerId ? (round.imposterIds.includes(votedPlayerId) || (votedPlayerName && imposterNames.some((n) => (n || '').toLowerCase() === (votedPlayerName || '').toLowerCase()))) : false;
      const voteTied = tied.length > 1;
      const teamWon = votedPlayerId
        ? (votedWasImposter && round.roundVariant !== 'two_imposters')
        : (voteTied && tied.some(([id]) => round.imposterIds.includes(id) || isImposterByName(id)))
          ? true
          : (round.roundVariant === 'no_imposter');

      recordRoundResults(game, round, votedPlayerId, votedWasImposter, teamWon);
      game.votePhase = 'revealed';

      const survivingImposter = round.roundVariant === 'two_imposters' && votedWasImposter && votedPlayerId
        ? game.players.find((p) => round.imposterIds.includes(p.id) && p.id !== votedPlayerId)?.name
        : null;
      const payload = {
        imposterIds: round.imposterIds,
        imposterNames,
        votedPlayerId,
        votedPlayerName,
        voteTied,
        wasImposter: votedWasImposter,
        teamWon,
        survivingImposterName: survivingImposter || undefined,
        category: round.category,
        word: round.word,
        noImposterRound: round.roundVariant === 'no_imposter',
      };
      game.lastReveal = payload;
      sendResult({ ok: true, ...payload });
      io.to(game.code).emit('imposter-revealed', payload);
      socket.emit('imposter-revealed', payload);
    } catch (err) {
      console.error('[reveal-imposter] error:', err);
      const msg = (err?.message || 'Something went wrong.').slice(0, 100);
      socket.emit('reveal-error', { message: msg });
      sendResult({ ok: false, error: msg });
    }
  });

  socket.on('record-round-result', ({ gameId, votedPlayerId }) => {
    // Legacy: direct record without voting (kept for compatibility, can remove if unused)
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id || game.status !== 'playing' || !game.currentRound) return;

    const round = game.currentRound;
    const votedWasImposter = votedPlayerId ? round.imposterIds.includes(votedPlayerId) : false;

    recordRoundResults(game, round, votedPlayerId, votedWasImposter, votedWasImposter);
    io.to(game.code).emit('round-result-recorded', {
      votedPlayerId,
      votedPlayerName: game.players.find((p) => p.id === votedPlayerId)?.name,
      wasImposter: votedWasImposter,
      teamWon: votedWasImposter,
    });
  });

  socket.on('disconnect', () => {
    for (const [gameId, game] of games) {
      const idx = game.players.findIndex((p) => p.id === socket.id);
      if (idx >= 0) {
        if (game.status !== 'playing') {
          // Lobby only: remove after 2 hour grace (never remove during active games)
          const tid = setTimeout(() => {
            disconnectTimeouts.delete(socket.id);
            const i = game.players.findIndex((p) => p.id === socket.id);
            if (i < 0) return;
            game.players.splice(i, 1);
            io.to(game.code).emit('player-left', { players: game.players });
            if (game.players.length === 0) {
              roomCodes.delete(game.code);
              games.delete(gameId);
            } else if (game.hostId === socket.id) {
              game.hostId = game.players[0].id;
              io.to(game.code).emit('new-host', { hostId: game.hostId });
            }
          }, 2 * 60 * 60 * 1000);
          disconnectTimeouts.set(socket.id, tid);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Imposter game server running on port ${PORT}`);
  console.log(`Connect clients to http://localhost:${PORT}`);
});
