const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'store.json');
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

class Store {
  constructor() { fs.mkdirSync(dataDir, { recursive: true }); this.data = this.load(); this.ensureData(); this.seedBrowseFeed(); this.pool = null; this.writeQueue = Promise.resolve(); }
  ensureData() { ['users', 'listings', 'comments', 'trades', 'notifications', 'activities', 'deliveries'].forEach(key => { if (!Array.isArray(this.data[key])) this.data[key] = []; }); }
  load() {
    if (fs.existsSync(dataFile)) {
      try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { console.warn('Ignoring unreadable local marketplace data.'); }
    }
    const demo = { id: id(), username: 'alexcollects', email: 'alex@collector.local', password: 'password123', avatar: 'AC', bio: 'Vintage paper, space-age objects, and things with a story.', reputation: 98, following: [], createdAt: now() };
    const listings = [
      { id: id(), ownerId: demo.id, title: '1976 NASA Viking Mission Patch', description: 'Original woven patch, excellent condition. A beautiful piece of space history.', category: 'Memorabilia', price: 85, tradeOffer: true, images: ['https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1000&q=80'], status: 'active', likes: [], createdAt: now() },
      { id: id(), ownerId: demo.id, title: 'First Edition Design Annual', description: 'A sharp, colorful book from a beloved era of graphic design.', category: 'Books', price: 45, tradeOffer: false, images: ['https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=1000&q=80'], status: 'active', likes: [], createdAt: now() }
    ];
    return { users: [demo], listings, comments: [], trades: [], deliveries: [], notifications: [], activities: listings.map(l => ({ id: id(), type: 'listing', userId: demo.id, listingId: l.id, createdAt: l.createdAt })) };
  }
  seedBrowseFeed() {
    if (this.data.listings.length >= 6) return;
    const owner = this.data.users[0];
    const additions = [
      ['1964 Topps Mickey Mantle', 'Clean color, strong corners, and a true centerpiece for a vintage baseball collection.', 'Cards', 900, true, 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&w=1000&q=80'],
      ['Sealed 1996 Comic Collector Set', 'Factory sealed set with original display wrap. Stored flat and away from sunlight.', 'Comics', 120, true, 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1000&q=80'],
      ['Polaroid SX-70 Land Camera', 'Classic folding instant camera with a handsome patina. Includes original strap.', 'Vintage', 175, false, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80'],
      ['Japanese Woodblock Print', 'A framed late-century print with rich ink detail and a wonderfully calm palette.', 'Art', 240, true, 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1000&q=80']
    ];
    additions.forEach(([title, description, category, price, tradeOffer, image]) => {
      const listing = { id: id(), ownerId: owner.id, title, description, category, price, tradeOffer, images: [image], status: 'active', likes: [], createdAt: now() };
      this.data.listings.push(listing); this.data.activities.unshift({ id: id(), type: 'listing', userId: owner.id, listingId: listing.id, createdAt: listing.createdAt });
    });
  }
  async initialize() {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL is not set; using local development data.');
      this.save();
      return;
    }
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await this.pool.query('CREATE TABLE IF NOT EXISTS marketplace_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const result = await this.pool.query('SELECT data FROM marketplace_state WHERE id = $1', ['primary']);
    if (result.rows[0]?.data) this.data = result.rows[0].data;
    this.ensureData();
    this.seedBrowseFeed();
    await this.save();
    console.log('Connected to collector-db.');
  }
  save() {
    fs.writeFileSync(dataFile, JSON.stringify(this.data, null, 2));
    if (this.pool) this.writeQueue = this.writeQueue.then(() => this.pool.query('INSERT INTO marketplace_state (id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()', ['primary', JSON.stringify(this.data)])).catch(error => console.error('Postgres save failed:', error));
    return this.writeQueue;
  }
}
const store = new Store();
app.use(express.json({ limit: '16mb' }));
app.get('/healthz', (req, res) => res.status(200).json({ ok: true, service: 'CollectorMarketplace.net', database: store.pool ? 'collector-db' : 'local' }));

function publicUser(user) { if (!user) return null; const { password, ...safe } = user; return safe; }
function currentUser(req) { const token = req.headers.authorization?.replace('Bearer ', ''); return store.data.users.find(u => u.id === token); }
function required(req, res, next) { const user = currentUser(req); if (!user) return res.status(401).json({ error: 'Sign in required' }); req.user = user; next(); }
function activity(type, userId, extra = {}) { store.data.activities.unshift({ id: id(), type, userId, createdAt: now(), ...extra }); }
function notify(userId, type, message, link) { store.data.notifications.unshift({ id: id(), userId, type, message, link, read: false, createdAt: now() }); }

app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, and password are required' });
  if (store.data.users.some(u => u.email === email || u.username === username)) return res.status(409).json({ error: 'Email or username already in use' });
  const user = { id: id(), username, email, password, avatar: username.slice(0, 2).toUpperCase(), bio: '', reputation: 0, following: [], createdAt: now() };
  store.data.users.push(user); store.save(); res.status(201).json({ token: user.id, user: publicUser(user) });
});
app.post('/login', (req, res) => { const user = store.data.users.find(u => u.email === req.body.email && u.password === req.body.password); if (!user) return res.status(401).json({ error: 'Invalid email or password' }); res.json({ token: user.id, user: publicUser(user) }); });
app.get('/user/:id', (req, res) => { const user = store.data.users.find(u => u.id === req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); const listings = store.data.listings.filter(l => l.ownerId === user.id); const history = store.data.trades.filter(t => (t.senderId === user.id || t.receiverId === user.id) && t.status === 'completed'); res.json({ ...publicUser(user), activeListings: listings.filter(l => l.status === 'active'), tradeHistory: history }); });
app.put('/user/:id', required, (req, res) => { if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Not allowed' }); ['username','avatar','bio'].forEach(k => { if (req.body[k] !== undefined) req.user[k] = req.body[k]; }); activity('profile', req.user.id); store.save(); res.json(publicUser(req.user)); });
app.post('/user/:id/follow', required, (req, res) => { if (req.user.id === req.params.id) return res.status(400).json({ error: 'You cannot follow yourself' }); if (!store.data.users.some(u => u.id === req.params.id)) return res.status(404).json({ error: 'User not found' }); const following = req.user.following; const index = following.indexOf(req.params.id); index < 0 ? following.push(req.params.id) : following.splice(index, 1); store.save(); res.json({ following: index < 0 }); });

app.get('/listings', (req, res) => { const { category, q, status = 'active' } = req.query; let rows = store.data.listings.filter(l => !status || l.status === status); if (category) rows = rows.filter(l => l.category === category); if (q) { const s = q.toLowerCase(); rows = rows.filter(l => `${l.title} ${l.description}`.toLowerCase().includes(s)); } res.json(rows.map(l => ({ ...l, owner: publicUser(store.data.users.find(u => u.id === l.ownerId)), likeCount: l.likes.length }))); });
app.post('/listing', required, (req, res) => { const { title, description, category, price, tradeOffer, images = [], videos = [] } = req.body; const validImages = Array.isArray(images) && images.length > 0 && images.length <= 5 && images.every(image => typeof image === 'string' && image.length <= 2_000_000 && (/^https?:\/\//i.test(image) || /^data:image\/(jpeg|png|webp);base64,/i.test(image))); const validVideos = Array.isArray(videos) && videos.length <= 1 && videos.every(video => typeof video === 'string' && video.length <= 6_000_000 && /^data:video\/(mp4|webm|quicktime);base64,/i.test(video)); if (!title?.trim() || !description?.trim() || !category?.trim()) return res.status(400).json({ error: 'title, description, and category are required' }); if (!validImages) return res.status(400).json({ error: 'Add 1–5 valid image links or uploads.' }); if (!validVideos) return res.status(400).json({ error: 'Add at most one valid uploaded video.' }); const listing = { id: id(), ownerId: req.user.id, title: title.trim(), description: description.trim(), category: category.trim(), price: Number(price) || 0, tradeOffer: Boolean(tradeOffer), images, videos, status: 'active', likes: [], createdAt: now() }; store.data.listings.unshift(listing); activity('listing', req.user.id, { listingId: listing.id }); store.save(); res.status(201).json(listing); });
app.get('/listing/:id', (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); res.json({ ...listing, owner: publicUser(store.data.users.find(u => u.id === listing.ownerId)), likeCount: listing.likes.length }); });
app.put('/listing/:id', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Not allowed' }); ['title','description','category','price','tradeOffer','images','status'].forEach(k => { if (req.body[k] !== undefined) listing[k] = req.body[k]; }); store.save(); res.json(listing); });
app.delete('/listing/:id', required, (req, res) => { const i = store.data.listings.findIndex(l => l.id === req.params.id && l.ownerId === req.user.id); if (i < 0) return res.status(404).json({ error: 'Listing not found' }); store.data.listings.splice(i, 1); store.save(); res.status(204).end(); });
app.post('/listing/:id/like', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); const i = listing.likes.indexOf(req.user.id); if (i < 0) { listing.likes.push(req.user.id); if (listing.ownerId !== req.user.id) notify(listing.ownerId, 'like', `${req.user.username} liked “${listing.title}”`, `/listing/${listing.id}`); activity('like', req.user.id, { listingId: listing.id }); } else listing.likes.splice(i, 1); store.save(); res.json({ liked: i < 0, likeCount: listing.likes.length }); });

app.post('/comment', required, (req, res) => { const { listingId, body, parentId } = req.body; const listing = store.data.listings.find(l => l.id === listingId); const parent = parentId ? store.data.comments.find(c => c.id === parentId) : null; if (!listing || !body?.trim()) return res.status(400).json({ error: 'Valid listingId and body required' }); if (parentId && (!parent || parent.listingId !== listingId)) return res.status(400).json({ error: 'Reply must belong to the same listing' }); const comment = { id: id(), listingId, userId: req.user.id, body: body.trim(), parentId: parentId || null, createdAt: now() }; store.data.comments.push(comment); const owner = parent ? parent.userId : listing.ownerId; if (owner && owner !== req.user.id) notify(owner, 'comment', `${req.user.username} commented on “${listing.title}”`, `/listing/${listing.id}`); activity('comment', req.user.id, { listingId, commentId: comment.id }); store.save(); res.status(201).json({ ...comment, user: publicUser(req.user) }); });
app.get('/comments/:listingId', (req, res) => res.json(store.data.comments.filter(c => c.listingId === req.params.listingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(c => ({ ...c, user: publicUser(store.data.users.find(u => u.id === c.userId)) }))));

app.post('/trade', required, (req, res) => { const { receiverId, listingId, offerDetails } = req.body; const listing = store.data.listings.find(l => l.id === listingId); if (!listing || !offerDetails?.trim()) return res.status(400).json({ error: 'Valid listing and offer details required' }); if (listing.ownerId !== receiverId || receiverId === req.user.id) return res.status(400).json({ error: 'Invalid trade recipient' }); const trade = { id: id(), senderId: req.user.id, receiverId, listingId, offerDetails: offerDetails.trim(), status: 'pending', messages: [], createdAt: now() }; store.data.trades.unshift(trade); notify(receiverId, 'trade', `${req.user.username} sent a trade offer for “${listing.title}”`, `/trade/${trade.id}`); activity('trade', req.user.id, { listingId, tradeId: trade.id }); store.save(); res.status(201).json(trade); });
function tradeView(trade, userId) { const listing = store.data.listings.find(row => row.id === trade.listingId); const otherUser = store.data.users.find(row => row.id === (trade.senderId === userId ? trade.receiverId : trade.senderId)); return { ...trade, listing, otherUser: publicUser(otherUser) }; }
app.get('/trades', required, (req, res) => res.json(store.data.trades.filter(t => t.senderId === req.user.id || t.receiverId === req.user.id).map(t => tradeView(t, req.user.id))));
app.get('/trade/:id', required, (req, res) => { const trade = store.data.trades.find(t => t.id === req.params.id); if (!trade || (trade.senderId !== req.user.id && trade.receiverId !== req.user.id)) return res.status(404).json({ error: 'Trade not found' }); res.json(tradeView(trade, req.user.id)); });
app.put('/trade/:id', required, (req, res) => { const trade = store.data.trades.find(t => t.id === req.params.id); if (!trade || (trade.senderId !== req.user.id && trade.receiverId !== req.user.id)) return res.status(404).json({ error: 'Trade not found' }); const { status, message } = req.body; if (status && !['accepted','declined','completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' }); if (status) { if (['accepted','declined'].includes(status) && trade.receiverId !== req.user.id) return res.status(403).json({ error: 'Only the listing owner can accept or decline this trade' }); if (status === 'completed' && trade.status !== 'accepted') return res.status(400).json({ error: 'Only accepted trades can be completed' }); trade.status = status; if (status === 'completed') { const l = store.data.listings.find(l => l.id === trade.listingId); if (l) l.status = 'traded'; } notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', `${req.user.username} marked the trade ${status}`, `/trade/${trade.id}`); } if (message?.trim()) trade.messages.push({ id: id(), senderId: req.user.id, body: message.trim(), createdAt: now() }); store.save(); res.json(tradeView(trade, req.user.id)); });

function deliveryView(delivery, userId) { const listing = store.data.listings.find(row => row.id === delivery.listingId); const buyer = store.data.users.find(row => row.id === delivery.buyerId); const seller = store.data.users.find(row => row.id === delivery.sellerId); return { ...delivery, listing, buyer: publicUser(buyer), seller: publicUser(seller), shippingAddress: delivery.buyerId === userId || delivery.sellerId === userId ? delivery.shippingAddress : undefined }; }
app.post('/purchase', required, (req, res) => {
  const { listingId, shippingAddress } = req.body;
  const listing = store.data.listings.find(row => row.id === listingId && row.status === 'active');
  if (!listing) return res.status(404).json({ error: 'Active listing not found' });
  if (listing.ownerId === req.user.id) return res.status(400).json({ error: 'You cannot purchase your own listing' });
  if (!shippingAddress?.trim()) return res.status(400).json({ error: 'A delivery address is required' });
  const delivery = { id: id(), listingId: listing.id, buyerId: req.user.id, sellerId: listing.ownerId, shippingAddress: shippingAddress.trim(), status: 'awaiting_seller_dispatch', courier: '', trackingNumber: '', messages: [], createdAt: now(), updatedAt: now() };
  listing.status = 'pending_delivery'; store.data.deliveries.unshift(delivery); notify(listing.ownerId, 'delivery', `${req.user.username} started a purchase delivery for “${listing.title}”`, `/delivery/${delivery.id}`); activity('purchase', req.user.id, { listingId: listing.id, deliveryId: delivery.id }); store.save(); res.status(201).json(deliveryView(delivery, req.user.id));
});
app.get('/deliveries', required, (req, res) => res.json(store.data.deliveries.filter(row => row.buyerId === req.user.id || row.sellerId === req.user.id).map(row => deliveryView(row, req.user.id))));
app.get('/delivery/:id', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' }); res.json(deliveryView(delivery, req.user.id)); });
app.put('/delivery/:id', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' });
  const sellerStatuses = ['packed', 'picked_up', 'in_transit']; const buyerStatuses = ['issue_reported']; const { status, courier, trackingNumber } = req.body;
  if (status && !sellerStatuses.includes(status) && !(delivery.buyerId === req.user.id && buyerStatuses.includes(status))) return res.status(403).json({ error: 'This delivery update is not allowed' });
  if (status) delivery.status = status; if (delivery.sellerId === req.user.id) { if (courier !== undefined) delivery.courier = String(courier); if (trackingNumber !== undefined) delivery.trackingNumber = String(trackingNumber); }
  delivery.updatedAt = now(); const otherUser = delivery.buyerId === req.user.id ? delivery.sellerId : delivery.buyerId; notify(otherUser, 'delivery', `${req.user.username} updated delivery status to ${delivery.status.replaceAll('_', ' ')}`, `/delivery/${delivery.id}`); store.save(); res.json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/confirm', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || delivery.buyerId !== req.user.id) return res.status(404).json({ error: 'Delivery not found' }); delivery.status = 'completed'; delivery.updatedAt = now(); const listing = store.data.listings.find(row => row.id === delivery.listingId); if (listing) listing.status = 'sold'; notify(delivery.sellerId, 'delivery', `${req.user.username} confirmed delivery for “${listing?.title || 'your listing'}”`, `/delivery/${delivery.id}`); store.save(); res.json(deliveryView(delivery, req.user.id)); });
app.post('/delivery/:id/messages', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' }); if (!req.body.body?.trim()) return res.status(400).json({ error: 'A message is required' }); const message = { id: id(), senderId: req.user.id, body: req.body.body.trim(), createdAt: now() }; delivery.messages.push(message); delivery.updatedAt = now(); notify(delivery.buyerId === req.user.id ? delivery.sellerId : delivery.buyerId, 'delivery_message', `${req.user.username} sent a delivery message`, `/delivery/${delivery.id}`); store.save(); res.status(201).json(message); });
app.get('/feed/global', (req, res) => res.json(store.data.activities.slice(0, 50).map(a => ({ ...a, user: publicUser(store.data.users.find(u => u.id === a.userId)), listing: a.listingId ? store.data.listings.find(l => l.id === a.listingId) : null }))));
app.get('/feed/user/:id', (req, res) => { const user = store.data.users.find(u => u.id === req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); const people = new Set([user.id, ...user.following]); res.json(store.data.activities.filter(a => people.has(a.userId)).slice(0, 50).map(a => ({ ...a, user: publicUser(store.data.users.find(u => u.id === a.userId)), listing: a.listingId ? store.data.listings.find(l => l.id === a.listingId) : null }))); });
app.get('/notifications', required, (req, res) => res.json(store.data.notifications.filter(n => n.userId === req.user.id)));

// The current production website lives at the repository root. Keep the old
// public directory available for the logo and legacy assets without exposing
// the server's private data directory.
const rootSiteAssets = new Set([
  'site.js', 'site.css', 'layout-fixes.css', 'full-width.css', 'immersive-feed.css',
  'persistent-dock.css', 'marketplace-policy.css', 'post-fill.css', 'full-image.css',
  'header-optimized.css', 'auction-house.css', 'scrolling-header.css',
  'scrolling-discovery.css', 'site-functionality.css', 'header-corner-fix.css',
  'functional-discovery.css', 'logo-raster.css', 'social-posts.css', 'account-panel.css',
  'favicon.png'
]);
app.use('/public', express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/data/listings.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'listings.json')));
app.get('/data/auctions.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'auctions.json')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:asset', (req, res, next) => {
  if (!rootSiteAssets.has(req.params.asset)) return next();
  return res.sendFile(path.join(__dirname, req.params.asset));
});

async function start() {
  try {
    await store.initialize();
    app.listen(PORT, () => console.log(`Collector Marketplace running at http://localhost:${PORT}`));
  } catch (error) {
    console.error('Collector Marketplace could not connect to collector-db:', error.message);
    process.exit(1);
  }
}
start();
