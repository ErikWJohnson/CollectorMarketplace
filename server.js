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
const deliveryProviders = {
  USPS: { type: 'carrier', trackingRequired: true }, UPS: { type: 'carrier', trackingRequired: true }, FedEx: { type: 'carrier', trackingRequired: true }, 'DHL Express': { type: 'carrier', trackingRequired: true }, 'Amazon Logistics': { type: 'carrier', trackingRequired: true }, OnTrac: { type: 'carrier', trackingRequired: true }, LaserShip: { type: 'carrier', trackingRequired: true }, Veho: { type: 'carrier', trackingRequired: true }, Roadie: { type: 'local_courier', trackingRequired: true }, 'DoorDash Drive': { type: 'local_courier', trackingRequired: true }, 'Uber Direct': { type: 'local_courier', trackingRequired: true }, 'Instacart Local Delivery': { type: 'local_courier', trackingRequired: true }, GoShare: { type: 'local_courier', trackingRequired: true }, uShip: { type: 'freight_marketplace', trackingRequired: true }, Shippo: { type: 'shipping_platform', trackingRequired: true }, 'Pirate Ship': { type: 'shipping_platform', trackingRequired: true }, 'Canada Post': { type: 'carrier', trackingRequired: true }, Purolator: { type: 'carrier', trackingRequired: true }, 'Royal Mail': { type: 'carrier', trackingRequired: true }, Evri: { type: 'carrier', trackingRequired: true }, DPD: { type: 'carrier', trackingRequired: true }, 'Australia Post': { type: 'carrier', trackingRequired: true }, 'Local independent courier': { type: 'independent_courier', trackingRequired: false }, 'Independent owner-operator': { type: 'independent_courier', trackingRequired: false }, 'White-glove delivery': { type: 'specialty', trackingRequired: true }, 'Freight / LTL carrier': { type: 'freight', trackingRequired: true }, 'Local pickup': { type: 'pickup', trackingRequired: false }, 'Other courier': { type: 'custom', trackingRequired: true }
};
const paymentMethods = new Set(['Card (Square)', 'Apple Pay', 'Google Pay', 'Cash App Pay', 'Venmo', 'PayPal', 'ACH bank transfer']);
const collectiveCatalog = [
  { id: 'card-vault', name: 'Card Vault', description: 'Sports cards, TCG, and grading talk for serious collectors.', tags: ['Sports Cards', 'Cards', 'Autographs'], members: 1284 },
  { id: 'modern-relics', name: 'Modern Relics', description: 'Design, art, books, and objects with a lasting story.', tags: ['Art', 'Books', 'Vintage'], members: 846 },
  { id: 'timekeepers', name: 'Timekeepers', description: 'Watches, jewelry, and collectible craftsmanship.', tags: ['Watches', 'Fine Jewelry', 'Luxury'], members: 619 },
  { id: 'pixel-arcade', name: 'Pixel Arcade', description: 'Gaming hardware, retro games, and console collectors.', tags: ['Gaming', 'Consoles', 'Arcade Machines'], members: 932 }
];
const brandCatalog = [];

