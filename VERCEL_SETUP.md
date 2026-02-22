# Vercel Setup for Sign In / Create Account (Live)

Sign in and Create Account require the **server** (on Render) to be reachable.

**Important:** For accounts to persist (so users stay logged in forever), you **must** set up [Turso](./TURSO_SETUP.md) on Render. Otherwise Render's free tier wipes the database when the server sleeps.

## 1. Deploy the server on Render

If not already done: push to GitHub. Render will auto-deploy from the repo. Your server URL will be something like:
`https://sus-server.onrender.com` (check your Render dashboard for the exact URL).

## 2. Set up Turso (required for persistent accounts)

Without Turso, accounts are lost when the Render service sleeps or redeploys. See [TURSO_SETUP.md](./TURSO_SETUP.md) to add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to Render.

## 3. Set VITE_SOCKET_URL in Vercel

1. Go to [Vercel Dashboard](https://vercel.com) → your project (sus)
2. **Settings** → **Environment Variables**
3. Add:
   - **Name:** `VITE_SOCKET_URL`
   - **Value:** Your Render server URL (e.g. `https://sus-server.onrender.com`)
   - **Environment:** Production (and Preview if you want)
4. Click **Save**
5. **Redeploy** the project: Deployments → ⋮ on latest → Redeploy

## 4. Verify

After redeploying, hard refresh (Cmd+Shift+R) or use incognito. Create Account and Sign In should work. Users stay logged in on that device until they sign out.
