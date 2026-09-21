# CollectorMarketplace.net

Dark, collector-first marketplace for buying, selling, and trading objects with a story. The repository root is the complete deployable website for `collectormarketplace.net`.

## What is included

- A responsive collector feed with working search, tags, categories, listing details, trade-interest modal, and scrolling pagination.
- Mobile navigation for Browse, Market, Chat, and Sell.
- A cohesive dark visual system, framed collectible-card posts, and custom SVG logo assets.
- An Express server with REST endpoints for accounts, listings, comments, trades, notifications, and feeds.
- Render-ready production serving for the current website at `/` and a health check at `/healthz`.

## Deploy on Render

1. In Render, create a new **Web Service** from `ErikWJohnson/CollectorMarketplace`.
2. Render will read `render.yaml` and use `npm ci` to build and `npm start` to run the server.
3. Confirm the service health check at `https://YOUR-RENDER-URL/healthz` returns `{ "ok": true }`.
4. Add `collectormarketplace.net` as the custom domain in Render and follow its DNS instructions.

Render injects `DATABASE_URL` from the existing `collector-db` Postgres instance. The server stores account, listing, comment, trade, notification, and feed API state in that database. Local development falls back to `data/store.json` when no `DATABASE_URL` is set.

## Security configuration required before public launch

Set a long, random `DATA_ENCRYPTION_KEY` in Render (at least 32 random bytes, stored only as a Render secret). It enables AES-256-GCM encryption for private shipping profiles. Keep `NODE_ENV=production` so the app rejects plain HTTP at the origin; Render/custom-domain TLS must be configured to serve HTTPS (and should be verified for TLS 1.3 in Render's domain settings). Do not commit any secrets to this repository.

The app uses Argon2id for new password hashes, opaque expiring sessions, login throttling, 2FA enrollment, hashed device identifiers, and event auditing. `BLOCKED_IP_HASHES` is an optional comma-separated denylist of the app's truncated IP hashes; a real IP-reputation service and durable SIEM/logging should be added before relying on automated IP blocking at scale. Licensed escrow/custody is not implemented: PayPal capture is a payment flow, not escrow.

## Repository layout

- `index.html`, `site.css`, and `site.js` — complete marketplace website served by Express.
- `data/listings.json` — editable listing data used by the feed.
- `public/wordmark.svg` — Collector Marketplace logo used by the static site.
- `render.yaml` — Render build, start, and health-check configuration.

The legacy public prototype remains in the repository for asset compatibility; Render serves the current root website.