class Store {
  constructor() { fs.mkdirSync(dataDir, { recursive: true }); this.data = this.load(); this.ensureData(); this.seedBrowseFeed(); this.pool = null; this.writeQueue = Promise.resolve(); }
  ensureData() { ['users', 'listings', 'comments', 'trades', 'notifications', 'activities', 'deliveries', 'conversations'].forEach(key => { if (!Array.isArray(this.data[key])) this.data[key] = []; }); }
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
// Voice audio stays peer-to-peer. These short-lived rooms only carry WebRTC
// signaling and presence, so no microphone audio is stored by the marketplace.
const voiceRooms = new Map();
app.use(express.json({ limit: '16mb' }));
app.get('/healthz', (req, res) => res.status(200).json({ ok: true, service: 'CollectorMarketplace.net', database: store.pool ? 'collector-db' : 'local' }));

function publicUser(user) { if (!user) return null; const { password, ...safe } = user; return safe; }
function directoryUser(user) { if (!user) return null; const { password, email, ...safe } = user; return safe; }
function currentUser(req) { const token = req.headers.authorization?.replace('Bearer ', ''); return store.data.users.find(u => u.id === token); }
function required(req, res, next) { const user = currentUser(req); if (!user) return res.status(401).json({ error: 'Sign in required' }); req.user = user; next(); }
function activity(type, userId, extra = {}) { store.data.activities.unshift({ id: id(), type, userId, createdAt: now(), ...extra }); }
function notify(userId, type, message, link) { store.data.notifications.unshift({ id: id(), userId, type, message, link, read: false, createdAt: now() }); }
function usCityTownTag(location) {
  const parts = String(location || '').split(',').map(part => part.trim()).filter(Boolean);
  const country = parts.at(-1) || '';
  if (!/^(?:united states(?: of america)?|u\.?s\.?a\.?)$/i.test(country) || !parts[0]) return '';
  const place = parts.slice(0, -1).join(', ');
  return place ? `US City/Town: ${place}` : '';
}

app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, and password are required' });
  if (store.data.users.some(u => u.email === email || u.username === username)) return res.status(409).json({ error: 'Email or username already in use' });
  const user = { id: id(), username, email, password, avatar: username.slice(0, 2).toUpperCase(), bio: '', reputation: 0, following: [], createdAt: now() };
  store.data.users.push(user); store.save(); res.status(201).json({ token: user.id, user: publicUser(user) });
});
app.post('/login', (req, res) => { const user = store.data.users.find(u => u.email === req.body.email && u.password === req.body.password); if (!user) return res.status(401).json({ error: 'Invalid email or password' }); res.json({ token: user.id, user: publicUser(user) }); });
app.get('/user/:id', (req, res) => { const user = store.data.users.find(u => u.id === req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); const listings = store.data.listings.filter(l => l.ownerId === user.id); const history = store.data.trades.filter(t => (t.senderId === user.id || t.receiverId === user.id) && t.status === 'completed'); res.json({ ...publicUser(user), activeListings: listings.filter(l => l.status === 'active'), tradeHistory: history }); });
app.get('/users/suggestions', required, (req, res) => { const excluded = new Set([req.user.id, ...req.user.following]); const users = store.data.users.filter(user => !excluded.has(user.id)).sort((a, b) => (b.reputation || 0) - (a.reputation || 0) || a.username.localeCompare(b.username)).slice(0, 8).map(user => ({ ...publicUser(user), activeListingCount: store.data.listings.filter(listing => listing.ownerId === user.id && listing.status === 'active').length })); res.json(users); });
app.get('/users', (req, res) => res.json(store.data.users.map(user => ({ ...directoryUser(user), activeListingCount: store.data.listings.filter(listing => listing.ownerId === user.id && listing.status === 'active').length }))));
app.get('/collectives', (req, res) => res.json(collectiveCatalog));
app.get('/brands', (req, res) => res.json(brandCatalog));
app.put('/user/:id', required, (req, res) => { if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Not allowed' }); ['username','avatar','bio'].forEach(k => { if (req.body[k] !== undefined) req.user[k] = req.body[k]; }); activity('profile', req.user.id); store.save(); res.json(publicUser(req.user)); });
app.post('/user/:id/follow', required, (req, res) => { if (req.user.id === req.params.id) return res.status(400).json({ error: 'You cannot follow yourself' }); if (!store.data.users.some(u => u.id === req.params.id)) return res.status(404).json({ error: 'User not found' }); const following = req.user.following; const index = following.indexOf(req.params.id); index < 0 ? following.push(req.params.id) : following.splice(index, 1); store.save(); res.json({ following: index < 0 }); });
app.get('/user/:id/connections', required, (req, res) => { if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Not allowed' }); const following = store.data.users.filter(user => req.user.following.includes(user.id)); const friends = following.filter(user => user.following.includes(req.user.id)); res.json({ following: following.map(publicUser), friends: friends.map(publicUser) }); });
function conversationView(conversation, userId) { const other = store.data.users.find(user => user.id === conversation.participantIds.find(id => id !== userId)); return { ...conversation, otherUser: publicUser(other) }; }
app.get('/conversations', required, (req, res) => res.json(store.data.conversations.filter(conversation => conversation.participantIds.includes(req.user.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(conversation => conversationView(conversation, req.user.id))));
app.post('/conversations', required, (req, res) => { const recipientId = req.body.recipientId; if (!recipientId || recipientId === req.user.id || !store.data.users.some(user => user.id === recipientId)) return res.status(400).json({ error: 'Choose another collector to message.' }); let conversation = store.data.conversations.find(row => row.participantIds.includes(req.user.id) && row.participantIds.includes(recipientId) && row.participantIds.length === 2); if (!conversation) { conversation = { id: id(), participantIds: [req.user.id, recipientId], messages: [], createdAt: now(), updatedAt: now() }; store.data.conversations.unshift(conversation); store.save(); } res.status(201).json(conversationView(conversation, req.user.id)); });
app.get('/conversation/:id', required, (req, res) => { const conversation = store.data.conversations.find(row => row.id === req.params.id && row.participantIds.includes(req.user.id)); if (!conversation) return res.status(404).json({ error: 'Conversation not found' }); res.json(conversationView(conversation, req.user.id)); });
app.post('/conversation/:id/messages', required, (req, res) => { const conversation = store.data.conversations.find(row => row.id === req.params.id && row.participantIds.includes(req.user.id)); if (!conversation) return res.status(404).json({ error: 'Conversation not found' }); const body = req.body.body?.trim(); if (!body || body.length > 1000) return res.status(400).json({ error: 'Message must be between 1 and 1000 characters.' }); const message = { id: id(), senderId: req.user.id, body, createdAt: now() }; conversation.messages.push(message); conversation.updatedAt = now(); const recipientId = conversation.participantIds.find(userId => userId !== req.user.id); notify(recipientId, 'collector_message', `${req.user.username} sent you a message`, `/conversation/${conversation.id}`); store.save(); res.status(201).json(message); });

function voiceRoomAllowed(roomId, userId) {
  const [kind, targetId] = String(roomId || '').split(':');
  if (!targetId || !['conversation', 'trade', 'auction'].includes(kind)) return false;
  if (kind === 'conversation') return store.data.conversations.some(row => row.id === targetId && row.participantIds.includes(userId));
  if (kind === 'trade') return store.data.trades.some(row => row.id === targetId && (row.senderId === userId || row.receiverId === userId));
  if (kind === 'auction') {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'auctions.json'), 'utf8')).some(row => row.id === targetId); } catch { return false; }
  }
  return false;
}
function getVoiceRoom(roomId) {
  if (!voiceRooms.has(roomId)) voiceRooms.set(roomId, { peers: new Map(), events: [], nextEventId: 1 });
  return voiceRooms.get(roomId);
}
function cleanVoiceRooms() {
  const cutoff = Date.now() - 45000;
  for (const [roomId, room] of voiceRooms) {
    for (const [userId, peer] of room.peers) if (peer.seenAt < cutoff) { room.peers.delete(userId); room.events.push({ id: room.nextEventId++, type: 'leave', from: userId }); }
    if (!room.peers.size) voiceRooms.delete(roomId);
    else if (room.events.length > 300) room.events.splice(0, room.events.length - 300);
  }
}
setInterval(cleanVoiceRooms, 15000).unref();
app.post('/voice/:roomId/join', required, (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId);
  if (!voiceRoomAllowed(roomId, req.user.id)) return res.status(403).json({ error: 'You cannot join this voice room.' });
  cleanVoiceRooms(); const room = getVoiceRoom(roomId);
  const peers = [...room.peers.entries()].filter(([userId]) => userId !== req.user.id).map(([userId, peer]) => ({ userId, username: peer.username }));
  room.peers.set(req.user.id, { username: req.user.username, seenAt: Date.now() });
  room.events.push({ id: room.nextEventId++, type: 'join', from: req.user.id, username: req.user.username });
  res.json({ roomId, userId: req.user.id, peers, cursor: room.nextEventId - 1 });
});
app.get('/voice/:roomId/events', required, (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId);
  if (!voiceRoomAllowed(roomId, req.user.id)) return res.status(403).json({ error: 'You cannot access this voice room.' });
  const room = getVoiceRoom(roomId); const peer = room.peers.get(req.user.id);
  if (!peer) return res.status(409).json({ error: 'Join the voice room first.' });
  peer.seenAt = Date.now(); const cursor = Number(req.query.after) || 0;
  res.json({ events: room.events.filter(event => event.id > cursor && event.from !== req.user.id && (!event.to || event.to === req.user.id)), cursor: room.nextEventId - 1, participants: room.peers.size });
});
app.post('/voice/:roomId/signal', required, (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId); const room = voiceRooms.get(roomId);
  if (!room || !room.peers.has(req.user.id) || !room.peers.has(req.body.to)) return res.status(404).json({ error: 'Voice participant not found.' });
  if (!['offer', 'answer', 'candidate', 'media-state'].includes(req.body.type)) return res.status(400).json({ error: 'Invalid voice signal.' });
  room.peers.get(req.user.id).seenAt = Date.now(); room.events.push({ id: room.nextEventId++, type: req.body.type, from: req.user.id, to: req.body.to, data: req.body.data });
  res.status(202).json({ ok: true });
});
app.delete('/voice/:roomId', required, (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId); const room = voiceRooms.get(roomId);
  if (room?.peers.delete(req.user.id)) room.events.push({ id: room.nextEventId++, type: 'leave', from: req.user.id });
  if (room && !room.peers.size) voiceRooms.delete(roomId);
  res.status(204).end();
});

