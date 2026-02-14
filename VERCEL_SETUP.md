# Vercel Setup for Create Account to Work

Create Account requires the **server** (on Render) to be reachable. The client needs to know the server URL.

## 1. Deploy the server on Render

If not already done: push to GitHub. Render will auto-deploy from the repo. Your server URL will be something like:
`https://sus-server.onrender.com` (check your Render dashboard for the exact URL).

## 2. Set VITE_SOCKET_URL in Vercel

1. Go to [Vercel Dashboard](https://vercel.com) → your project (sus)
2. **Settings** → **Environment Variables**
3. Add:
   - **Name:** `VITE_SOCKET_URL`
   - **Value:** Your Render server URL (e.g. `https://sus-server.onrender.com`)
   - **Environment:** Production (and Preview if you want)
4. Click **Save**
5. **Redeploy** the project: Deployments → ⋮ on latest → Redeploy

## 3. Verify

After redeploying, hard refresh (Cmd+Shift+R) or use incognito. Create Account should work.
