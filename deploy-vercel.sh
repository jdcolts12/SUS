#!/bin/bash
set -e
echo "=== Building client ==="
npm run build

echo ""
echo "=== Deploying to Vercel ==="
echo "If prompted, run 'npx vercel login' first to sign in."
echo ""
npx vercel --prod --yes

echo ""
echo "Done! Your app should be live in ~1 min."
echo "Hard refresh (Cmd+Shift+R) or use incognito to see updates."
