# Turso Setup (Persistent Accounts & Stats)

On Render's **free tier**, the server filesystem is **ephemeral**—it resets on deploy or when the service sleeps. That means accounts and stats stored in the local SQLite file are lost.

To keep accounts and stats, use **Turso** (free hosted SQLite):

## 1. Create a Turso database

1. Go to [turso.tech](https://turso.tech) and sign up
2. Install the Turso CLI: `brew install tursodatabase/tap/turso` (or see [docs](https://docs.turso.tech/cli/installation))
3. Log in: `turso auth login`
4. Create a DB: `turso db create sus-game`
5. Get credentials:
   ```bash
   turso db show sus-game --url
   turso db tokens create sus-game
   ```

## 2. Add env vars to Render

1. In [Render Dashboard](https://dashboard.render.com) → your **sus-server** service
2. **Environment** → **Environment Variables**
3. Add:
   - `TURSO_DATABASE_URL` = URL from step 5 (e.g. `libsql://sus-game-xxx.turso.io`)
   - `TURSO_AUTH_TOKEN` = token from step 5
4. Save — Render will redeploy automatically

## 3. Done

Once deployed, accounts and stats will persist across restarts and deploys.

---

**Local dev**: Without these env vars, the server uses the local SQLite file in `server/data/game.db`. Turso is optional for development.
