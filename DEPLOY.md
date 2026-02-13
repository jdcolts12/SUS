# Get Your Updates Live

Your code has Sign In and Create Account, but it’s not on the live site until you deploy.

## Option A: Push to GitHub (triggers Vercel auto-deploy)

In Terminal:

```bash
cd /Users/joeydias/Desktop/Imposter
git push origin main
```

If you see an auth error, either:

1. **GitHub Desktop**: Open the repo and push from the GUI.
2. **Personal Access Token**: `git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/jdcolts12/sus.git` then `git push origin main`.

---

## Option B: Deploy directly with Vercel CLI

```bash
cd /Users/joeydias/Desktop/Imposter
npx vercel --prod
```

Log in when prompted. This deploys from your local files and skips GitHub.

---

## After deploying

- Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
- Or open the site in an **Incognito/Private** window
- Or clear site data for your app’s domain
