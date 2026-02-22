# Sign In Live – Quick Checklist

Run these steps to get sign-in and Create Account working in production.

## 1. Push your code

```bash
cd /Users/joeydias/Desktop/Imposter
git push origin main
```

## 2. Set up Turso (accounts persist forever)

Without Turso, Render wipes the database when the server sleeps. Accounts would be lost.

1. Sign up at [turso.tech](https://turso.tech)
2. Install CLI: `brew install tursodatabase/tap/turso`
3. Log in: `turso auth login`
4. Create DB: `turso db create sus-game`
5. Get credentials:
   ```bash
   turso db show sus-game --url
   turso db tokens create sus-game
   ```
6. In [Render Dashboard](https://dashboard.render.com) → your **sus-server** service → **Environment**
7. Add variables:
   - `TURSO_DATABASE_URL` = the URL from step 5
   - `TURSO_AUTH_TOKEN` = the token from step 5
8. Save (Render will redeploy)

## 3. Set VITE_SOCKET_URL in Vercel

1. Go to [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Add: `VITE_SOCKET_URL` = `https://YOUR-RENDER-URL.onrender.com` (no trailing slash)
3. **Redeploy** (Deployments → ⋮ on latest → Redeploy)

## 4. Verify

- Visit `https://YOUR-RENDER-URL.onrender.com/health` – should show `{"ok":true,"db":"turso"}` (if Turso is set)
- Visit your Vercel URL → Create account → Sign out → Sign in again → Should work