app.get('/listings', (req, res) => { const { category, q, status = 'active' } = req.query; let rows = store.data.listings.filter(l => !status || l.status === status); if (category) rows = rows.filter(l => l.category === category); if (q) { const s = q.toLowerCase(); rows = rows.filter(l => `${l.title} ${l.description}`.toLowerCase().includes(s)); } res.json(rows.map(l => ({ ...l, owner: publicUser(store.data.users.find(u => u.id === l.ownerId)), likeCount: l.likes.length, commentCount: store.data.comments.filter(comment => comment.listingId === l.id).length }))); });
app.get('/auctions', (req, res) => {
  const userLots = store.data.listings.filter(listing => listing.status === 'active' && ['auction_only', 'marketplace_auction'].includes(listing.listingMode)).map(listing => ({ id: listing.id, title: listing.title, category: listing.category, tags: listing.tags, currentBid: Number(listing.auctionStartPrice || listing.price || 0), bids: Number(listing.auctionBids || 0), endAt: listing.auctionEndAt, image: listing.images?.[0] || '', description: listing.description, ownerId: listing.ownerId }));
  res.json(userLots);
});
app.post('/listing', required, (req, res) => {
  const { title, description, category, tags = [], price, tradeOffer, images = [], videos = [], location, locationCoordinates, fulfillment, listingMode = 'marketplace', auctionStartPrice, auctionDurationHours } = req.body;
  const validImages = Array.isArray(images) && images.length > 0 && images.length <= 5 && images.every(image => typeof image === 'string' && image.length <= 2_000_000 && (/^https?:\/\//i.test(image) || /^data:image\/(jpeg|png|webp);base64,/i.test(image)));
  const validVideos = Array.isArray(videos) && videos.length <= 1 && videos.every(video => typeof video === 'string' && video.length <= 6_000_000 && /^data:video\/(mp4|webm|quicktime);base64,/i.test(video));
  if (!title?.trim() || !description?.trim() || !category?.trim()) return res.status(400).json({ error: 'title, description, and category are required' });
  const publicLocation = typeof location === 'string' ? location.trim() : '';
  if (publicLocation.length < 2 || publicLocation.length > 120) return res.status(400).json({ error: 'Add a public city/region location (2–120 characters).' });
  if (/^\d{1,6}\s+|\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|apartment|apt\.?|suite|unit|zip)\b/i.test(publicLocation)) return res.status(400).json({ error: 'Use a city, region, and country only—do not post a street address.' });
  if (!['pickup', 'pickup_delivery'].includes(fulfillment)) return res.status(400).json({ error: 'Choose pickup or pickup and delivery for fulfillment.' });
  if (!['marketplace', 'auction_only', 'marketplace_auction'].includes(listingMode)) return res.status(400).json({ error: 'Choose where this listing should appear.' });
  const auctionHours = Math.min(720, Math.max(1, Number(auctionDurationHours) || 72));
  const startingBid = Number(auctionStartPrice);
  if (listingMode !== 'marketplace' && (!Number.isFinite(startingBid) || startingBid < 0)) return res.status(400).json({ error: 'Add a valid auction starting bid.' });
  let coordinates = null;
  if (locationCoordinates !== null && locationCoordinates !== undefined) {
    const lat = Number(locationCoordinates.lat); const lng = Number(locationCoordinates.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ error: 'Use valid approximate location coordinates.' });
    coordinates = { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
  }
  const submittedTags = [...new Set([category.trim(), ...(Array.isArray(tags) ? tags : []).map(tag => typeof tag === 'string' ? tag.trim().replace(/^#/, '') : '').filter(Boolean)])];
  const validTags = submittedTags.length <= 8 && submittedTags.every(tag => tag.length <= 60);
  if (!validTags) return res.status(400).json({ error: 'Use up to 8 tags, each 60 characters or less.' });
  if (!validImages) return res.status(400).json({ error: 'Add 1–5 valid image links or uploads.' });
  if (!validVideos) return res.status(400).json({ error: 'Add at most one valid uploaded video.' });
  const locationTag = usCityTownTag(publicLocation);
  const listing = { id: id(), ownerId: req.user.id, title: title.trim(), description: description.trim(), category: category.trim(), tags: [...submittedTags, ...(locationTag ? [locationTag] : [])], location: publicLocation, locationCoordinates: coordinates, fulfillment, listingMode, auctionStartPrice: listingMode === 'marketplace' ? null : startingBid, auctionEndAt: listingMode === 'marketplace' ? null : new Date(Date.now() + auctionHours * 3600000).toISOString(), auctionBids: 0, price: Number(price) || 0, tradeOffer: Boolean(tradeOffer), images, videos, status: 'active', likes: [], createdAt: now() };
  store.data.listings.unshift(listing); activity('listing', req.user.id, { listingId: listing.id }); store.save(); res.status(201).json(listing);
});
app.get('/listing/:id', (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); res.json({ ...listing, owner: publicUser(store.data.users.find(u => u.id === listing.ownerId)), likeCount: listing.likes.length }); });
app.put('/listing/:id', required, (req, res) => {
  const listing = store.data.listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  if (req.body.location !== undefined) {
    const publicLocation = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    if (publicLocation.length < 2 || publicLocation.length > 120 || /^\d{1,6}\s+|\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|apartment|apt\.?|suite|unit|zip)\b/i.test(publicLocation)) return res.status(400).json({ error: 'Use a city, region, and country only—do not post a street address.' });
    listing.location = publicLocation;
  }
  if (req.body.fulfillment !== undefined) {
    if (!['pickup', 'pickup_delivery'].includes(req.body.fulfillment)) return res.status(400).json({ error: 'Choose pickup or pickup and delivery for fulfillment.' });
    listing.fulfillment = req.body.fulfillment;
  }
  ['title', 'description', 'category', 'tags', 'price', 'tradeOffer', 'images', 'status'].forEach(key => {
    if (req.body[key] !== undefined) listing[key] = req.body[key];
  });
  const manualTags = [...new Set([listing.category, ...(Array.isArray(listing.tags) ? listing.tags : [])].map(tag => typeof tag === 'string' ? tag.trim().replace(/^#/, '') : '').filter(tag => tag && !tag.startsWith('US City/Town: ')))];
  const locationTag = usCityTownTag(listing.location);
  listing.tags = [...manualTags, ...(locationTag ? [locationTag] : [])];
  store.save(); res.json(listing);
});
app.delete('/listing/:id', required, (req, res) => { const i = store.data.listings.findIndex(l => l.id === req.params.id && l.ownerId === req.user.id); if (i < 0) return res.status(404).json({ error: 'Listing not found' }); store.data.listings.splice(i, 1); store.save(); res.status(204).end(); });
app.post('/listing/:id/like', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); const i = listing.likes.indexOf(req.user.id); if (i < 0) { listing.likes.push(req.user.id); if (listing.ownerId !== req.user.id) notify(listing.ownerId, 'like', `${req.user.username} liked “${listing.title}”`, `/listing/${listing.id}`); activity('like', req.user.id, { listingId: listing.id }); } else listing.likes.splice(i, 1); store.save(); res.json({ liked: i < 0, likeCount: listing.likes.length }); });
app.post('/listing/:id/favorite', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); if (!Array.isArray(listing.favorites)) listing.favorites = []; const i = listing.favorites.indexOf(req.user.id); if (i < 0) listing.favorites.push(req.user.id); else listing.favorites.splice(i, 1); store.save(); res.json({ favorited: i < 0, favoriteCount: listing.favorites.length }); });

app.post('/comment', required, (req, res) => { const { listingId, body, parentId } = req.body; const listing = store.data.listings.find(l => l.id === listingId); const parent = parentId ? store.data.comments.find(c => c.id === parentId) : null; if (!listing || !body?.trim()) return res.status(400).json({ error: 'Valid listingId and body required' }); if (parentId && (!parent || parent.listingId !== listingId)) return res.status(400).json({ error: 'Reply must belong to the same listing' }); const comment = { id: id(), listingId, userId: req.user.id, body: body.trim(), parentId: parentId || null, votes: {}, createdAt: now() }; store.data.comments.push(comment); const owner = parent ? parent.userId : listing.ownerId; if (owner && owner !== req.user.id) notify(owner, 'comment', `${req.user.username} commented on “${listing.title}”`, `/listing/${listing.id}`); activity('comment', req.user.id, { listingId, commentId: comment.id }); store.save(); res.status(201).json({ ...comment, score: 0, myVote: 0, user: publicUser(req.user) }); });
function commentView(comment, userId) { const votes = comment.votes && typeof comment.votes === 'object' ? comment.votes : {}; return { ...comment, votes: undefined, score: Object.values(votes).reduce((total, vote) => total + Number(vote || 0), 0), myVote: Number(votes[userId] || 0), user: publicUser(store.data.users.find(user => user.id === comment.userId)) }; }
app.get('/comments/:listingId', (req, res) => { const user = currentUser(req); res.json(store.data.comments.filter(c => c.listingId === req.params.listingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(comment => commentView(comment, user?.id))); });
app.post('/comment/:id/vote', required, (req, res) => { const comment = store.data.comments.find(row => row.id === req.params.id); if (!comment) return res.status(404).json({ error: 'Comment not found' }); const direction = Number(req.body.direction); if (![1, -1].includes(direction)) return res.status(400).json({ error: 'Vote must be an upvote or downvote.' }); if (!comment.votes || typeof comment.votes !== 'object') comment.votes = {}; comment.votes[req.user.id] === direction ? delete comment.votes[req.user.id] : comment.votes[req.user.id] = direction; store.save(); const view = commentView(comment, req.user.id); res.json({ score: view.score, myVote: view.myVote }); });

const activeTradeListings = (ids, ownerId) => [...new Set(Array.isArray(ids) ? ids.filter(value => typeof value === 'string') : [])].map(listingId => store.data.listings.find(listing => listing.id === listingId && listing.ownerId === ownerId && listing.status === 'active')).filter(Boolean);
const tradeSenderIds = trade => Array.isArray(trade.senderListingIds) ? trade.senderListingIds : [];
const tradeReceiverIds = trade => Array.isArray(trade.receiverListingIds) ? trade.receiverListingIds : [trade.listingId].filter(Boolean);
app.post('/trade', required, (req, res) => {
  const { receiverId, listingId, senderListingIds, receiverListingIds, offerDetails, senderCashAmount, receiverCashAmount, cashAmount = 0, cashFrom = '' } = req.body;
  const requestedIds = [...new Set([...(Array.isArray(receiverListingIds) ? receiverListingIds : []), listingId].filter(value => typeof value === 'string'))];
  const offeredIds = [...new Set(Array.isArray(senderListingIds) ? senderListingIds.filter(value => typeof value === 'string') : [])];
  if (!receiverId || receiverId === req.user.id || !requestedIds.length || !offeredIds.length) return res.status(400).json({ error: 'Choose at least one item from each collector.' });
  const requestedListings = activeTradeListings(requestedIds, receiverId);
  const offeredListings = activeTradeListings(offeredIds, req.user.id);
  if (requestedListings.length !== requestedIds.length || offeredListings.length !== offeredIds.length) return res.status(400).json({ error: 'Every trade item must be an active listing owned by the correct collector.' });
  const legacyAmount = Number(cashAmount);
  const senderCash = Number(senderCashAmount ?? (cashFrom === 'sender' ? legacyAmount : 0));
  const receiverCash = Number(receiverCashAmount ?? (cashFrom === 'receiver' ? legacyAmount : 0));
  if (![senderCash, receiverCash].every(amount => Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000)) return res.status(400).json({ error: 'Use valid cash amounts for both sides.' });
  const note = typeof offerDetails === 'string' ? offerDetails.trim() : '';
  const trade = { id: id(), senderId: req.user.id, receiverId, listingId: requestedIds[0], senderListingIds: offeredIds, receiverListingIds: requestedIds, senderCashAmount: senderCash, receiverCashAmount: receiverCash, offerDetails: note.slice(0, 1000), acceptances: { sender: false, receiver: false }, status: 'pending', messages: [], createdAt: now() };
  store.data.trades.unshift(trade); notify(receiverId, 'trade', `${req.user.username} proposed a ${offeredIds.length}-for-${requestedIds.length} trade`, `/trade/${trade.id}`); activity('trade', req.user.id, { listingId: requestedIds[0], tradeId: trade.id }); store.save(); res.status(201).json(trade);
});
function tradeView(trade, userId) {
  const listing = store.data.listings.find(row => row.id === trade.listingId);
  const senderListings = tradeSenderIds(trade).map(listingId => store.data.listings.find(row => row.id === listingId)).filter(Boolean);
  const receiverListings = tradeReceiverIds(trade).map(listingId => store.data.listings.find(row => row.id === listingId)).filter(Boolean);
  const otherUser = store.data.users.find(row => row.id === (trade.senderId === userId ? trade.receiverId : trade.senderId));
  return { ...trade, listing, senderListings, receiverListings, otherUser: publicUser(otherUser) };
}
app.get('/trades', required, (req, res) => res.json(store.data.trades.filter(t => t.senderId === req.user.id || t.receiverId === req.user.id).map(t => tradeView(t, req.user.id))));
app.get('/trade/:id', required, (req, res) => { const trade = store.data.trades.find(t => t.id === req.params.id); if (!trade || (trade.senderId !== req.user.id && trade.receiverId !== req.user.id)) return res.status(404).json({ error: 'Trade not found' }); res.json(tradeView(trade, req.user.id)); });
app.put('/trade/:id', required, (req, res) => {
  const trade = store.data.trades.find(t => t.id === req.params.id);
  if (!trade || (trade.senderId !== req.user.id && trade.receiverId !== req.user.id)) return res.status(404).json({ error: 'Trade not found' });
  const { status, message } = req.body;
  if (status && !['accepted', 'declined', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status === 'declined') {
    if (['accepted', 'completed', 'declined'].includes(trade.status)) return res.status(400).json({ error: 'This trade can no longer be declined.' });
    trade.status = 'declined';
    notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', `${req.user.username} declined this trade`, `/trade/${trade.id}`);
  }
  if (status === 'accepted') {
    if (['accepted', 'completed', 'declined'].includes(trade.status)) return res.status(400).json({ error: 'This trade is no longer awaiting acceptance.' });
    const rows = [...tradeSenderIds(trade), ...tradeReceiverIds(trade)].map(listingId => store.data.listings.find(row => row.id === listingId));
    if (!rows.length || rows.some(listing => !listing || listing.status !== 'active')) return res.status(400).json({ error: 'Every item must still be active before this trade can be accepted.' });
    if (!trade.acceptances || typeof trade.acceptances !== 'object') trade.acceptances = { sender: false, receiver: false };
    const role = trade.senderId === req.user.id ? 'sender' : 'receiver';
    trade.acceptances[role] = true;
    const otherRole = role === 'sender' ? 'receiver' : 'sender';
    if (trade.acceptances.sender && trade.acceptances.receiver) {
      trade.status = 'completed';
      [...tradeSenderIds(trade), ...tradeReceiverIds(trade)].forEach(listingId => { const listing = store.data.listings.find(row => row.id === listingId); if (listing) listing.status = 'traded'; });
      notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', `${req.user.username} locked in the trade — both collectors accepted and the trade is complete`, `/trade/${trade.id}`);
    } else {
      trade.status = `awaiting_${otherRole}`;
      notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', `${req.user.username} locked in the trade — your acceptance is needed`, `/trade/${trade.id}`);
    }
  }
  if (status === 'completed') {
    if (trade.status !== 'accepted') return res.status(400).json({ error: 'Both collectors must accept before the trade can be completed.' });
    trade.status = 'completed';
    [...tradeSenderIds(trade), ...tradeReceiverIds(trade)].forEach(listingId => { const listing = store.data.listings.find(row => row.id === listingId); if (listing) listing.status = 'traded'; });
    notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', `${req.user.username} marked the trade completed`, `/trade/${trade.id}`);
  }
  if (message?.trim()) trade.messages.push({ id: id(), senderId: req.user.id, body: message.trim(), createdAt: now() });
  store.save(); res.json(tradeView(trade, req.user.id));
});

function deliveryView(delivery, userId) { const listing = store.data.listings.find(row => row.id === delivery.listingId); const buyer = store.data.users.find(row => row.id === delivery.buyerId); const seller = store.data.users.find(row => row.id === delivery.sellerId); return { ...delivery, listing, buyer: publicUser(buyer), seller: publicUser(seller), shippingAddress: delivery.buyerId === userId || delivery.sellerId === userId ? delivery.shippingAddress : undefined }; }
function recordDeliveryUpdate(delivery, userId, status, note = '') { if (!Array.isArray(delivery.history)) delivery.history = []; delivery.history.push({ id: id(), userId, status, note, createdAt: now() }); delivery.updatedAt = now(); }
app.post('/purchase', required, (req, res) => {
  const { listingId, shippingAddress, deliveryProvider, deliveryMiles, packagingCost, paymentMethod } = req.body;
  const listing = store.data.listings.find(row => row.id === listingId && row.status === 'active');
  if (!listing) return res.status(404).json({ error: 'Active listing not found' });
  if (listing.ownerId === req.user.id) return res.status(400).json({ error: 'You cannot purchase your own listing' });
  const address = typeof shippingAddress === 'string' ? shippingAddress.trim() : '';
  if (!address) return res.status(400).json({ error: 'A delivery address is required' });
  if (address.length > 500) return res.status(400).json({ error: 'Keep the delivery address under 500 characters.' });
  const provider = typeof deliveryProvider === 'string' ? deliveryProvider.trim() : '';
  if (!provider) return res.status(400).json({ error: 'Choose a delivery provider or courier option.' });
  if (provider.length > 120) return res.status(400).json({ error: 'Keep the delivery provider under 120 characters.' });
  if (!deliveryProviders[provider]) return res.status(400).json({ error: 'Choose one of the supported delivery options.' });
  if (listing.fulfillment === 'pickup' && provider !== 'Local pickup') return res.status(400).json({ error: 'This listing is available for local pickup only.' });
  const method = typeof paymentMethod === 'string' ? paymentMethod.trim() : '';
  if (!paymentMethods.has(method)) return res.status(400).json({ error: 'Choose one of the supported payment methods.' });
  const miles = Math.min(20000, Math.max(0, Number(deliveryMiles) || 0));
  const packing = Math.min(10000, Math.max(0, Number(packagingCost) || 0));
  const courierPay = Math.max(8, miles * 0.20) + packing;
  const delivery = { id: id(), listingId: listing.id, buyerId: req.user.id, sellerId: listing.ownerId, shippingAddress: address, itemPrice: Number(listing.price) || 0, deliveryProvider: provider, deliveryMiles: miles, packagingCost: packing, courierPay, paymentMethod: method, status: 'awaiting_seller_dispatch', courier: '', trackingNumber: '', messages: [], history: [], createdAt: now(), updatedAt: now() }; recordDeliveryUpdate(delivery, req.user.id, delivery.status, `Order placed with ${provider} · ${method}; delivery estimate $${courierPay.toFixed(2)}.`);
  listing.status = 'pending_delivery'; store.data.deliveries.unshift(delivery); notify(listing.ownerId, 'delivery', `${req.user.username} started a purchase delivery for “${listing.title}”`, `/delivery/${delivery.id}`); activity('purchase', req.user.id, { listingId: listing.id, deliveryId: delivery.id }); store.save(); res.status(201).json(deliveryView(delivery, req.user.id));
});
app.get('/deliveries', required, (req, res) => res.json(store.data.deliveries.filter(row => row.buyerId === req.user.id || row.sellerId === req.user.id).map(row => deliveryView(row, req.user.id))));
app.get('/delivery/providers', (req, res) => res.json(Object.entries(deliveryProviders).map(([name, details]) => ({ name, ...details }))));
app.get('/delivery/:id', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' }); res.json(deliveryView(delivery, req.user.id)); });
app.put('/delivery/:id', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' });
  const sellerStatuses = ['packed', 'picked_up', 'in_transit']; const { status, courier, trackingNumber, note = '' } = req.body;
  if (delivery.status === 'completed') return res.status(400).json({ error: 'This delivery is already completed.' });
  if (delivery.buyerId === req.user.id && status === 'issue_reported') { delivery.status = status; recordDeliveryUpdate(delivery, req.user.id, status, String(note).trim() || 'Buyer reported an issue'); }
  else if (delivery.sellerId === req.user.id && sellerStatuses.includes(status)) { const order = ['awaiting_seller_dispatch', 'packed', 'picked_up', 'in_transit']; const current = order.indexOf(delivery.status); const next = order.indexOf(status); if (next !== current + 1) return res.status(400).json({ error: 'Update the delivery one step at a time.' }); const provider = delivery.deliveryProvider || String(courier || delivery.courier || '').trim(); const providerDetails = deliveryProviders[provider] || deliveryProviders['Other courier']; const chosenCourier = String(courier ?? delivery.courier ?? provider).trim() || provider; if (delivery.deliveryProvider && chosenCourier !== delivery.deliveryProvider) return res.status(400).json({ error: `Use the buyer-selected delivery option: ${delivery.deliveryProvider}.` }); if (['picked_up', 'in_transit'].includes(status) && providerDetails.trackingRequired && !String(trackingNumber || delivery.trackingNumber).trim()) return res.status(400).json({ error: 'A tracking number is required for this delivery option once it is picked up.' }); delivery.courier = chosenCourier; if (trackingNumber !== undefined) delivery.trackingNumber = String(trackingNumber).trim(); delivery.status = status; recordDeliveryUpdate(delivery, req.user.id, status, String(note).trim()); }
  else return res.status(403).json({ error: 'This delivery update is not allowed.' });
  const otherUser = delivery.buyerId === req.user.id ? delivery.sellerId : delivery.buyerId; notify(otherUser, 'delivery', `${req.user.username} updated delivery status to ${delivery.status.replaceAll('_', ' ')}`, `/delivery/${delivery.id}`); store.save(); res.json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/confirm', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || delivery.buyerId !== req.user.id) return res.status(404).json({ error: 'Delivery not found' }); if (delivery.status !== 'in_transit') return res.status(400).json({ error: 'A package can be confirmed after it is marked in transit.' }); delivery.status = 'completed'; recordDeliveryUpdate(delivery, req.user.id, 'completed', 'Buyer confirmed delivery received'); const listing = store.data.listings.find(row => row.id === delivery.listingId); if (listing) listing.status = 'sold'; notify(delivery.sellerId, 'delivery', `${req.user.username} confirmed delivery for “${listing?.title || 'your listing'}”`, `/delivery/${delivery.id}`); store.save(); res.json(deliveryView(delivery, req.user.id)); });
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
  'listing-images.css', 'listing-upload.css', 'listing-video.css', 'password-toggle.css',
  'listing-creation.css', 'listing-detail.css', 'listing-actions.css', 'listing-category.css',
  'listing-sort.css', 'delivery-workspace.css', 'app-performance.css', 'account-connections.css', 'social-chat.css', 'voice-chat.css', 'account-workspace.css', 'tags-expanded.css', 'favicon.png', 'sitemap.xml', 'robots.txt'
]);
app.use('/public', express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/data/listings.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'listings.json')));
app.get('/data/auctions.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'auctions.json')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:asset', (req, res, next) => {
  if (!rootSiteAssets.has(req.params.asset)) return next();
  return res.sendFile(path.join(__dirname, req.params.asset));
});
// Tag links are shareable routes (for example /art/). The client reads the
// path and applies the matching filter after the marketplace data loads.
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return next();
  return res.sendFile(path.join(__dirname, 'index.html'));
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
