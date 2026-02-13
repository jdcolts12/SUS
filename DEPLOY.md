# Deploy SUS — Start to Finish

Your code is on GitHub: **https://github.com/jdcolts12/sus**

Deploy in this order: **Railway first** (server), then **Vercel** (client).

---

## Step 1: Deploy Server (Railway)

1. Go to **https://railway.app** and sign in with **GitHub**.
2. Click **"New Project"**.
3. Choose **"Deploy from GitHub repo"**.
4. Select **jdcolts12/sus** (connect GitHub if asked).
5. Railway will deploy. Wait for it to finish (green checkmark).
6. Click on the deployed service.
7. Go to **Settings** → **Networking** → **"Generate Domain"**.
8. Copy the URL (e.g. `https://sus-production-xxxx.up.railway.app`).
9. **Save this URL** — you need it for Step 2.

---

## Step 2: Deploy Client (Vercel)

1. Go to **https://vercel.com** and sign in with **GitHub**.
2. Click **"Add New..."** → **"Project"**.
3. Find **jdcolts12/sus** and click **Import**.
4. **Before clicking Deploy**, configure:
   - **Root Directory:** Click **Edit** → type `client` exactly → **Continue**.
   - **Environment Variables:** Click **Add**  
     - Name: `VITE_SOCKET_URL`  
     - Value: paste your **Railway URL** from Step 1  
     - (e.g. `https://sus-production-xxxx.up.railway.app`)
5. Click **Deploy**.
6. Wait for the build to complete.

**If build fails with Root Directory = client:** Leave Root Directory empty and redeploy. The root `vercel.json` will handle the build.

---

## Step 3: Play

Open your Vercel URL (e.g. `https://sus-xxxx.vercel.app`). Create a game, share the code, and play on your phones.

---

## Summary

| Step | Where        | What                                  |
|------|--------------|----------------------------------------|
| 1    | Railway      | Deploy server, get URL                 |
| 2    | Vercel       | Deploy client, set Root = `client`, add `VITE_SOCKET_URL` |
| 3    | Your browser | Play the game                          |
