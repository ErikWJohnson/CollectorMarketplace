# Collector Marketplace

Social marketplace MVP for collector-to-collector listings and trades.

## Run

Install Node.js 20+ and run:

```bash
npm install
npm start
```

Open `http://localhost:3000`. The app starts with a demo account: `alex@collector.local` / `password123`.

## API

The API exposes the requested endpoints (`/signup`, `/login`, `/user/:id`, `/listing`, `/comment`, `/trade`, and `/feed`). Authentication uses a simple bearer token for the MVP. Data lives in `data/store.json`, which is created automatically and intentionally excluded from Git.

For production, replace the small `Store` class in `server.js` with a MongoDB or PostgreSQL repository, use bcrypt and signed JWTs, validate input more strictly, and use object storage for listing images.
