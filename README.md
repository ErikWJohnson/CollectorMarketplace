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

The current server stores account and marketplace API data in `data/store.json`. Render's default filesystem is temporary, so account, comment, listing, and trade API data will reset after a redeploy or restart until a persistent database or Render Disk is attached. No paid storage has been created by this repository configuration.

## Repository layout

- `index.html`, `site.css`, and `site.js` — complete marketplace website served by Express.
- `data/listings.json` — editable listing data used by the feed.
- `public/wordmark.svg` — Collector Marketplace logo used by the static site.
- `render.yaml` — Render build, start, and health-check configuration.

The legacy public prototype remains in the repository for asset compatibility; Render serves the current root website.
