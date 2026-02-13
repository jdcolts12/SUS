# Deploy SUS — Fresh Start

Two parts: **Server** (Railway) and **Client** (Vercel). Do the server first so you have the URL for the client.

---

## Step 1: Server on Railway

1. Open **https://railway.app** and sign in with GitHub.
2. Click **"New Project"** → **"Deploy from GitHub repo"**.
3. Pick your repo (e.g. `sus`). Railway will deploy the server automatically.
4. Click the deployed service → **Settings** → **Networking** → **"Generate Domain"**.
5. Copy the URL (e.g. `https://sus-production-abcd.up.railway.app`). Keep it for Step 3.

---

## Step 2: Client on Vercel

1. Open **https://vercel.com** and sign in with GitHub.
2. Click **"Add New"** → **"Project"** → select the same repo.
3. **Important:** Click **"Edit"** next to Root Directory.
4. Type `client` and confirm.
5. Under **Environment Variables**, add:
   - **Name:** `VITE_SOCKET_URL`
   - **Value:** paste your Railway URL from Step 1 (e.g. `https://sus-production-abcd.up.railway.app`)
6. Click **Deploy**.

Vercel will:
- Build from the `client` folder
- Detect Vite
- Run `npm run build`

---

## Step 3: Test

Open your Vercel URL (e.g. `https://sus-xxx.vercel.app`). Create a game and join from another device.

---

## If Vercel Build Fails

Make sure **Root Directory** is set to `client`. Without it, the build runs from the repo root and fails.
