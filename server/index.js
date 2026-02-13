import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createRound } from './gameLogic.js';
import apiRouter from './api.js';
import * as db from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiRouter);

// Health check for Railway/deployment
app.get('/health', (req, res) => res.json({ ok: true }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory game state (use Redis/DB for production)
const games = new Map();
const roomCodes = new Map(); // 6-char code -> gameId

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createGame(hostId, hostName, hostUserId) {
  const gameId = uuidv4();
  let code = generateRoomCode();
  while (roomCodes.has(code)) code = generateRoomCode();

  const game = {
    id: gameId,
    code,
    hostId,
    players: [{ id: hostId, name: hostName, userId: hostUserId || null }],
    status: 'lobby',
    currentRound: null,
  };

  games.set(gameId, game);
  roomCodes.set(code, gameId);
  return game;
}

io.on('connection', (socket) => {
  socket.on('create-game', ({ playerName, userId }) => {
    const game = createGame(socket.id, playerName, userId);
    socket.join(game.code);
    socket.emit('game-created', {
      code: game.code,
      gameId: game.id,
      playerId: socket.id,
      players: game.players,
    });
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
    });
    io.to(game.code).emit('player-joined', { players: game.players });
  });

  socket.on('start-game', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id) return;
    if (game.players.length < 4) {
      socket.emit('start-error', { message: 'Need at least 4 players to start!' });
      return;
    }
    const playerIds = game.players.map((p) => p.id);
    const round = createRound(playerIds);
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
        payload.word = assignment.roundVariant === 'no_imposter'
          ? `${assignment.word}\n\n(No imposter this round!)`
          : assignment.word;
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
    const round = createRound(playerIds);
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
        payload.word = assignment.roundVariant === 'no_imposter'
          ? `${assignment.word}\n\n(No imposter this round!)`
          : assignment.word;
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
    if (game.currentRound.roundVariant === 'no_imposter') return;

    game.votePhase = 'voting';
    game.votes = {};
    io.to(game.code).emit('vote-started', { players: game.players });
  });

  // Any player submits their vote (multiple player IDs and/or no-imposter)
  socket.on('submit-vote', ({ gameId, votedPlayerIds, noImposter }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing' || game.votePhase !== 'voting') return;
    if (!game.players.some((p) => p.id === socket.id)) return;

    const vote = noImposter
      ? '__no_imposter__'
      : (Array.isArray(votedPlayerIds) ? votedPlayerIds : []).filter((id) =>
          game.players.some((p) => p.id === id)
        );
    game.votes[socket.id] = vote;

    const votedCount = Object.keys(game.votes).length;
    const totalPlayers = game.players.length;
    io.to(game.code).emit('vote-received', { votedCount, totalPlayers });
  });

  // Host reveals imposter after everyone has voted
  socket.on('reveal-imposter', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id || game.status !== 'playing' || game.votePhase !== 'voting') return;

    const round = game.currentRound;
    const totalPlayers = game.players.length;
    const votedCount = Object.keys(game.votes || {}).length;
    if (votedCount < totalPlayers) return;

    // Tally votes: each voted player ID gets +1 per vote; __no_imposter__ doesn't add to anyone
    const tally = {};
    game.players.forEach((p) => { tally[p.id] = 0; });
    Object.values(game.votes || {}).forEach((vote) => {
      if (vote === '__no_imposter__') return;
      if (Array.isArray(vote)) {
        vote.forEach((id) => { if (tally[id] !== undefined) tally[id]++; });
      }
    });

    // Highest vote count = voted out (first in case of tie)
    let votedPlayerId = null;
    let maxVotes = 0;
    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        votedPlayerId = id;
      }
    }
    const votedWasImposter = votedPlayerId ? round.imposterIds.includes(votedPlayerId) : false;

    if (round.roundVariant !== 'no_imposter') {
      game.players.forEach((p) => {
        if (p.userId) {
          const wasImposter = round.imposterIds.includes(p.id);
          const won = wasImposter ? !votedWasImposter : votedWasImposter;
          db.recordRoundResult(p.userId, wasImposter, won);
        }
      });
    }

    game.votePhase = 'revealed';

    const imposterNames = round.imposterIds
      .map((id) => game.players.find((p) => p.id === id)?.name)
      .filter(Boolean);
    const votedPlayerName = votedPlayerId
      ? game.players.find((p) => p.id === votedPlayerId)?.name
      : null;

    io.to(game.code).emit('imposter-revealed', {
      imposterIds: round.imposterIds,
      imposterNames,
      votedPlayerId,
      votedPlayerName,
      wasImposter: votedWasImposter,
      teamWon: votedWasImposter,
    });
  });

  socket.on('record-round-result', ({ gameId, votedPlayerId }) => {
    // Legacy: direct record without voting (kept for compatibility, can remove if unused)
    const game = games.get(gameId);
    if (!game || game.hostId !== socket.id || game.status !== 'playing' || !game.currentRound) return;

    const round = game.currentRound;
    const votedWasImposter = votedPlayerId ? round.imposterIds.includes(votedPlayerId) : false;

    if (round.roundVariant !== 'no_imposter') {
      game.players.forEach((p) => {
        if (p.userId) {
          const wasImposter = round.imposterIds.includes(p.id);
          const won = wasImposter ? !votedWasImposter : votedWasImposter;
          db.recordRoundResult(p.userId, wasImposter, won);
        }
      });
    }

    io.to(game.code).emit('round-result-recorded', {
      votedPlayerId,
      votedPlayerName: game.players.find((p) => p.id === votedPlayerId)?.name,
      wasImposter: votedWasImposter,
      teamWon: votedWasImposter,
    });
  });

  socket.on('disconnect', () => {
    // Clean up if host leaves or game becomes empty
    for (const [gameId, game] of games) {
      const idx = game.players.findIndex((p) => p.id === socket.id);
      if (idx >= 0) {
        game.players.splice(idx, 1);
        io.to(game.code).emit('player-left', { players: game.players });
        if (game.players.length === 0) {
          roomCodes.delete(game.code);
          games.delete(gameId);
        } else if (game.hostId === socket.id) {
          game.hostId = game.players[0].id;
          io.to(game.code).emit('new-host', { hostId: game.hostId });
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
