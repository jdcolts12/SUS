# SUS — Run Locally & Deploy

Your code: **https://github.com/jdcolts12/sus**

---

## Run Locally (test first)

Open a terminal in the project folder and run:

```bash
cd /Users/joeydias/Desktop/Imposter
npm run dev
```

This starts:
- **Server** on http://localhost:3001
- **Client** on http://localhost:5173

**If port 3001 or 5173 is in use:**
```bash
# Kill whatever is using those ports, then:
npm run dev
```

Open **http://localhost:5173** in your browser. Create a game, join from your phone (same WiFi, use your computer's IP like `http://192.168.1.x:5173`). If it works locally, you're ready to deploy.

Stop with `Ctrl+C`.

---

## Deploy to Production

Deploy in order: **Railway** (server) → **Vercel** (client).

### Step 1: Server on Railway

1. Go to **https://railway.app** → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select **jdcolts12/sus**.
3. Wait for deploy to finish.
4. Click the service → **Settings** → **Networking** → **Generate Domain**.
5. Copy the URL (e.g. `https://sus-production-xxxx.up.railway.app`). Save it.

### Step 2: Client on Vercel

1. Go to **https://vercel.com** → sign in with GitHub.
2. **Add New** → **Project** → import **jdcolts12/sus**.
3. **Root Directory:** Edit → type `client` → Continue.
4. **Environment Variables:** Add  
   - Name: `VITE_SOCKET_URL`  
   - Value: your Railway URL from Step 1
5. Click **Deploy**.

**If build fails:** Clear Root Directory and redeploy (root `vercel.json` will build).

### Step 3: Play

Open your Vercel URL. Create a game and share the code with friends.
