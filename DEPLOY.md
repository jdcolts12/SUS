# Deploy to Vercel

## Fixed: npm dependency conflict

Added `.npmrc` with `legacy-peer-deps=true` to fix the vercel peer dependency error.

## Deploy (run in your Terminal)

```bash
cd /Users/joeydias/Desktop/Imposter
npm run deploy
```

If it prompts for scope/team, choose **joes-projects-d2326431**.

Or run interactively (will prompt for options):
```bash
cd /Users/joeydias/Desktop/Imposter
npx vercel --prod
```
