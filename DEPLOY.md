# SUS — Run Locally & Deploy

Your code: **https://github.com/jdcolts12/sus**

---

## Run Locally (test first)

```bash
cd /Users/joeydias/Desktop/Imposter
npm run dev
```

Open **http://localhost:5173**. Create a game, test it. Stop with `Ctrl+C`.

---

## Deploy to Production

**Server** (choose one) → **Vercel** (client)

---

### Option A: Server on Render (recommended)

1. Go to **https://render.com** → sign in with GitHub.
2. **New** → **Web Service**.
3. Connect repo **jdcolts12/sus**.
4. Render will auto-detect from `render.yaml`:
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
5. Click **Create Web Service**.
6. Wait for deploy. Your URL will be like `https://sus-server.onrender.com`.
7. **Copy that URL** — use it for `VITE_SOCKET_URL` in Vercel.

---

### Option B: Server on Railway

1. Go to **https://railway.app** → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → **jdcolts12/sus**.
3. After deploy: **Settings** → **Networking** → **Generate Domain**.
4. **Custom Start Command:** `node server/index.js` (in Settings → Deploy).
5. Copy the URL.

---

### Client on Vercel

1. Go to **https://vercel.com** → **Add New** → **Project** → **jdcolts12/sus**.
2. **Root Directory:** `client`
3. **Environment Variables:** Add `VITE_SOCKET_URL` = your **server URL** (Render or Railway).
4. **Deploy** → then **Redeploy** after adding the env var.

---

### Play

Open your Vercel URL. Create a game and share the code.
