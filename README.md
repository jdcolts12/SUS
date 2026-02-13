# SUS

A remote multiplayer word game. Everyone gets a word on their phone—except who's SUS, who only knows the category. Take turns describing your word without saying it. Can you spot the fake?

## How to Play

1. **Create** a game and share the 6-letter room code with friends
2. **Join** with the code from your phone
3. **Start** when everyone's in (4–10 players)
4. Each player gets their word and turn order: "You're first", "You're second", etc.
5. The **Imposter** sees the category + "IMPOSTER" (e.g. "Animals" + "IMPOSTER")—they must blend in without knowing the actual word
6. Discuss, vote, and reveal! Then start a new round

## Run Locally

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start server and client
npm run dev
```

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

Open the client URL on your phone (same WiFi)—Vite runs with `--host` so use your computer's IP (e.g. `http://192.168.1.x:5173`) for multi-device testing.

## Deploy to Vercel + Railway

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions to go live.

## Tech

- **Backend**: Express + Socket.io (real-time)
- **Frontend**: React + Vite (mobile-first)
- **Words**: 10 categories, 10 words each (expand in `server/words.js`)
