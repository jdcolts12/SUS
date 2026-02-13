#!/bin/bash
# Deploy SUS to production
set -e

echo "=== Building client ==="
npm run build

echo ""
echo "=== Deploying to Vercel ==="
npx vercel --prod

echo ""
echo "Deploy done! Your app should be live in ~1 minute."
echo "Do a hard refresh (Cmd+Shift+R) or open in incognito to see updates."
