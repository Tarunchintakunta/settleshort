#!/usr/bin/env bash
# One command to ship SettleShort to production (frontend + API are one Next.js app on Vercel).
#   pnpm ship
# Checks -> migrate the production database -> deploy -> make it live -> health check.
# Env vars live in Vercel (never uploaded from here: see .vercelignore). The DB migration uses
# DATABASE_URL from .env.local, which must point at the production Neon database.
set -euo pipefail
cd "$(dirname "$0")/.."
URL="https://settleshort.vercel.app"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Preflight"
command -v vercel >/dev/null || { echo "Install the Vercel CLI: pnpm add -g vercel"; exit 1; }
vercel whoami >/dev/null 2>&1 || { echo "Run: vercel login"; exit 1; }
[ -f .env.local ] && grep -q '^DATABASE_URL=' .env.local || { echo ".env.local needs DATABASE_URL (production Neon)"; exit 1; }
[ -z "$(git status --porcelain)" ] || echo "Warning: uncommitted changes will be deployed."

step "Install"
pnpm install --frozen-lockfile

step "Lint, typecheck, test"
pnpm lint
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm test

step "Migrate production database"
pnpm db:migrate

step "Deploy to Vercel"
DEPLOY_URL=$(vercel deploy --prod --yes 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | tail -1)
[ -n "$DEPLOY_URL" ] || { echo "Deploy failed: run 'vercel deploy --prod' to see why"; exit 1; }
echo "Built $DEPLOY_URL"
# Makes sure the domain points at this build even if an earlier rollback paused auto-assignment.
vercel promote "$DEPLOY_URL" --yes >/dev/null 2>&1 || true

step "Health check"
for i in 1 2 3 4 5 6; do
  if HEALTH=$(curl -fsS "$URL/api/v1/health"); then echo "$HEALTH"; break; fi
  sleep 5
done
echo "$HEALTH" | grep -q '"ok":true' || { echo "Health check failed. Roll back with: vercel rollback"; exit 1; }
echo "$HEALTH" | grep -q '"paypal":"sandbox"' || echo "Note: PayPal is in simulator mode (PAYPAL_CLIENT_ID/SECRET not set in Vercel)."

printf '\n\033[1mLive: %s\033[0m\n' "$URL"
