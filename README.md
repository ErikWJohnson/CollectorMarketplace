# Collector Marketplace

Dark, collector-first marketplace for buying, selling, and trading objects with a story. The repository root is the complete deployable website for `collectormarketplace.net` and GitHub Pages.

## What is included

- A responsive collector feed with working search, tags, categories, listing details, trade-interest modal, and scrolling pagination.
- Mobile navigation for Browse, Market, Chat, and Sell.
- A cohesive dark visual system, framed collectible-card posts, and custom SVG logo assets.
- A fully static site: no server or local runtime is needed for the live website.

## Publish

Push changes to `main`. GitHub Pages serves `index.html`, `site.css`, `site.js`, and `data/listings.json` directly from the repository. The `CNAME` file keeps the site associated with `collectormarketplace.net`.

## Repository layout

- `index.html`, `site.css`, and `site.js` — complete static marketplace website.
- `data/listings.json` — editable listing data used by the feed.
- `public/wordmark.svg` — Collector Marketplace logo used by the static site.
- `CNAME` — custom domain configuration for `collectormarketplace.net`.

The legacy local prototype files remain in the repository but are not used by the deployed website.
