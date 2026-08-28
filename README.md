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
4. In Render **Environment**, add `MONGODB_URI` using the MongoDB Atlas connection string for your cluster. The Blueprint marks it as a secret and it is never committed to Git.
5. Add `collectormarketplace.net` as the custom domain in Render and follow its DNS instructions.

The server uses MongoDB for account and marketplace API data in production. Set `MONGODB_DB` only if you want a database name other than `collector_marketplace`. Local development can run without MongoDB and uses `data/store.json` instead.

## Repository layout

- `index.html`, `site.css`, and `site.js` — complete marketplace website served by Express.
- `data/listings.json` — editable listing data used by the feed.
- `public/wordmark.svg` — Collector Marketplace logo used by the static site.
- `render.yaml` — Render build, start, and health-check configuration.
- `.env.example` — required MongoDB environment-variable names (no secrets).

The legacy public prototype remains in the repository for asset compatibility; Render serves the current root website.
