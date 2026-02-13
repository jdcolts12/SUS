import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createRound } from './gameLogic.js';

const app = express();
app.use(cors());
app.use(express.json());

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

function createGame(hostId, hostName) {
  const gameId = uuidv4();
  let code = generateRoomCode();
  while (roomCodes.has(code)) code = generateRoomCode();

  const game = {
    id: gameId,
    code,
    hostId,
    players: [{ id: hostId, name: hostName }],
    status: 'lobby', // lobby, playing
    currentRound: null,
  };

  games.set(gameId, game);
  roomCodes.set(code, gameId);
  return game;
}

io.on('connection', (socket) => {
  socket.on('create-game', ({ playerName }) => {
    const game = createGame(socket.id, playerName);
    socket.join(game.code);
    socket.emit('game-created', {
      code: game.code,
      gameId: game.id,
      playerId: socket.id,
      players: game.players,
    });
  });

  socket.on('join-game', ({ code, playerName }) => {
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
    game.players.push({ id: socket.id, name: playerName });
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
