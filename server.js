const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'store.json');
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

class Store {
  constructor() { fs.mkdirSync(dataDir, { recursive: true }); this.data = this.load(); this.seedBrowseFeed(); this.save(); }
  load() {
    if (fs.existsSync(dataFile)) return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const demo = { id: id(), username: 'alexcollects', email: 'alex@collector.local', password: 'password123', avatar: 'AC', bio: 'Vintage paper, space-age objects, and things with a story.', reputation: 98, following: [], createdAt: now() };
    const listings = [
      { id: id(), ownerId: demo.id, title: '1976 NASA Viking Mission Patch', description: 'Original woven patch, excellent condition. A beautiful piece of space history.', category: 'Memorabilia', price: 85, tradeOffer: true, images: ['https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1000&q=80'], status: 'active', likes: [], createdAt: now() },
      { id: id(), ownerId: demo.id, title: 'First Edition Design Annual', description: 'A sharp, colorful book from a beloved era of graphic design.', category: 'Books', price: 45, tradeOffer: false, images: ['https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=1000&q=80'], status: 'active', likes: [], createdAt: now() }
    ];
    return { users: [demo], listings, comments: [], trades: [], notifications: [], activities: listings.map(l => ({ id: id(), type: 'listing', userId: demo.id, listingId: l.id, createdAt: l.createdAt })) };
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
  save() { fs.writeFileSync(dataFile, JSON.stringify(this.data, null, 2)); }
}
const store = new Store();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
app.post('/listing', required, (req, res) => { const { title, description, category, price, tradeOffer, images = [] } = req.body; if (!title || !description || !category) return res.status(400).json({ error: 'title, description, and category are required' }); const listing = { id: id(), ownerId: req.user.id, title, description, category, price: Number(price) || 0, tradeOffer: Boolean(tradeOffer), images, status: 'active', likes: [], createdAt: now() }; store.data.listings.unshift(listing); activity('listing', req.user.id, { listingId: listing.id }); store.save(); res.status(201).json(listing); });
app.get('/listing/:id', (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); res.json({ ...listing, owner: publicUser(store.data.users.find(u => u.id === listing.ownerId)), likeCount: listing.likes.length }); });
app.put('/listing/:id', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Not allowed' }); ['title','description','category','price','tradeOffer','images','status'].forEach(k => { if (req.body[k] !== undefined) listing[k] = req.body[k]; }); store.save(); res.json(listing); });
app.delete('/listing/:id', required, (req, res) => { const i = store.data.listings.findIndex(l => l.id === req.params.id && l.ownerId === req.user.id); if (i < 0) return res.status(404).json({ error: 'Listing not found' }); store.data.listings.splice(i, 1); store.save(); res.status(204).end(); });
app.post('/listing/:id/like', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); const i = listing.likes.indexOf(req.user.id); if (i < 0) { listing.likes.push(req.user.id); if (listing.ownerId !== req.user.id) notify(listing.ownerId, 'like', `${req.user.username} liked “${listing.title}”`, `/listing/${listing.id}`); activity('like', req.user.id, { listingId: listing.id }); } else listing.likes.splice(i, 1); store.save(); res.json({ liked: i < 0, likeCount: listing.likes.length }); });

app.post('/comment', required, (req, res) => { const { listingId, body, parentId } = req.body; const listing = store.data.listings.find(l => l.id === listingId); if (!listing || !body?.trim()) return res.status(400).json({ error: 'Valid listingId and body required' }); const comment = { id: id(), listingId, userId: req.user.id, body: body.trim(), parentId: parentId || null, createdAt: now() }; store.data.comments.push(comment); const owner = parentId ? store.data.comments.find(c => c.id === parentId)?.userId : listing.ownerId; if (owner && owner !== req.user.id) notify(owner, 'comment', `${req.user.username} commented on “${listing.title}”`, `/listing/${listing.id}`); activity('comment', req.user.id, { listingId, commentId: comment.id }); store.save(); res.status(201).json({ ...comment, user: publicUser(req.user) }); });
app.get('/comments/:listingId', (req, res) => res.json(store.data.comments.filter(c => c.listingId === req.params.listingId).map(c => ({ ...c, user: publicUser(store.data.users.find(u => u.id === c.userId)) }))));

app.post('/trade', required, (req, res) => { const { receiverId, listingId, offerDetails } = req.body; const listing = store.data.listings.find(l => l.id === listingId); if (!listing || !offerDetails?.trim()) return res.status(400).json({ error: 'Valid listing and offer details required' }); if (listing.ownerId !== receiverId || receiverId === req.user.id) return res.status(400).json({ error: 'Invalid trade recipient' }); const trade = { id: id(), senderId: req.user.id, receiverId, listingId, offerDetails: offerDetails.trim(), status: 'pending', messages: [], createdAt: now() }; store.data.trades.unshift(trade); notify(receiverId, 'trade', `${req.user.username} sent a trade offer for “${listing.title}”`, `/trade/${trade.id}`); activity('trade', req.user.id, { listingId, tradeId: trade.id }); store.save(); res.status(201).json(trade); });
app.get('/trade/:id', required, (req, res) => { const trade = store.data.trades.find(t => t.id === req.params.id); if (!trade || (trade.senderId !== req.user.id && trade.receiverId !== req.user.id)) return res.status(404).json({ error: 'Trade not found' }); res.json(trade); });
app.put('/trade/:id', required, (req, res) => { const trade = store.data.trades.find(t => t.id === req.params.id); if (!trade || (trade.senderId !== req.user.id && trade.receiverId !== req.user.id)) return res.status(404).json({ error: 'Trade not found' }); const { status, message } = req.body; if (status && !['pending','accepted','declined','completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' }); if (status) { trade.status = status; if (status === 'completed') { const l = store.data.listings.find(l => l.id === trade.listingId); if (l) l.status = 'traded'; } notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', `${req.user.username} marked the trade ${status}`, `/trade/${trade.id}`); } if (message?.trim()) trade.messages.push({ id: id(), senderId: req.user.id, body: message.trim(), createdAt: now() }); store.save(); res.json(trade); });
app.get('/feed/global', (req, res) => res.json(store.data.activities.slice(0, 50).map(a => ({ ...a, user: publicUser(store.data.users.find(u => u.id === a.userId)), listing: a.listingId ? store.data.listings.find(l => l.id === a.listingId) : null }))));
app.get('/feed/user/:id', (req, res) => { const user = store.data.users.find(u => u.id === req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); const people = new Set([user.id, ...user.following]); res.json(store.data.activities.filter(a => people.has(a.userId)).slice(0, 50).map(a => ({ ...a, user: publicUser(store.data.users.find(u => u.id === a.userId)), listing: a.listingId ? store.data.listings.find(l => l.id === a.listingId) : null }))); });
app.get('/notifications', required, (req, res) => res.json(store.data.notifications.filter(n => n.userId === req.user.id)));
app.listen(PORT, () => console.log(`Collector Marketplace running at http://localhost:${PORT}`));
