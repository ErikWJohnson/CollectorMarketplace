# Collector Marketplace

Dark, collector-first marketplace for buying, selling, and trading objects with a story.

## What is included

- A responsive collector feed with search, tags, categories, likes, comments, trade offers, activity, and notifications.
- Mobile navigation for Browse, Market, Chat, and Sell.
- A cohesive dark visual system, framed collectible-card posts, and custom SVG logo assets.
- A static homepage at the repository root for GitHub Pages and a full Express app under `public/` for interactive use.

## Run

Install Node.js 20+ and run:

```bash
npm install
npm start
```

Open `http://localhost:3000`. The app starts with a demo account: `alex@collector.local` / `password123`.

## Repository layout

- `public/` — interactive browser experience and assets served by Express.
- `server.js` — REST API and local JSON-backed demo store.
- `index.html` and `site.css` — static GitHub Pages fallback landing page.
- `CNAME` — custom domain configuration for `collectormarketplace.net`.

## API

The API exposes the requested endpoints (`/signup`, `/login`, `/user/:id`, `/listing`, `/comment`, `/trade`, and `/feed`). Authentication uses a simple bearer token for the MVP. Data lives in `data/store.json`, which is created automatically and intentionally excluded from Git.

For production, replace the small `Store` class in `server.js` with a MongoDB or PostgreSQL repository, use bcrypt and signed JWTs, validate input more strictly, and use object storage for listing images.
