# Deploy SUS to Production

The app has two parts:
- **Client** (React) → Vercel (static hosting)
- **Server** (Express + Socket.io) → Railway (WebSockets need a persistent server)

Deploy the **server first**, then the **client** (so you have the server URL for the env var).

---

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/imposter.git
git push -u origin main
```

---

## 2. Deploy Server to Railway

1. Go to [railway.app](https://railway.app) and sign in (GitHub).
2. **New Project** → **Deploy from GitHub repo** → select your repo.
3. Railway will detect Node.js and deploy. It uses the root `package.json` and `npm start`.
4. After deploy: **Settings** → **Networking** → **Generate Domain**.
5. Copy the URL (e.g. `https://imposter-production.up.railway.app`).  
   Use the **root URL** (no trailing path). You’ll need it for the client.

---

## 3. Deploy Client to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub).
2. **Add New** → **Project** → import your repo.
3. **Configure:**
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables:**
   - Add `VITE_SOCKET_URL` = your Railway URL (e.g. `https://imposter-production.up.railway.app`)
   - No `https://` vs `http://` issues—use whatever Railway gives you.
5. **Deploy.**

---

## 4. Test

Visit your Vercel URL, create a game, and join from another device. Everything should connect through the Railway server.

---

## Troubleshooting

- **Client can’t connect:** Ensure `VITE_SOCKET_URL` is set in Vercel and redeployed.
- **CORS errors:** The server uses `origin: '*'` by default. If you lock down CORS, add your Vercel domain.
- **Railway sleep:** On the free tier, the server may sleep; the first request might be slow.
