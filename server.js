const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.disable('x-powered-by');
// Render terminates TLS before requests reach this server. Trust that proxy so
// PayPal return URLs keep the public HTTPS scheme.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const publicSiteUrl = String(process.env.PUBLIC_SITE_URL || 'https://collectormarketplace.net').replace(/\/$/, '');
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'store.json');
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const loginAttempts = new Map();
const twoFactorChallenges = new Map();
const twoFactorEnrollments = new Map();
const securityEvents = [];
const blockedIpHashes = new Set(String(process.env.BLOCKED_IP_HASHES || '').split(',').map(value => value.trim()).filter(Boolean));
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;
const encryptionKey = process.env.DATA_ENCRYPTION_KEY ? crypto.createHash('sha256').update(process.env.DATA_ENCRYPTION_KEY).digest() : null;
const securityLog = (type, req, details = {}) => {
  const event = { id: id(), type, at: now(), userId: details.userId || null, ipHash: crypto.createHash('sha256').update(String(req?.ip || '')).digest('hex').slice(0, 16), details: { ...details, userId: undefined } };
  securityEvents.unshift(event); if (securityEvents.length > 5000) securityEvents.length = 5000;
  if (typeof store !== 'undefined' && Array.isArray(store.data?.securityEvents)) { store.data.securityEvents.unshift(event); if (store.data.securityEvents.length > 5000) store.data.securityEvents.length = 5000; }
};
const encryptPrivate = value => { if (value === undefined || value === null || value === '') return value; if (!encryptionKey) throw new Error('Private-data encryption is not configured. Set DATA_ENCRYPTION_KEY in the deployment environment.'); const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]); return { encrypted: true, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') }; };
const decryptPrivate = value => { if (!value?.encrypted) return value; if (!encryptionKey) throw new Error('Private-data encryption is not configured.'); const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(value.iv, 'base64')); decipher.setAuthTag(Buffer.from(value.tag, 'base64')); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8')); };
const sessionTokenHash = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const createSession = userId => { const token = crypto.randomBytes(32).toString('base64url'); store.data.sessions = (store.data.sessions || []).filter(session => session.expiresAt > Date.now() && session.userId !== userId); store.data.sessions.push({ tokenHash: sessionTokenHash(token), userId, expiresAt: Date.now() + sessionLifetimeMs }); store.save(); return token; };
const revokeUserSessions = userId => { store.data.sessions = (store.data.sessions || []).filter(session => session.userId !== userId); store.save(); };
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32Secret = () => Array.from(crypto.randomBytes(20)).map(byte => base32Alphabet[byte % base32Alphabet.length]).join('');
const decodeBase32 = secret => { let bits = ''; for (const char of String(secret).toUpperCase().replace(/=+$/g, '')) { const index = base32Alphabet.indexOf(char); if (index >= 0) bits += index.toString(2).padStart(5, '0'); } return Buffer.from((bits.match(/.{1,8}/g) || []).filter(byte => byte.length === 8).map(byte => parseInt(byte, 2))); };
const totpCode = (secret, at = Date.now()) => { const step = Math.floor(at / 30000); const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step)); const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest(); const offset = digest[digest.length - 1] & 15; return String(((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)).padStart(6, '0'); };
const verifyTotp = (secret, code) => { const normalized = String(code || '').replace(/\D/g, '').slice(0, 6).padStart(6, '0'); return [-1, 0, 1].some(offset => crypto.timingSafeEqual(Buffer.from(totpCode(secret, Date.now() + offset * 30000)), Buffer.from(normalized))); };
const deliveryProviders = { 'UPS Priority': { type: 'carrier', trackingRequired: true } };
const paymentMethods = new Set(['PayPal']);
const paypalProcessingRate = 0.0349;
const paypalProcessingFixed = 0.49;
const paypalProcessingFee = amount => Math.round((Math.max(0, Number(amount) || 0) * paypalProcessingRate + paypalProcessingFixed) * 100) / 100;
const calculatedDeliveryFee = (miles, packaging) => Math.round((Math.max(8, Math.max(0, Number(miles) || 0) * 0.10) + Math.max(0, Number(packaging) || 0)) * 100) / 100;
const developerPassUsername = 'collectormarketplace';
const hasDeveloperPass = user => user?.developerPass === true;
const vipCuratorPrice = 150;
const vipCuratorDays = 30;
const hasActiveCuratorMembership = user => {
  if (user?.grandCurator === true) return true;
  if (!(user?.curator === true || user?.membership === 'curator')) return false;
  const expiresAt = user?.curatorMembershipExpiresAt;
  return !expiresAt || new Date(expiresAt).valueOf() > Date.now();
};
const collectiveCatalog = [
  { id: 'card-vault', name: 'Card Vault', description: 'Sports cards, TCG, and grading talk for serious collectors.', tags: ['Sports Cards', 'Cards', 'Autographs'], members: 1284 },
  { id: 'modern-relics', name: 'Modern Relics', description: 'Design, art, books, and objects with a lasting story.', tags: ['Art', 'Books', 'Vintage'], members: 846 },
  { id: 'timekeepers', name: 'Timekeepers', description: 'Watches, jewelry, and collectible craftsmanship.', tags: ['Watches', 'Fine Jewelry', 'Luxury'], members: 619 },
  { id: 'pixel-arcade', name: 'Pixel Arcade', description: 'Gaming hardware, retro games, and console collectors.', tags: ['Gaming', 'Consoles', 'Arcade Machines'], members: 932 }
];
const brandCatalog = [];
const chatRoomCatalog = [
  { id: 'collector-lounge', name: 'Collector Lounge', description: 'A relaxed place to meet collectors and talk through today’s finds.', tags: ['Collectors', 'General', 'Community'], members: 84 },
  { id: 'card-table', name: 'Card Table', description: 'Live conversation for sports cards, TCG, grading, and swaps.', tags: ['Sports Cards', 'Cards', 'Trading'], members: 46 },
  { id: 'art-salon', name: 'Art Salon', description: 'Discuss art, design, antiques, and museum-worthy objects.', tags: ['Art', 'Fine Art', 'Vintage'], members: 31 },
  { id: 'watch-club', name: 'Watch Club', description: 'A room for timepieces, jewelry, luxury, and craftsmanship.', tags: ['Watches', 'Fine Jewelry', 'Luxury'], members: 29 }
];
const artifactLoreCache = new Map();
const fandomWikis = [
  { terms: ['skylanders'], wiki: 'skylanders' }, { terms: ['diablo', 'blizzard'], wiki: 'diablo' },
  { terms: ['pokemon', 'pokémon'], wiki: 'pokemon' }, { terms: ['minecraft'], wiki: 'minecraft' },
  { terms: ['star wars'], wiki: 'starwars' }, { terms: ['marvel'], wiki: 'marvel' },
  { terms: ['dc comics', 'batman', 'superman'], wiki: 'dc' }, { terms: ['lego'], wiki: 'lego' },
  { terms: ['sonic'], wiki: 'sonic' }, { terms: ['transformers'], wiki: 'transformers' }
];
const getFandomArtifactLore = async (query, headers) => {
  const normalized = String(query || '').toLowerCase();
  const match = fandomWikis.find(candidate => candidate.terms.some(term => normalized.includes(term)));
  if (!match) return null;
  try {
    const search = await fetch(`https://${match.wiki}.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`, { headers });
    const data = search.ok ? await search.json() : {};
    const result = data.query?.search?.[0];
    if (!result?.title) return null;
    const page = await fetch(`https://${match.wiki}.fandom.com/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(result.title)}&format=json&origin=*`, { headers });
    const pageData = page.ok ? await page.json() : {};
    const article = Object.values(pageData.query?.pages || {})[0] || {};
    const extract = String(article.extract || result.snippet || '').replace(/<[^>]+>/g, '').trim();
    if (!extract) return null;
    return { title: article.title || result.title, description: `${match.wiki}.fandom.com community reference`, extract, url: `https://${match.wiki}.fandom.com/wiki/${encodeURIComponent(String(article.title || result.title).replace(/ /g, '_'))}`, provider: 'Fandom' };
  } catch { return null; }
};
const getArtifactLore = async (title, { strict = false } = {}) => {
  const query = String(title || '').replace(/[^\w\s&'’-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!query) return null;
  const cacheKey = `${strict ? 'strict:' : ''}${query.toLowerCase()}`;
  const cached = artifactLoreCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < 86400000) return cached.value;
  const headers = { 'User-Agent': 'CollectorMarketplace ArtifactLore/1.0' };
  const ignoredResearchWords = new Set(['about', 'appraise', 'check', 'condition', 'could', 'find', 'from', 'good', 'have', 'help', 'item', 'items', 'know', 'like', 'more', 'need', 'price', 'quality', 'really', 'search', 'should', 'that', 'this', 'value', 'want', 'what', 'when', 'with', 'worth', 'would']);
  const researchTerms = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(word => !ignoredResearchWords.has(word)) || [])];
  const scoreResult = result => {
    const resultTitle = String(result.title || '').toLowerCase();
    const detail = `${result.description || ''} ${result.snippet || ''}`.toLowerCase();
    const titleMatches = researchTerms.filter(term => resultTitle.includes(term));
    const detailMatches = researchTerms.filter(term => detail.includes(term));
    return { result, titleMatches, score: titleMatches.length * 4 + detailMatches.filter(term => !titleMatches.includes(term)).length };
  };
  try {
    const search = await fetch(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=10`, { headers });
    const searchData = search.ok ? await search.json() : {};
    let candidates = Array.isArray(searchData.pages) ? searchData.pages : [];
    if (!candidates.length) {
      const fallback = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=10&format=json`, { headers });
      const fallbackData = fallback.ok ? await fallback.json() : {};
      candidates = (fallbackData.query?.search || []).map(row => ({ key: row.title.replace(/ /g, '_'), title: row.title, description: '', snippet: String(row.snippet || '').replace(/<[^>]+>/g, '') }));
    }
    const rankedCandidates = candidates.filter(result => result?.key).map(scoreResult).sort((left, right) => right.score - left.score);
    let result = rankedCandidates[0]?.result;
    if (strict && (!rankedCandidates[0] || rankedCandidates[0].titleMatches.length < Math.min(2, researchTerms.length))) result = null;
    if (!result?.key) return getFandomArtifactLore(query, headers);
    const summaryResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.key)}`, { headers });
    const summary = summaryResponse.ok ? await summaryResponse.json() : {};
    const value = { title: summary.title || result.title, description: summary.description || result.description || '', extract: summary.extract || result.snippet || '', url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(result.key)}`, provider: 'Wikipedia' };
    artifactLoreCache.set(cacheKey, { savedAt: Date.now(), value });
    return value;
  } catch {
    return getFandomArtifactLore(query, headers);
  }
};

class Store {
  constructor() { fs.mkdirSync(dataDir, { recursive: true }); this.data = this.load(); this.ensureData(); this.removeDemoContent(); this.pool = null; this.writeQueue = Promise.resolve(); }
  ensureData() { ['users', 'listings', 'comments', 'trades', 'notifications', 'activities', 'deliveries', 'conversations', 'communityPosts', 'memberships', 'promotions', 'securityEvents', 'sessions'].forEach(key => { if (!Array.isArray(this.data[key])) this.data[key] = []; }); this.data.sessions = this.data.sessions.filter(session => session?.tokenHash && session.expiresAt > Date.now()); this.data.conversations = this.data.conversations.filter(conversation => !(conversation.participantIds || []).includes('system-appraisal-parrot')); this.data.users = this.data.users.filter(user => user.id !== 'system-appraisal-parrot'); this.data.users.forEach(user => { if (!Array.isArray(user.profileTags)) user.profileTags = []; if (String(user.username || '').trim().toLowerCase() === developerPassUsername) user.developerPass = true; }); const testAuction = this.data.listings.find(listing => listing.title === 'TEST' && listing.description === 'Internal payment-flow test listing. Do not purchase.'); if (testAuction) { testAuction.listingMode = 'auction_only'; testAuction.auctionEndless = true; testAuction.auctionEndAt = null; testAuction.auctionStartPrice = Number.isFinite(Number(testAuction.auctionStartPrice)) ? Number(testAuction.auctionStartPrice) : 0; } const testUser = this.data.users.find(user => String(user.username || '').trim().toLowerCase() === 'test'); if (testUser && !this.data.listings.some(listing => listing.ownerId === testUser.id && listing.title === 'TEST 2')) this.data.listings.unshift({ id: id(), ownerId: testUser.id, title: 'TEST 2', description: 'Internal browsing-flow test listing. Do not purchase.', category: 'Memorabilia', condition: 'New', tags: ['Memorabilia', 'New', 'Test', 'Browsing Test', 'US City/Town: San Diego, CA'], location: 'San Diego, CA 92106', sellerCity: 'San Diego, CA', sellerZip: '92106', locationCoordinates: null, pickupRadiusMiles: 0, fulfillment: 'pickup_delivery', upsPackagingCost: 0, listingMode: 'marketplace', auctionStartPrice: null, auctionEndAt: null, auctionBids: 0, price: 1, tradeOffer: false, images: ['https://collectormarketplace.net/public/logo-three-cards.png'], videos: [], status: 'active', likes: [], createdAt: now() }); }
  load() {
    if (fs.existsSync(dataFile)) {
      try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { console.warn('Ignoring unreadable local marketplace data.'); }
    }
    return { users: [], listings: [], comments: [], trades: [], deliveries: [], notifications: [], activities: [] };
  }
  removeDemoContent() {
    const isDemoUser = user => user.email === 'alex@collector.local' || user.email === 'test715a7345@example.com';
    const demoUserIds = new Set(this.data.users.filter(isDemoUser).map(user => user.id));
    const demoIds = new Set(this.data.listings.filter(listing => listing.title === 'Database smoke-test listing' || demoUserIds.has(listing.ownerId)).map(listing => listing.id));
    if (!demoIds.size && !demoUserIds.size) return false;
    this.data.listings = this.data.listings.filter(listing => !demoIds.has(listing.id));
    this.data.comments = this.data.comments.filter(comment => !demoIds.has(comment.listingId));
    this.data.activities = this.data.activities.filter(activity => !demoIds.has(activity.listingId) && !demoUserIds.has(activity.userId));
    this.data.trades = this.data.trades.filter(trade => !demoUserIds.has(trade.senderId) && !demoUserIds.has(trade.receiverId));
    this.data.deliveries = this.data.deliveries.filter(delivery => !demoUserIds.has(delivery.buyerId) && !demoUserIds.has(delivery.sellerId));
    this.data.conversations = this.data.conversations.filter(conversation => !(conversation.participantIds || []).some(userId => demoUserIds.has(userId)));
    this.data.notifications = this.data.notifications.filter(notification => !demoUserIds.has(notification.userId));
    this.data.communityPosts = this.data.communityPosts.filter(post => !demoUserIds.has(post.authorId));
    this.data.users = this.data.users.filter(user => !demoUserIds.has(user.id));
    return true;
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
    this.removeDemoContent();
    await this.save();
    console.log('Connected to collector-db.');
  }
  save() {
    this.data.users.forEach(user => refreshGrandCurator(user));
    fs.writeFileSync(dataFile, JSON.stringify(this.data, null, 2));
    if (this.pool) this.writeQueue = this.writeQueue.then(() => this.pool.query('INSERT INTO marketplace_state (id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()', ['primary', JSON.stringify(this.data)])).catch(error => console.error('Postgres save failed:', error));
    return this.writeQueue;
  }
}
const store = new Store();
const platformGames = new Set(['star-run', 'puppy-jump', 'auction-falls', 'canopy-run', 'venice-cannon', 'lava-run', 'goblin-run']);
const completedItemCount = user => store.data.deliveries.filter(delivery => delivery.status === 'completed' && (delivery.buyerId === user?.id || delivery.sellerId === user?.id)).length;
const platformScoreboard = game => store.data.users.map(user => ({ user, score: Math.max(0, Number(user.platformScores?.[game]) || 0) })).filter(row => row.score > 0);
const isLeaderboardChampion = user => [...platformGames].some(game => {
  const scores = platformScoreboard(game);
  const best = Math.max(0, ...scores.map(row => row.score));
  return best > 0 && Number(user?.platformScores?.[game] || 0) === best;
});
const baseAccountAwards = user => {
  const originalCollector = new Date(user?.createdAt || 0).valueOf() < new Date('2027-01-01T00:00:00.000Z').valueOf() || user?.originalCollectorPromo === true;
  const barterLord = completedItemCount(user) >= 5000;
  const leaderboardChampion = isLeaderboardChampion(user);
  const proGamer = Object.values(user?.platformScores || {}).some(score => Number(score) > 0);
  return [
    { id: 'original-collector', name: 'Original Collector', earned: originalCollector, discount: .015, detail: 'Joined before 2027 or earned through a promotional event · 1.5% lifetime fee reduction.' },
    { id: 'barter-lord', name: 'Barter Lord', earned: barterLord, discount: .005, detail: `${completedItemCount(user).toLocaleString()} of 5,000 completed items · 0.5% lifetime fee reduction.` },
    { id: 'leaderboard-champion', name: 'Leaderboard Champion', earned: leaderboardChampion, discount: .01, detail: 'Currently holds at least one platform-wide high score · 1% temporary fee reduction.' },
    { id: 'pro-gamer', name: 'Pro Gamer', earned: proGamer, discount: .0025, detail: 'Reached a platform scoreboard · 0.25% lifetime fee reduction.' }
  ];
};
function refreshGrandCurator(user) {
  if (!user?.grandCurator && baseAccountAwards(user).every(award => award.earned)) user.grandCurator = true;
  return Boolean(user?.grandCurator);
}
const accountAwards = user => {
  const baseAwards = baseAccountAwards(user);
  const grandCurator = refreshGrandCurator(user);
  return [...baseAwards, { id: 'grand-curator', name: 'Grand Curator', earned: grandCurator, discount: .004, detail: grandCurator ? 'All awards collected · lifetime VIP Curator and 0.40% fee reduction.' : 'Collect every other award at least once to unlock lifetime VIP Curator and 0.40% off.' }];
};
const marketplaceFeeRate = user => {
  if (hasDeveloperPass(user)) return 0;
  const awards = accountAwards(user);
  const proGamerDiscount = awards.find(award => award.id === 'pro-gamer' && award.earned)?.discount || 0;
  const grandCuratorDiscount = awards.find(award => award.id === 'grand-curator' && award.earned)?.discount || 0;
  if (hasActiveCuratorMembership(user)) return Math.max(0, .01 - proGamerDiscount - grandCuratorDiscount);
  return Math.max(0, .04 - awards.filter(award => award.earned).reduce((total, award) => total + award.discount, 0));
};
// Voice audio stays peer-to-peer. These short-lived rooms only carry WebRTC
// signaling and presence, so no microphone audio is stored by the marketplace.
const voiceRooms = new Map();
const googleOAuthStates = new Map();
app.use((req, res, next) => {
  const ipHash = crypto.createHash('sha256').update(String(req.ip || '')).digest('hex').slice(0, 16);
  if (blockedIpHashes.has(ipHash)) { securityLog('blocked_ip_request', req); return res.status(403).json({ error: 'This network is unavailable for security reasons.' }); }
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  if (process.env.NODE_ENV === 'production' && !req.secure) return res.status(400).json({ error: 'HTTPS is required.' });
  next();
});
app.use(express.json({ limit: '2mb' }));
app.get('/healthz', (req, res) => res.status(200).json({ ok: true, service: 'CollectorMarketplace.net', database: store.pool ? 'collector-db' : 'local' }));

function publicUser(user) { if (!user) return null; const { password, email, shippingProfile, lobbySong, profileViewHistory, ...safe } = user; return { ...safe, awards: accountAwards(user), marketplaceFeeRate: marketplaceFeeRate(user) }; }
function directoryUser(user) { if (!user) return null; const { password, email, following, shippingProfile, lobbySong, ...safe } = user; return safe; }
function currentUser(req) { const token = req.headers.authorization?.replace('Bearer ', ''); const tokenHash = sessionTokenHash(token); const session = (store.data.sessions || []).find(entry => entry.tokenHash === tokenHash); if (!session || session.expiresAt < Date.now()) { if (session) { store.data.sessions = store.data.sessions.filter(entry => entry !== session); store.save(); } return null; } return store.data.users.find(user => user.id === session.userId) || null; }
function required(req, res, next) { const user = currentUser(req); if (!user || user.frozenAt) return res.status(user?.frozenAt ? 423 : 401).json({ error: user?.frozenAt ? 'This account is temporarily frozen while a safety review is open.' : 'Sign in required' }); req.user = user; next(); }
function limitAuth(req, res, next) { const key = `${req.ip}:${req.path}`; const entry = loginAttempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 }; if (entry.resetAt < Date.now()) { entry.count = 0; entry.resetAt = Date.now() + 15 * 60 * 1000; } entry.count += 1; loginAttempts.set(key, entry); if (entry.count > 12) { securityLog('rate_limit', req); return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes before trying again.' }); } next(); }
function recordDevice(user, req) {
  const deviceId = String(req.headers['x-device-id'] || '').trim().slice(0, 160);
  if (!deviceId) return false;
  const hash = crypto.createHash('sha256').update(deviceId).digest('hex');
  if (!Array.isArray(user.devices)) user.devices = [];
  const known = user.devices.find(device => device.hash === hash);
  if (known) { known.lastSeenAt = now(); return false; }
  user.devices.push({ hash, firstSeenAt: now(), lastSeenAt: now() });
  user.devices = user.devices.slice(-20);
  securityLog('new_device_login', req, { userId: user.id });
  return true;
}
function activity(type, userId, extra = {}) { store.data.activities.unshift({ id: id(), type, userId, createdAt: now(), ...extra }); }
function notify(userId, type, message, link) { store.data.notifications.unshift({ id: id(), userId, type, message, link, read: false, createdAt: now() }); }
function recordPaymentFailure(user, req, reason = '') { if (!user) return; const cutoff = Date.now() - 60 * 60 * 1000; user.paymentFailures = (user.paymentFailures || []).filter(at => new Date(at).valueOf() > cutoff); user.paymentFailures.push(now()); if (user.paymentFailures.length >= 5) user.paymentRestrictedAt = now(); securityLog('payment_failed', req, { userId: user.id, reason: String(reason).slice(0, 120), count: user.paymentFailures.length }); }
const shippoReady = () => Boolean(process.env.SHIPPO_API_KEY);
async function shippoRequest(pathname, body) { if (!shippoReady()) throw new Error('Shipping labels are not configured yet. Add SHIPPO_API_KEY in Render.'); const response = await fetch(`https://api.goshippo.com${pathname}`, { method: 'POST', headers: { Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`, 'Content-Type': 'application/json', 'SHIPPO-API-VERSION': '2018-02-08' }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.detail || payload.messages?.[0]?.text || 'Shippo could not complete that request.'); return payload; }
const paypalReady = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
const paypalEnvironment = () => process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
const paypalBaseUrl = () => paypalEnvironment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const paypalLabel = () => paypalEnvironment() === 'live' ? 'PayPal' : 'PayPal Sandbox';
function paypalFailure(payload, fallback) { const error = new Error(payload.message || payload.details?.[0]?.description || fallback); error.code = payload.details?.[0]?.issue || payload.name || ''; error.debugId = payload.debug_id || ''; return error; }
async function paypalAccessToken() {
  if (!paypalReady()) throw new Error(`${paypalLabel()} is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_SECRET in Render.`);
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw paypalFailure(payload, `${paypalLabel()} could not authorize this checkout.`);
  return payload.access_token;
}
async function paypalRequest(method, pathname, body, requestId) {
  const token = await paypalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}${pathname}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw paypalFailure(payload, `${paypalLabel()} could not complete this checkout.`);
  return payload;
}
function shippoAddress(input, label) { const value = input && typeof input === 'object' ? input : {}; const required = ['name', 'street1', 'city', 'state', 'zip']; if (required.some(key => !String(value[key] || '').trim())) throw new Error(`Add a complete ${label} address.`); return { name: String(value.name).trim(), street1: String(value.street1).trim(), street2: String(value.street2 || '').trim(), city: String(value.city).trim(), state: String(value.state).trim(), zip: String(value.zip).trim(), country: String(value.country || 'US').trim().toUpperCase() }; }
function shippoParcel(input) { const value = input && typeof input === 'object' ? input : {}; const keys = ['length', 'width', 'height', 'weight']; if (keys.some(key => !(Number(value[key]) > 0))) throw new Error('Add positive package dimensions and weight.'); return { length: Number(value.length), width: Number(value.width), height: Number(value.height), distance_unit: 'in', weight: Number(value.weight), mass_unit: 'lb' }; }
const googleOAuthReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const googleRedirectUri = req => `${req.protocol}://${req.get('host')}/auth/google/callback`;
const readCookie = (req, name) => String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
const googleUsername = profile => {
  const base = String(profile.email || profile.name || 'collector').split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'collector';
  let candidate = base;
  let suffix = 1;
  while (store.data.users.some(user => user.username.toLowerCase() === candidate.toLowerCase())) candidate = `${base.slice(0, Math.max(1, 20 - String(++suffix).length))}${suffix}`;
  return candidate;
};
app.get('/auth/google', (req, res) => {
  if (!googleOAuthReady()) return res.status(503).send('Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the deployment environment.');
  const state = crypto.randomBytes(32).toString('hex');
  googleOAuthStates.set(state, Date.now() + 10 * 60 * 1000);
  res.cookie('collector_google_state', state, { httpOnly: true, secure: req.secure, sameSite: 'lax', path: '/auth/google', maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: googleRedirectUri(req), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
app.get('/auth/google/callback', async (req, res) => {
  const state = String(req.query.state || '');
  const expiry = googleOAuthStates.get(state);
  googleOAuthStates.delete(state);
  res.clearCookie('collector_google_state', { path: '/auth/google' });
  if (!googleOAuthReady() || !state || readCookie(req, 'collector_google_state') !== state || !expiry || expiry < Date.now() || !req.query.code) return res.redirect('/#google-auth-error');
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: googleRedirectUri(req), grant_type: 'authorization_code' }) });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error('Google did not authorize this sign-in.');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenPayload.access_token}` } });
    const profile = await profileResponse.json().catch(() => ({}));
    const email = String(profile.email || '').trim().toLowerCase();
    if (!profileResponse.ok || !profile.sub || !email || profile.email_verified !== true) throw new Error('Google did not provide a verified email address.');
    let user = store.data.users.find(entry => entry.googleId === profile.sub || String(entry.email || '').toLowerCase() === email);
    if (user) {
      user.googleId = profile.sub;
      if (!user.avatar || /^[A-Z]{1,2}$/.test(user.avatar)) user.avatar = String(profile.picture || user.avatar || user.username.slice(0, 2).toUpperCase());
    } else {
      user = { id: id(), username: googleUsername(profile), email, password: null, googleId: profile.sub, avatar: String(profile.picture || '').trim() || googleUsername(profile).slice(0, 2).toUpperCase(), bio: '', reputation: 0, following: [], developerPass: false, createdAt: now() };
      store.data.users.push(user);
      activity('signup', user.id, { provider: 'google' });
    }
    store.save();
    securityLog('google_login', req, { userId: user.id });
    res.redirect(`/#${new URLSearchParams({ google_token: createSession(user.id), google_login: '1' })}`);
  } catch (error) {
    console.error('Google sign-in failed:', error.message);
    res.redirect('/#google-auth-error');
  }
});
function usCityTownTag(location) {
  const parts = String(location || '').split(',').map(part => part.trim()).filter(Boolean);
  const country = parts.at(-1) || '';
  if (!/^(?:united states(?: of america)?|u\.?s\.?a\.?)$/i.test(country) || !parts[0]) return '';
  const place = parts.slice(0, -1).join(', ');
  return place ? `US City/Town: ${place}` : '';
}

app.post('/signup', limitAuth, async (req, res) => {
  const username = String(req.body.username || '').trim(); const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  if (!req.body.acceptedTerms || !req.body.confirmedAdult) return res.status(400).json({ error: 'Confirm that you are at least 18 and accept the User Agreement and Privacy Policy to create an account.' });
  if (!/^[a-z0-9_]{3,32}$/i.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) return res.status(400).json({ error: 'Use a 3–32 character name, a valid email, and a password of at least 12 characters.' });
  if (store.data.users.some(user => String(user.email || '').toLowerCase() === email || user.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'Email or username already in use' });
  const user = { id: id(), username, email, password: await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }), avatar: username.slice(0, 2).toUpperCase(), bio: '', reputation: 0, following: [], developerPass: username.toLowerCase() === developerPassUsername, termsAcceptedAt: now(), ageConfirmedAt: now(), createdAt: now() };
  recordDevice(user, req); store.data.users.push(user); store.save(); securityLog('signup', req, { userId: user.id }); res.status(201).json({ token: createSession(user.id), user: publicUser(user) });
});
app.post('/login', limitAuth, async (req, res) => { const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || ''); const user = store.data.users.find(entry => String(entry.email || '').toLowerCase() === email); const storedPassword = String(user?.password || ''); const valid = storedPassword.startsWith('$argon2') ? await argon2.verify(storedPassword, password).catch(() => false) : Boolean(user && Buffer.byteLength(storedPassword) === Buffer.byteLength(password) && crypto.timingSafeEqual(Buffer.from(storedPassword), Buffer.from(password))); if (!valid) { securityLog('login_failed', req); return res.status(401).json({ error: 'Invalid email or password' }); } if (!storedPassword.startsWith('$argon2')) user.password = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }); if (user.twoFactorEnabled) { const challenge = crypto.randomBytes(24).toString('base64url'); twoFactorChallenges.set(challenge, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 }); securityLog('two_factor_challenge', req, { userId: user.id }); return res.json({ requiresTwoFactor: true, challenge }); } const unfamiliarDevice = recordDevice(user, req); store.save(); securityLog('login', req, { userId: user.id, unfamiliarDevice }); res.json({ token: createSession(user.id), user: publicUser(user), unfamiliarDevice }); });
app.post('/login/2fa', limitAuth, (req, res) => { const challenge = twoFactorChallenges.get(String(req.body.challenge || '')); twoFactorChallenges.delete(String(req.body.challenge || '')); const user = challenge && challenge.expiresAt > Date.now() && store.data.users.find(row => row.id === challenge.userId); let secret = ''; try { secret = decryptPrivate(user?.twoFactorSecret); } catch {} if (!user || !user.twoFactorEnabled || !secret || !verifyTotp(secret, req.body.code)) { securityLog('two_factor_failed', req, { userId: user?.id }); return res.status(401).json({ error: 'The verification code is invalid or expired.' }); } const unfamiliarDevice = recordDevice(user, req); store.save(); securityLog('login_2fa', req, { userId: user.id, unfamiliarDevice }); res.json({ token: createSession(user.id), user: publicUser(user), unfamiliarDevice }); });
app.get('/auth/session', required, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/auth/logout', required, (req, res) => { const tokenHash = sessionTokenHash(req.headers.authorization?.replace('Bearer ', '')); store.data.sessions = (store.data.sessions || []).filter(session => session.tokenHash !== tokenHash); store.save(); securityLog('logout', req, { userId: req.user.id }); res.status(204).end(); });
app.put('/account/password', required, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || ''); const password = String(req.body.password || '');
  if (!req.user.password) return res.status(400).json({ error: 'This Google-connected account does not have an email password to change.' });
  if (password.length < 12) return res.status(400).json({ error: 'Use a password with at least 12 characters.' });
  if (!await argon2.verify(req.user.password, currentPassword).catch(() => false)) { securityLog('password_change_failed', req, { userId: req.user.id }); return res.status(401).json({ error: 'Current password is incorrect.' }); }
  req.user.password = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  revokeUserSessions(req.user.id); const token = createSession(req.user.id); securityLog('password_changed', req, { userId: req.user.id }); await store.save(); res.json({ token, user: publicUser(req.user) });
});
app.post('/account/2fa/setup', required, (req, res) => { if (!encryptionKey) return res.status(503).json({ error: 'Two-factor security needs DATA_ENCRYPTION_KEY configured before it can be enabled.' }); const secret = base32Secret(); twoFactorEnrollments.set(req.user.id, { secret, expiresAt: Date.now() + 10 * 60 * 1000 }); securityLog('two_factor_setup_started', req, { userId: req.user.id }); res.json({ secret, issuer: 'CollectorMarketplace.net', account: req.user.username, otpauthUrl: `otpauth://totp/${encodeURIComponent(`CollectorMarketplace.net:${req.user.username}`)}?secret=${secret}&issuer=CollectorMarketplace.net&period=30&digits=6` }); });
app.post('/account/2fa/enable', required, (req, res) => { const enrollment = twoFactorEnrollments.get(req.user.id); twoFactorEnrollments.delete(req.user.id); if (!enrollment || enrollment.expiresAt < Date.now() || !verifyTotp(enrollment.secret, req.body.code)) return res.status(400).json({ error: 'Enter the current six-digit code from your authenticator app.' }); try { req.user.twoFactorSecret = encryptPrivate(enrollment.secret); } catch (error) { return res.status(503).json({ error: error.message }); } req.user.twoFactorEnabled = true; revokeUserSessions(req.user.id); const token = createSession(req.user.id); securityLog('two_factor_enabled', req, { userId: req.user.id }); store.save(); res.json({ token, user: publicUser(req.user) }); });
app.get('/user/:id', (req, res) => { const user = store.data.users.find(u => u.id === req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); const viewer = currentUser(req); if (viewer && viewer.id !== user.id) { const cutoff = Date.now() - 24 * 60 * 60 * 1000; const viewHistory = user.profileViewHistory && typeof user.profileViewHistory === 'object' ? user.profileViewHistory : {}; Object.entries(viewHistory).forEach(([viewerId, viewedAt]) => { if (new Date(viewedAt).valueOf() < cutoff) delete viewHistory[viewerId]; }); if (!viewHistory[viewer.id]) { user.profileViewCount = Number(user.profileViewCount || 0) + 1; viewHistory[viewer.id] = now(); user.profileViewHistory = viewHistory; store.save(); } } const listings = store.data.listings.filter(l => l.ownerId === user.id); const history = store.data.trades.filter(t => (t.senderId === user.id || t.receiverId === user.id) && t.status === 'completed'); res.json({ ...publicUser(user), lobbySong: user.lobbySong || '', activeListings: listings.filter(l => l.status === 'active'), tradeHistory: history }); });
app.post('/scoreboard/score', required, (req, res) => {
  const game = String(req.body.game || '').trim();
  const score = Math.min(1000000000, Math.max(0, Math.floor(Number(req.body.score) || 0)));
  if (!platformGames.has(game) || !score) return res.status(400).json({ error: 'Use a supported game and a positive score.' });
  if (!req.user.platformScores || typeof req.user.platformScores !== 'object') req.user.platformScores = {};
  req.user.platformScores[game] = Math.max(Number(req.user.platformScores[game] || 0), score);
  store.save();
  res.json({ user: publicUser(req.user), game, score: req.user.platformScores[game], highScore: Math.max(0, ...platformScoreboard(game).map(row => row.score)) });
});
app.delete('/scoreboard/score/:game', required, (req, res) => {
  const game = String(req.params.game || '');
  if (!platformGames.has(game)) return res.status(400).json({ error: 'Use a supported game.' });
  if (req.user.platformScores) delete req.user.platformScores[game];
  store.save(); securityLog('score_reset_personal', req, { userId: req.user.id, game });
  res.status(204).end();
});
app.delete('/scoreboard/:game', required, (req, res) => {
  const game = String(req.params.game || '');
  if (!platformGames.has(game)) return res.status(400).json({ error: 'Use a supported game.' });
  if (!hasDeveloperPass(req.user)) return res.status(403).json({ error: 'Developer access is required to reset a platform leaderboard.' });
  store.data.users.forEach(user => { if (user.platformScores) delete user.platformScores[game]; });
  store.save(); securityLog('score_reset_global', req, { userId: req.user.id, game });
  res.status(204).end();
});
app.get('/scoreboard', (req, res) => {
  const viewer = currentUser(req);
  const games = [...platformGames].map(game => {
    const rows = platformScoreboard(game).sort((left, right) => right.score - left.score || String(left.user.username).localeCompare(String(right.user.username)));
    const leaderboard = rows.slice(0, 50).map((row, index) => ({ rank: index + 1, score: row.score, user: { id: row.user.id, username: row.user.username, avatar: row.user.avatar || '' } }));
    const viewerIndex = viewer ? rows.findIndex(row => row.user.id === viewer.id) : -1;
    return { id: game, name: game.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase()), leaderboard, yourPlacement: viewerIndex >= 0 ? { rank: viewerIndex + 1, score: rows[viewerIndex].score } : null };
  });
  res.json({ games, signedIn: Boolean(viewer) });
});
const listingStatistics = (listing, includePrivateAudience = false) => { const votes = listing.votes && typeof listing.votes === 'object' ? listing.votes : {}; const voterIds = [...new Set([...(listing.likes || []), ...Object.keys(votes)])]; const voter = userId => { const user = store.data.users.find(candidate => candidate.id === userId); return user ? { id: user.id, username: user.username, avatar: user.avatar || '', profileTags: user.profileTags || [] } : null; }; const audienceTags = ['Male', 'Female', 'Unisex', 'LGTBQ+', 'Baby', 'Toddler', 'Child', 'Teen', 'Adult', 'Elder']; const selfDeclaredAudience = Object.fromEntries(audienceTags.map(tag => [tag, voterIds.filter(userId => (store.data.users.find(user => user.id === userId)?.profileTags || []).some(profileTag => String(profileTag).toLowerCase() === tag.toLowerCase())).length])); const statistics = { impressions: Number(listing.impressionCount || 0), views: Number(listing.viewCount || 0), saves: Array.isArray(listing.favorites) ? listing.favorites.length : 0, likes: Array.isArray(listing.likes) ? listing.likes.length : 0, comments: store.data.comments.filter(comment => comment.listingId === listing.id).length, tradeInquiries: (store.data.trades || []).filter(trade => trade.listingId === listing.id || (trade.receiverListingIds || []).includes(listing.id) || (trade.senderListingIds || []).includes(listing.id)).length, voteScore: Object.values(votes).reduce((total, value) => total + Number(value || 0), 0), promotion: listing.promotion || null }; if (includePrivateAudience) statistics.audience = { sampleSize: voterIds.length, selfDeclaredTags: selfDeclaredAudience, location: 'Not collected for advertising analytics', upvoters: Object.entries(votes).filter(([, value]) => Number(value) === 1).map(([userId]) => voter(userId)).filter(Boolean), downvoters: Object.entries(votes).filter(([, value]) => Number(value) === -1).map(([userId]) => voter(userId)).filter(Boolean) }; return statistics; };
app.get('/user/:id/listings', required, (req, res) => { if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Not allowed' }); const rows = store.data.listings.filter(listing => listing.ownerId === req.user.id).map(listing => ({ ...listing, owner: publicUser(req.user), likeCount: Array.isArray(listing.likes) ? listing.likes.length : 0, commentCount: store.data.comments.filter(comment => comment.listingId === listing.id).length, statistics: listingStatistics(listing, true) })); res.json(rows); });
app.get('/users/suggestions', required, (req, res) => { const excluded = new Set([req.user.id, ...req.user.following]); const users = store.data.users.filter(user => !excluded.has(user.id)).sort((a, b) => (b.reputation || 0) - (a.reputation || 0) || a.username.localeCompare(b.username)).slice(0, 8).map(user => ({ ...publicUser(user), activeListingCount: store.data.listings.filter(listing => listing.ownerId === user.id && listing.status === 'active').length })); res.json(users); });
app.get('/users', (req, res) => res.json(store.data.users.map(user => ({ ...directoryUser(user), activeListingCount: store.data.listings.filter(listing => listing.ownerId === user.id && listing.status === 'active').length, followingCount: Array.isArray(user.following) ? user.following.length : 0 }))));
app.get('/collectives', (req, res) => res.json(collectiveCatalog.map(collective => ({ ...collective, postCount: store.data.communityPosts.filter(post => post.type === 'collectives' && post.entityId === collective.id).length }))));
app.get('/brands', (req, res) => res.json(brandCatalog));
app.get('/couriers', (req, res) => res.json(Object.entries(deliveryProviders).map(([name, details]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, category: details.type.replaceAll('_', ' '), description: details.trackingRequired ? 'Tracking-supported delivery option for collector purchases.' : 'Local handoff delivery option for collector purchases.', tags: ['Courier', 'Delivery', details.type.replaceAll('_', ' ')] }))));
app.get('/chatrooms', (req, res) => res.json(chatRoomCatalog));
function communityEntity(type, entityId) { if (type === 'accounts') return store.data.users.find(user => user.id === entityId) ? { id: entityId, name: `@${store.data.users.find(user => user.id === entityId).username}` } : null; if (type === 'collectives') return collectiveCatalog.find(entity => entity.id === entityId) || null; if (type === 'brands') return brandCatalog.find(entity => entity.id === entityId) || null; if (type === 'chatrooms') return chatRoomCatalog.find(entity => entity.id === entityId) || null; return null; }
function communityPostView(post) { return { ...post, author: directoryUser(store.data.users.find(user => user.id === post.authorId)), replies: (post.replies || []).map(reply => ({ ...reply, author: directoryUser(store.data.users.find(user => user.id === reply.authorId)) })) }; }
app.get('/community/:type/:entityId', (req, res) => { const entity = communityEntity(req.params.type, req.params.entityId); if (!entity) return res.status(404).json({ error: 'Discussion space not found.' }); res.json({ entity, posts: store.data.communityPosts.filter(post => post.type === req.params.type && post.entityId === req.params.entityId).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(communityPostView) }); });
app.post('/community/:type/:entityId', required, (req, res) => { const entity = communityEntity(req.params.type, req.params.entityId); const title = String(req.body.title || '').trim(); const body = String(req.body.body || '').trim(); if (!entity) return res.status(404).json({ error: 'Discussion space not found.' }); if (!title || !body || title.length > 140 || body.length > 2000) return res.status(400).json({ error: 'Use a title up to 140 characters and a post up to 2,000 characters.' }); const post = { id: id(), type: req.params.type, entityId: req.params.entityId, authorId: req.user.id, title, body, replies: [], createdAt: now() }; store.data.communityPosts.unshift(post); activity('community_post', req.user.id, { communityType: post.type, communityId: post.entityId }); store.save(); res.status(201).json(communityPostView(post)); });
app.post('/community/:type/:entityId/:postId/replies', required, (req, res) => { const post = store.data.communityPosts.find(row => row.id === req.params.postId && row.type === req.params.type && row.entityId === req.params.entityId); const body = String(req.body.body || '').trim(); if (!post) return res.status(404).json({ error: 'Discussion post not found.' }); if (!body || body.length > 2000) return res.status(400).json({ error: 'Use a reply up to 2,000 characters.' }); const reply = { id: id(), authorId: req.user.id, body, createdAt: now() }; post.replies.push(reply); store.save(); res.status(201).json({ ...reply, author: directoryUser(req.user) }); });
app.put('/user/:id', required, (req, res) => { if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Not allowed' }); ['username','avatar','bio'].forEach(k => { if (req.body[k] !== undefined) req.user[k] = req.body[k]; }); if (req.body.lobbySong !== undefined) { const song = String(req.body.lobbySong || ''); if (song && (!/^data:audio\/(mpeg|mp3)(?:;[a-z0-9=._-]+)*;base64,[a-z0-9+/=]+$/i.test(song) || song.length > 5500000)) return res.status(400).json({ error: 'Use an MP3 lobby song under 4 MB.' }); req.user.lobbySong = song; } if (req.body.profileTags !== undefined) { if (!Array.isArray(req.body.profileTags)) return res.status(400).json({ error: 'Profile tags must be a list.' }); const tags = [...new Set(req.body.profileTags.map(tag => String(tag).replace(/^#/, '').trim()).filter(tag => tag && tag.length <= 48))].slice(0, 20); req.user.profileTags = tags; } activity('profile', req.user.id); store.save(); res.json({ ...publicUser(req.user), lobbySong: req.user.lobbySong || '' }); });
app.get('/account/shipping-profile', required, (req, res) => { try { res.json(decryptPrivate(req.user.shippingProfile) || {}); } catch (error) { res.status(503).json({ error: 'Private shipping data is temporarily unavailable.' }); } });
app.put('/account/shipping-profile', required, (req, res) => { try { const profile = shippoAddress(req.body, 'shipping profile'); if (profile.name.length > 120 || profile.street1.length > 160 || profile.street2.length > 120 || profile.city.length > 80 || !/^[A-Z]{2}$/i.test(profile.state) || !/^\d{5}(?:-\d{4})?$/.test(profile.zip)) return res.status(400).json({ error: 'Use a complete US name, street, city, two-letter state, and ZIP code.' }); req.user.shippingProfile = encryptPrivate(profile); store.save(); securityLog('shipping_profile_updated', req, { userId: req.user.id }); res.json(profile); } catch (error) { res.status(400).json({ error: error.message }); } });
app.post('/user/:id/follow', required, (req, res) => { if (req.user.id === req.params.id) return res.status(400).json({ error: 'You cannot follow yourself' }); if (!store.data.users.some(u => u.id === req.params.id)) return res.status(404).json({ error: 'User not found' }); const following = req.user.following; const index = following.indexOf(req.params.id); index < 0 ? following.push(req.params.id) : following.splice(index, 1); store.save(); res.json({ following: index < 0 }); });
app.get('/user/:id/connections', required, (req, res) => { if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Not allowed' }); const following = store.data.users.filter(user => req.user.following.includes(user.id)); const friends = following.filter(user => user.following.includes(req.user.id)); res.json({ following: following.map(publicUser), friends: friends.map(publicUser) }); });
function conversationView(conversation, userId) { const other = store.data.users.find(user => user.id === conversation.participantIds.find(id => id !== userId)); return { ...conversation, otherUser: publicUser(other) }; }
app.get('/conversations', required, (req, res) => res.json(store.data.conversations.filter(conversation => conversation.participantIds.includes(req.user.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(conversation => conversationView(conversation, req.user.id))));
app.post('/conversations', required, (req, res) => { const recipientId = req.body.recipientId; if (!recipientId || recipientId === req.user.id || !store.data.users.some(user => user.id === recipientId)) return res.status(400).json({ error: 'Choose another collector to message.' }); let conversation = store.data.conversations.find(row => row.participantIds.includes(req.user.id) && row.participantIds.includes(recipientId) && row.participantIds.length === 2); if (!conversation) { conversation = { id: id(), participantIds: [req.user.id, recipientId], messages: [], createdAt: now(), updatedAt: now() }; store.data.conversations.unshift(conversation); store.save(); } res.status(201).json(conversationView(conversation, req.user.id)); });
app.get('/conversation/:id', required, (req, res) => { const conversation = store.data.conversations.find(row => row.id === req.params.id && row.participantIds.includes(req.user.id)); if (!conversation) return res.status(404).json({ error: 'Conversation not found' }); res.json(conversationView(conversation, req.user.id)); });
app.post('/conversation/:id/messages', required, (req, res) => {
  const conversation = store.data.conversations.find(row => row.id === req.params.id && row.participantIds.includes(req.user.id));
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const body = String(req.body.body || '').trim();
  const imageUrl = String(req.body.imageUrl || '').trim();
  const validImage = !imageUrl || (/^https:\/\/[\w.-]+\//i.test(imageUrl) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(imageUrl));
  if ((!body && !imageUrl) || body.length > 1000 || imageUrl.length > 5500000 || !validImage) return res.status(400).json({ error: 'Send a message up to 1,000 characters and an optional valid image under 4 MB.' });
  const message = { id: id(), senderId: req.user.id, body, imageUrl, createdAt: now() };
  conversation.messages.push(message); conversation.updatedAt = now();
  const recipientId = conversation.participantIds.find(userId => userId !== req.user.id);
  notify(recipientId, 'collector_message', `${req.user.username} sent you a message`, `/conversation/${conversation.id}`);
  store.save(); res.status(201).json(message);
});

function voiceRoomAllowed(roomId, userId) {
  const [kind, targetId] = String(roomId || '').split(':');
  if (!targetId || !['conversation', 'trade', 'auction', 'chatroom'].includes(kind)) return false;
  if (kind === 'conversation') return store.data.conversations.some(row => row.id === targetId && row.participantIds.includes(userId));
  if (kind === 'trade') return store.data.trades.some(row => row.id === targetId && (row.senderId === userId || row.receiverId === userId));
  if (kind === 'auction') {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'auctions.json'), 'utf8')).some(row => row.id === targetId); } catch { return false; }
  }
  if (kind === 'chatroom') return chatRoomCatalog.some(room => room.id === targetId);
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

app.get('/listings', (req, res) => { let promotionChanged = false; store.data.listings.forEach(listing => { if (listing.promotion?.status === 'active' && new Date(listing.promotion.endsAt).valueOf() <= Date.now()) { listing.promotion = { ...listing.promotion, status: 'completed', completedAt: now() }; promotionChanged = true; } }); const { category, q, status = 'active' } = req.query; let rows = store.data.listings.filter(l => !status || l.status === status); if (category) rows = rows.filter(l => l.category === category); if (q) { const s = q.toLowerCase(); rows = rows.filter(l => `${l.title} ${l.description} ${l.category || ''} ${l.condition || ''} ${(l.tags || []).join(' ')}`.toLowerCase().includes(s)); } const promotedFirst = [...rows].sort((left, right) => { const activeDifference = Number(right.promotion?.status === 'active') - Number(left.promotion?.status === 'active'); if (activeDifference) return activeDifference; if (left.promotion?.status === 'active' && right.promotion?.status === 'active') return Number(right.promotion?.dailyBudget || 0) - Number(left.promotion?.dailyBudget || 0); return 0; }); promotedFirst.forEach(listing => { listing.impressionCount = Number(listing.impressionCount || 0) + 1; }); if (promotionChanged || promotedFirst.length) store.save(); res.json(promotedFirst.map(l => ({ ...l, owner: publicUser(store.data.users.find(u => u.id === l.ownerId)), likeCount: l.likes.length, commentCount: store.data.comments.filter(comment => comment.listingId === l.id).length }))); });
app.get('/auctions', (req, res) => {
  const userLots = store.data.listings.filter(listing => listing.status === 'active' && ['auction_only', 'marketplace_auction'].includes(listing.listingMode)).map(listing => ({ id: listing.id, title: listing.title, category: listing.category, tags: listing.tags, currentBid: Number(listing.auctionStartPrice || listing.price || 0), bids: Number(listing.auctionBids || 0), endAt: listing.auctionEndAt, auctionEndless: listing.auctionEndless === true, image: listing.images?.[0] || '', description: listing.description, ownerId: listing.ownerId }));
  res.json(userLots);
});
const listingConditions = new Set(['New', 'New with Tags', 'Sealed', 'Like New', 'Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'For Parts or Repair', 'Graded', 'Ungraded', 'Authenticated', 'Restored']);
const prohibitedListingTerms = /\b(counterfeit|replica\s+as\s+authentic|stolen|gray[- ]?market|wholesale\s+lot|unlicensed\s+weapon|explosive)\b/i;
const alcoholListingTerms = /\b(alcohol|aged alcohol|beer|wine|champagne|whiskey|whisky|bourbon|scotch|rum|tequila|gin|vodka|brandy|cognac|liqueur|mead|cider)\b/i;
const isAlcoholListing = listing => alcoholListingTerms.test(`${listing?.title || ''} ${listing?.description || ''} ${listing?.category || ''} ${(listing?.tags || []).join(' ')}`);
function listingRiskFlags(ownerId, listing, previousPrice = null) {
  const flags = [];
  const text = `${listing.title || ''} ${listing.description || ''} ${(listing.tags || []).join(' ')}`;
  if (prohibitedListingTerms.test(text)) flags.push('restricted_or_misrepresented_item');
  const recentlyCreated = store.data.listings.filter(row => row.ownerId === ownerId && Date.now() - new Date(row.createdAt || 0).valueOf() < 60 * 60 * 1000).length;
  if (recentlyCreated >= 5) flags.push('rapid_listing_creation');
  if (previousPrice !== null && Math.max(Number(previousPrice) || 0, Number(listing.price) || 0) >= 50 && (Number(listing.price) || 0) / Math.max(1, Number(previousPrice) || 1) >= 3) flags.push('sudden_price_change');
  return flags;
}
app.post('/listing', required, (req, res) => {
  const { title, description, category, condition, tags = [], price, tradeOffer, images = [], videos = [], sellerCity, sellerZip, locationCoordinates, pickupRadiusMiles, fulfillment, shippingPackagingCost, listingMode = 'marketplace', auctionStartPrice, auctionDurationHours, confirmedAlcoholAge } = req.body;
  const validImages = Array.isArray(images) && images.length > 0 && images.length <= 5 && images.every(image => typeof image === 'string' && image.length <= 2_000_000 && (/^https?:\/\//i.test(image) || /^data:image\/(jpeg|png|webp);base64,/i.test(image)));
  const validVideos = Array.isArray(videos) && videos.length <= 1 && videos.every(video => typeof video === 'string' && video.length <= 6_000_000 && /^data:video\/(mp4|webm|quicktime);base64,/i.test(video));
  if (!title?.trim() || !description?.trim() || !category?.trim()) return res.status(400).json({ error: 'title, description, and category are required' });
  const itemCondition = typeof condition === 'string' ? condition.trim() : '';
  if (!listingConditions.has(itemCondition)) return res.status(400).json({ error: 'Choose a valid item condition.' });
  const publicCity = typeof sellerCity === 'string' ? sellerCity.trim() : '';
  const publicZip = typeof sellerZip === 'string' ? sellerZip.trim() : '';
  if (publicCity.length < 2 || publicCity.length > 80 || /^\d{1,6}\s+|\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|apartment|apt\.?|suite|unit)\b/i.test(publicCity)) return res.status(400).json({ error: 'Add a city and state/region only—do not post a street address.' });
  if (!/^\d{5}(?:-\d{4})?$/.test(publicZip)) return res.status(400).json({ error: 'Add a valid 5-digit US ZIP code.' });
  const pickupRadius = Number(pickupRadiusMiles);
  if (!Number.isFinite(pickupRadius) || pickupRadius < 0 || pickupRadius > 500) return res.status(400).json({ error: 'Pickup radius must be between 0 and 500 miles.' });
  const upsPackagingCost = Math.round(Math.max(0, Number(shippingPackagingCost) || 0) * 100) / 100;
  if (upsPackagingCost > 1000) return res.status(400).json({ error: 'UPS packaging cost must be $1,000 or less.' });
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
  const submittedTags = [...new Set([category.trim(), itemCondition, ...(Array.isArray(tags) ? tags : []).map(tag => typeof tag === 'string' ? tag.trim().replace(/^#/, '') : '').filter(Boolean)])];
  const validTags = submittedTags.length <= 8 && submittedTags.every(tag => tag.length <= 60);
  if (!validTags) return res.status(400).json({ error: 'Use up to 8 tags, each 60 characters or less.' });
  if (isAlcoholListing({ title, description, category, tags: submittedTags }) && confirmedAlcoholAge !== true) return res.status(400).json({ error: 'Confirm that you are at least 21 years old before listing alcohol.' });
  if (!validImages) return res.status(400).json({ error: 'Add 1–5 valid image links or uploads.' });
  if (!validVideos) return res.status(400).json({ error: 'Add at most one valid uploaded video.' });
  const publicLocation = `${publicCity} ${publicZip}`;
  const locationTag = `US City/Town: ${publicCity}`;
  const listing = { id: id(), ownerId: req.user.id, title: title.trim(), description: description.trim(), category: category.trim(), condition: itemCondition, tags: [...submittedTags, locationTag], location: publicLocation, sellerCity: publicCity, sellerZip: publicZip, locationCoordinates: coordinates, pickupRadiusMiles: pickupRadius, fulfillment, upsPackagingCost, listingMode, auctionStartPrice: listingMode === 'marketplace' ? null : startingBid, auctionEndAt: listingMode === 'marketplace' ? null : new Date(Date.now() + auctionHours * 3600000).toISOString(), auctionBids: 0, price: Number(price) || 0, tradeOffer: Boolean(tradeOffer), images, videos, alcoholAgeConfirmedAt: isAlcoholListing({ title, description, category, tags: submittedTags }) ? now() : null, status: 'active', likes: [], createdAt: now() };
  listing.riskFlags = listingRiskFlags(req.user.id, listing); if (listing.riskFlags.length) { listing.reviewStatus = 'flagged'; securityLog('listing_flagged', req, { userId: req.user.id, listingId: listing.id, flags: listing.riskFlags }); }
  store.data.listings.unshift(listing); activity('listing', req.user.id, { listingId: listing.id }); store.save(); res.status(201).json(listing);
});
app.get('/listing/:id', (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); listing.viewCount = Number(listing.viewCount || 0) + 1; store.save(); res.json({ ...listing, owner: publicUser(store.data.users.find(u => u.id === listing.ownerId)), likeCount: listing.likes.length, statistics: listingStatistics(listing) }); });
app.get('/listing/:id/statistics', required, (req, res) => { const listing = store.data.listings.find(row => row.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Only the listing owner can view these statistics.' }); res.json(listingStatistics(listing, true)); });
const promotionCheckout = (listing, user, body) => {
  if (!listing) throw new Error('Listing not found');
  if (listing.ownerId !== user.id) throw new Error('Only the listing owner can promote this listing.');
  if (listing.status !== 'active') throw new Error('Restore this listing before promoting it.');
  const dailyBudget = Math.round(Number(body.dailyBudget) * 100) / 100;
  const durationDays = Math.round(Number(body.durationDays));
  if (!Number.isFinite(dailyBudget) || dailyBudget < 1 || dailyBudget > 500) throw new Error('Choose a daily promotion budget between $1 and $500.');
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 30) throw new Error('Choose a promotion duration between 1 and 30 days.');
  return { dailyBudget, durationDays, totalBudget: Math.round(dailyBudget * durationDays * 100) / 100 };
};
app.post('/listing/:id/promotion', required, (req, res) => res.status(410).json({ error: 'Promotions require a completed PayPal checkout.' }));
app.post('/listing/:id/promotion/paypal/order', required, async (req, res) => {
  const listing = store.data.listings.find(row => row.id === req.params.id);
  try {
    const campaign = promotionCheckout(listing, req.user, req.body);
    const promotion = { id: id(), listingId: listing.id, userId: req.user.id, ...campaign, currency: 'USD', status: 'creating', createdAt: now(), paypal: { environment: paypalEnvironment(), status: 'CREATING' } };
    store.data.promotions.unshift(promotion);
    const order = await paypalRequest('POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: promotion.id, custom_id: promotion.id, description: `Listing promotion · ${String(listing.title || 'listing').slice(0, 90)} · ${campaign.durationDays} days`, amount: { currency_code: 'USD', value: campaign.totalBudget.toFixed(2) } }] }, `listing-promotion-${promotion.id}`);
    promotion.status = 'awaiting_paypal_approval';
    promotion.paypal = { environment: paypalEnvironment(), status: order.status || 'CREATED', orderId: order.id, amount: campaign.totalBudget };
    await store.save();
    res.status(201).json({ promotionId: promotion.id, orderId: order.id, amount: campaign.totalBudget, environment: paypalEnvironment() });
  } catch (error) { res.status(400).json({ error: error.message, code: error.code || '', debugId: error.debugId || '' }); }
});
app.post('/listing/:id/promotion/:promotionId/paypal/capture', required, async (req, res) => {
  const listing = store.data.listings.find(row => row.id === req.params.id);
  const promotion = store.data.promotions.find(row => row.id === req.params.promotionId && row.listingId === req.params.id && row.userId === req.user.id);
  if (!listing || !promotion?.paypal?.orderId) return res.status(404).json({ error: 'Promotion checkout not found.' });
  if (req.body.orderId && req.body.orderId !== promotion.paypal.orderId) return res.status(400).json({ error: 'The approved PayPal order does not match this promotion checkout.' });
  try {
    if (promotion.paypal.status !== 'COMPLETED') {
      const capture = await paypalRequest('POST', `/v2/checkout/orders/${encodeURIComponent(promotion.paypal.orderId)}/capture`, {}, `listing-promotion-capture-${promotion.id}`);
      if (capture.status !== 'COMPLETED') throw new Error('PayPal did not complete the promotion payment.');
      const startedAt = now(); const endsAt = new Date(Date.now() + promotion.durationDays * 86400000).toISOString();
      promotion.status = 'active'; promotion.startedAt = startedAt; promotion.endsAt = endsAt;
      promotion.paypal = { ...promotion.paypal, status: 'COMPLETED', captureId: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || '', capturedAt: startedAt };
      listing.promotion = { status: 'active', promotionId: promotion.id, dailyBudget: promotion.dailyBudget, durationDays: promotion.durationDays, totalBudget: promotion.totalBudget, startedAt, endsAt, billingStatus: 'paid', capturedAt: startedAt };
      activity('listing_promotion_started', req.user.id, { listingId: listing.id, promotionId: promotion.id, dailyBudget: promotion.dailyBudget, durationDays: promotion.durationDays });
      await store.save();
    }
    res.json({ promotion: listing.promotion, statistics: listingStatistics(listing) });
  } catch (error) { promotion.paypal = { ...promotion.paypal, lastError: { code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '', at: now() } }; store.save(); res.status(400).json({ error: error.message, code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '' }); }
});
app.post('/listing/:id/promotion/:promotionId/paypal/cancel', required, (req, res) => {
  const promotion = store.data.promotions.find(row => row.id === req.params.promotionId && row.listingId === req.params.id && row.userId === req.user.id);
  if (!promotion) return res.status(404).json({ error: 'Promotion checkout not found.' });
  if (promotion.status !== 'active') { promotion.status = 'cancelled'; promotion.paypal = { ...promotion.paypal, status: 'CANCELLED', cancelledAt: now() }; store.save(); }
  res.status(204).end();
});
app.delete('/listing/:id/promotion', required, (req, res) => { const listing = store.data.listings.find(row => row.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Only the listing owner can manage this promotion.' }); if (listing.promotion) listing.promotion = { ...listing.promotion, status: 'paused', pausedAt: now() }; store.save(); res.status(204).end(); });
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
  if (req.body.upsPackagingCost !== undefined) { const packaging = Math.round(Math.max(0, Number(req.body.upsPackagingCost) || 0) * 100) / 100; if (packaging > 1000) return res.status(400).json({ error: 'UPS packaging cost must be $1,000 or less.' }); listing.upsPackagingCost = packaging; }
  if (req.body.status !== undefined && !['active', 'archived'].includes(req.body.status)) return res.status(400).json({ error: 'Listings can only be set to active or archived here.' });
  if (req.body.condition !== undefined && !listingConditions.has(String(req.body.condition))) return res.status(400).json({ error: 'Choose a valid item condition.' });
  const priorPrice = listing.price;
  ['title', 'description', 'category', 'condition', 'tags', 'price', 'tradeOffer', 'images', 'videos', 'status'].forEach(key => {
    if (req.body[key] !== undefined) listing[key] = req.body[key];
  });
  const manualTags = [...new Set([listing.category, ...(Array.isArray(listing.tags) ? listing.tags : [])].map(tag => typeof tag === 'string' ? tag.trim().replace(/^#/, '') : '').filter(tag => tag && !tag.startsWith('US City/Town: ')))];
  const locationTag = usCityTownTag(listing.location);
  listing.tags = [...manualTags, ...(locationTag ? [locationTag] : [])];
  const flags = listingRiskFlags(req.user.id, listing, priorPrice); if (flags.length) { listing.riskFlags = [...new Set([...(listing.riskFlags || []), ...flags])]; listing.reviewStatus = 'flagged'; securityLog('listing_flagged', req, { userId: req.user.id, listingId: listing.id, flags }); }
  store.save(); res.json(listing);
});
app.delete('/listing/:id', required, (req, res) => { const i = store.data.listings.findIndex(l => l.id === req.params.id && l.ownerId === req.user.id); if (i < 0) return res.status(404).json({ error: 'Listing not found' }); store.data.listings.splice(i, 1); store.save(); res.status(204).end(); });
app.post('/listing/:id/like', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); const i = listing.likes.indexOf(req.user.id); if (i < 0) { listing.likes.push(req.user.id); if (listing.ownerId !== req.user.id) notify(listing.ownerId, 'like', `${req.user.username} liked “${listing.title}”`, `/listing/${listing.id}`); activity('like', req.user.id, { listingId: listing.id }); } else listing.likes.splice(i, 1); store.save(); res.json({ liked: i < 0, likeCount: listing.likes.length }); });
app.post('/listing/:id/vote', required, (req, res) => { const listing = store.data.listings.find(row => row.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); const direction = Number(req.body.direction); if (![-1, 1].includes(direction)) return res.status(400).json({ error: 'Vote must be an upvote or downvote.' }); if (!listing.votes || typeof listing.votes !== 'object') listing.votes = {}; if (listing.votes[req.user.id] === direction) delete listing.votes[req.user.id]; else listing.votes[req.user.id] = direction; const vote = Number(listing.votes[req.user.id] || 0); const score = Object.values(listing.votes).reduce((total, value) => total + Number(value || 0), 0); if (vote && listing.ownerId !== req.user.id) notify(listing.ownerId, 'vote', `${req.user.username} ${vote === 1 ? 'upvoted' : 'downvoted'} “${listing.title}”`, `/listing/${listing.id}`); store.save(); res.json({ vote, score }); });
app.post('/listing/:id/favorite', required, (req, res) => { const listing = store.data.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'Listing not found' }); if (!Array.isArray(listing.favorites)) listing.favorites = []; const i = listing.favorites.indexOf(req.user.id); if (i < 0) listing.favorites.push(req.user.id); else listing.favorites.splice(i, 1); store.save(); res.json({ favorited: i < 0, favoriteCount: listing.favorites.length }); });

app.post('/comment', required, (req, res) => { const { listingId, body, parentId, mediaUrl, audioUrl } = req.body; const listing = store.data.listings.find(l => l.id === listingId); const parent = parentId ? store.data.comments.find(c => c.id === parentId) : null; const text = typeof body === 'string' ? body.trim() : ''; const image = typeof mediaUrl === 'string' ? mediaUrl.trim() : ''; const audio = typeof audioUrl === 'string' ? audioUrl.trim() : ''; if (!listing || (!text && !audio)) return res.status(400).json({ error: 'Write a comment or attach a voice note before posting.' }); if (text.length > 1000) return res.status(400).json({ error: 'Comments can be up to 1,000 characters.' }); if (image && (!/^https:\/\/[\w.-]+\//i.test(image) || image.length > 2000)) return res.status(400).json({ error: 'Use a valid HTTPS image link under 2,000 characters.' }); if (audio && (!/^data:audio\/(webm|ogg|mp4|mpeg)(?:;[a-z0-9=._-]+)*;base64,[a-z0-9+/=]+$/i.test(audio) || audio.length > 5500000)) return res.status(400).json({ error: 'Use a voice recording under 4 MB.' }); if (parentId && (!parent || parent.listingId !== listingId)) return res.status(400).json({ error: 'Reply must belong to the same listing' }); const comment = { id: id(), listingId, userId: req.user.id, body: text, mediaUrl: image || '', audioUrl: audio || '', parentId: parentId || null, votes: {}, createdAt: now() }; store.data.comments.push(comment); const owner = parent ? parent.userId : listing.ownerId; if (owner && owner !== req.user.id) notify(owner, 'comment', `${req.user.username} commented on “${listing.title}”`, `/listing/${listing.id}`); activity('comment', req.user.id, { listingId, commentId: comment.id }); store.save(); res.status(201).json({ ...comment, score: 0, myVote: 0, user: publicUser(req.user) }); });
function commentView(comment, userId) { const votes = comment.votes && typeof comment.votes === 'object' ? comment.votes : {}; return { ...comment, votes: undefined, score: Object.values(votes).reduce((total, vote) => total + Number(vote || 0), 0), myVote: Number(votes[userId] || 0), user: publicUser(store.data.users.find(user => user.id === comment.userId)) }; }
app.get('/comments/:listingId', (req, res) => { const user = currentUser(req); res.json(store.data.comments.filter(c => c.listingId === req.params.listingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(comment => commentView(comment, user?.id))); });
app.post('/comment/:id/vote', required, (req, res) => { const comment = store.data.comments.find(row => row.id === req.params.id); if (!comment) return res.status(404).json({ error: 'Comment not found' }); const direction = Number(req.body.direction); if (![1, -1].includes(direction)) return res.status(400).json({ error: 'Vote must be an upvote or downvote.' }); if (!comment.votes || typeof comment.votes !== 'object') comment.votes = {}; comment.votes[req.user.id] === direction ? delete comment.votes[req.user.id] : comment.votes[req.user.id] = direction; store.save(); const view = commentView(comment, req.user.id); res.json({ score: view.score, myVote: view.myVote }); });
app.delete('/comment/:id', required, (req, res) => { const index = store.data.comments.findIndex(row => row.id === req.params.id && row.userId === req.user.id); if (index < 0) return res.status(404).json({ error: 'Comment not found.' }); const comment = store.data.comments[index]; store.data.comments.forEach(row => { if (row.parentId === comment.id) row.parentId = comment.parentId || null; }); store.data.comments.splice(index, 1); store.save(); res.status(204).end(); });

const activeTradeListings = (ids, ownerId) => [...new Set(Array.isArray(ids) ? ids.filter(value => typeof value === 'string') : [])].map(listingId => store.data.listings.find(listing => listing.id === listingId && listing.ownerId === ownerId && listing.status === 'active')).filter(Boolean);
const tradeSenderIds = trade => Array.isArray(trade.senderListingIds) ? trade.senderListingIds : [];
const tradeReceiverIds = trade => Array.isArray(trade.receiverListingIds) ? trade.receiverListingIds : [trade.listingId].filter(Boolean);
const tradeFeeRate = user => marketplaceFeeRate(user);
const tradeFeeSnapshot = ({ sender, receiver, senderListings, receiverListings, senderCash, receiverCash }) => {
  const senderRate = tradeFeeRate(sender); const receiverRate = tradeFeeRate(receiver);
  const senderValueReceived = receiverListings.reduce((total, listing) => total + Number(listing.price || 0), 0) + receiverCash;
  const receiverValueReceived = senderListings.reduce((total, listing) => total + Number(listing.price || 0), 0) + senderCash;
  return { sender: { rate: senderRate, value: senderValueReceived, amount: senderValueReceived * senderRate }, receiver: { rate: receiverRate, value: receiverValueReceived, amount: receiverValueReceived * receiverRate } };
};
const tradeDeliveryPlan = input => {
  const address = typeof input.shippingAddress === 'string' ? input.shippingAddress.trim() : '';
  const provider = typeof input.deliveryProvider === 'string' ? input.deliveryProvider.trim() : '';
  const paymentMethod = typeof input.paymentMethod === 'string' ? input.paymentMethod.trim() : '';
  const deliveryMiles = Math.min(20000, Math.max(0, Number(input.deliveryMiles) || 0));
  const packagingCost = Math.min(10000, Math.max(0, Number(input.packagingCost) || 0));
  if (!address || address.length > 500) throw new Error('Add a delivery address under 500 characters.');
  if (!deliveryProviders[provider]) throw new Error('Choose one of the supported delivery options.');
  if (!paymentMethods.has(paymentMethod)) throw new Error('Choose one of the supported payment methods.');
  return { shippingAddress: address, deliveryProvider: provider, deliveryMiles, packagingCost, courierPay: calculatedDeliveryFee(deliveryMiles, packagingCost), paymentMethod };
};
app.post('/trade', required, (req, res) => {
  const { receiverId, conversationId, listingId, senderListingIds, receiverListingIds, offerDetails, senderCashAmount, receiverCashAmount, cashAmount = 0, cashFrom = '' } = req.body;
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
  if (senderCash > 0 && receiverCash > 0) return res.status(400).json({ error: 'Cash can only be added by one side of a trade.' });
  let senderDelivery;
  try { senderDelivery = tradeDeliveryPlan(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
  const note = typeof offerDetails === 'string' ? offerDetails.trim() : '';
  const receiver = store.data.users.find(user => user.id === receiverId);
  const fees = tradeFeeSnapshot({ sender: req.user, receiver, senderListings: offeredListings, receiverListings: requestedListings, senderCash, receiverCash });
  const paymentFees = { sender: senderCash > 0 ? paypalProcessingFee(senderCash) : 0, receiver: receiverCash > 0 ? paypalProcessingFee(receiverCash) : 0 };
  const trade = { id: id(), senderId: req.user.id, receiverId, listingId: requestedIds[0], senderListingIds: offeredIds, receiverListingIds: requestedIds, senderCashAmount: senderCash, receiverCashAmount: receiverCash, fees, paymentFees, offerDetails: note.slice(0, 1000), deliveryPlans: { sender: senderDelivery, receiver: null }, acceptances: { sender: false, receiver: false }, status: 'pending', messages: [], createdAt: now() };
  if (conversationId) {
    const conversation = store.data.conversations.find(row => row.id === conversationId && row.participantIds.length === 2 && row.participantIds.includes(req.user.id) && row.participantIds.includes(receiverId));
    if (!conversation) return res.status(400).json({ error: 'This trade request is not connected to a valid conversation.' });
    conversation.messages.push({ id: id(), type: 'trade_request', tradeId: trade.id, senderId: req.user.id, body: note || `${offeredIds.length} item${offeredIds.length === 1 ? '' : 's'} offered for ${requestedIds.length} item${requestedIds.length === 1 ? '' : 's'}.`, createdAt: now() });
    conversation.updatedAt = now(); trade.conversationId = conversation.id;
  }
  store.data.trades.unshift(trade); notify(receiverId, 'trade', `${req.user.username} proposed a ${offeredIds.length}-for-${requestedIds.length} trade`, `/trade/${trade.id}`); activity('trade', req.user.id, { listingId: requestedIds[0], tradeId: trade.id }); store.save(); res.status(201).json(trade);
});
function tradeView(trade, userId) {
  const listing = store.data.listings.find(row => row.id === trade.listingId);
  const senderListings = tradeSenderIds(trade).map(listingId => store.data.listings.find(row => row.id === listingId)).filter(Boolean);
  const receiverListings = tradeReceiverIds(trade).map(listingId => store.data.listings.find(row => row.id === listingId)).filter(Boolean);
  const otherUser = store.data.users.find(row => row.id === (trade.senderId === userId ? trade.receiverId : trade.senderId));
  const deliveries = (trade.deliveryIds || []).map(deliveryId => store.data.deliveries.find(row => row.id === deliveryId)).filter(Boolean);
  return { ...trade, listing, senderListings, receiverListings, deliveries, otherUser: publicUser(otherUser) };
}
function tradeCashDetails(trade) {
  const senderCash = Number(trade.senderCashAmount || 0); const receiverCash = Number(trade.receiverCashAmount || 0);
  if (senderCash > 0) return { role: 'sender', payerId: trade.senderId, recipientId: trade.receiverId, cash: senderCash, processingFee: Number(trade.paymentFees?.sender || 0) };
  if (receiverCash > 0) return { role: 'receiver', payerId: trade.receiverId, recipientId: trade.senderId, cash: receiverCash, processingFee: Number(trade.paymentFees?.receiver || 0) };
  return null;
}
function activateTradeDeliveries(trade, actorId) {
  if (trade.deliveryIds?.length) return;
  const createTradeDelivery = (listingId, buyerId, sellerId, plan) => {
    const listing = store.data.listings.find(row => row.id === listingId);
    const delivery = { id: id(), tradeId: trade.id, listingId, buyerId, sellerId, shippingAddress: plan.shippingAddress, itemPrice: Number(listing?.price) || 0, deliveryProvider: plan.deliveryProvider, deliveryMiles: plan.deliveryMiles, packagingCost: plan.packagingCost, courierPay: plan.courierPay, paymentMethod: plan.paymentMethod, status: 'awaiting_seller_dispatch', courier: '', trackingNumber: '', messages: [], history: [], createdAt: now(), updatedAt: now() };
    recordDeliveryUpdate(delivery, buyerId, delivery.status, `Trade delivery created with ${plan.deliveryProvider} · ${plan.paymentMethod}; delivery estimate $${plan.courierPay.toFixed(2)}.`);
    store.data.deliveries.unshift(delivery); if (listing) listing.status = 'pending_delivery'; notify(sellerId, 'delivery', `Trade delivery is ready for “${listing?.title || 'collector item'}”`, `/delivery/${delivery.id}`); return delivery.id;
  };
  trade.deliveryIds = [...tradeSenderIds(trade).map(listingId => createTradeDelivery(listingId, trade.receiverId, trade.senderId, trade.deliveryPlans.receiver)), ...tradeReceiverIds(trade).map(listingId => createTradeDelivery(listingId, trade.senderId, trade.receiverId, trade.deliveryPlans.sender))];
  trade.status = 'delivery_in_progress'; notify(trade.senderId === actorId ? trade.receiverId : trade.senderId, 'trade', 'Trade payment is complete — delivery threads are now open for both sides.', `/trade/${trade.id}`);
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
    if (req.body.deliveryPlan) {
      try { trade.deliveryPlans = trade.deliveryPlans || {}; trade.deliveryPlans[role] = tradeDeliveryPlan(req.body.deliveryPlan); } catch (error) { return res.status(400).json({ error: error.message }); }
    }
    if (!trade.deliveryPlans?.[role]) return res.status(400).json({ error: 'Add your delivery and payment details before locking in this trade.' });
    trade.acceptances[role] = true;
    const otherRole = role === 'sender' ? 'receiver' : 'sender';
    if (trade.acceptances.sender && trade.acceptances.receiver) {
      const cash = tradeCashDetails(trade);
      if (cash) { trade.status = 'awaiting_cash_payment'; trade.cashPayment = trade.cashPayment || { payerId: cash.payerId, recipientId: cash.recipientId, cash: cash.cash, processingFee: cash.processingFee, total: Math.round((cash.cash + cash.processingFee) * 100) / 100, status: 'awaiting_payment' }; notify(cash.payerId, 'trade', `Your trade needs a PayPal payment of $${trade.cashPayment.total.toFixed(2)} before delivery can begin.`, `/trade/${trade.id}`); }
      else activateTradeDeliveries(trade, req.user.id);
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
function recordDeliveryUpdate(delivery, userId, status, note = '') {
  if (!Array.isArray(delivery.history)) delivery.history = [];
  const previousHash = delivery.history.at(-1)?.hash || '';
  const record = { id: id(), userId, status, note: String(note).slice(0, 1000), createdAt: now(), previousHash };
  record.hash = crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex');
  delivery.history.push(record); delivery.updatedAt = now();
}
function preparePurchase(user, body) {
  const { listingId, shippingAddress, recipientAddress, deliveryProvider, deliveryMiles, paymentMethod, confirmedAlcoholAge } = body;
  const listing = store.data.listings.find(row => row.id === listingId && row.status === 'active');
  if (!listing) throw new Error('Active listing not found');
  if (listing.ownerId === user.id) throw new Error('You cannot purchase your own listing');
  const alcoholRestricted = isAlcoholListing(listing);
  if (alcoholRestricted && confirmedAlcoholAge !== true) throw new Error('Confirm that you are at least 21 years old before purchasing alcohol.');
  const destination = recipientAddress ? shippoAddress(recipientAddress, 'delivery') : null;
  const address = typeof shippingAddress === 'string' ? shippingAddress.trim() : destination ? [destination.name, destination.street1, destination.street2, `${destination.city}, ${destination.state} ${destination.zip}`].filter(Boolean).join('\n') : '';
  const provider = typeof deliveryProvider === 'string' ? deliveryProvider.trim() : '';
  if (!provider || !deliveryProviders[provider]) throw new Error('Choose one of the supported delivery options.');
  if (!address || address.length > 500) throw new Error(address ? 'Keep the delivery address under 500 characters.' : 'A delivery address is required');
  if (provider === 'UPS Priority' && !destination) throw new Error('Add a complete delivery address for UPS Priority.');
  if (listing.fulfillment === 'pickup' && provider !== 'Local pickup') throw new Error('This listing is available for local pickup only.');
  const method = typeof paymentMethod === 'string' ? paymentMethod.trim() : '';
  if (!paymentMethods.has(method)) throw new Error('Choose one of the supported payment methods.');
  const miles = Math.min(20000, Math.max(0, Number(deliveryMiles) || 0));
  const packing = Math.min(1000, Math.max(0, Number(listing.upsPackagingCost) || 0));
  const courierPay = calculatedDeliveryFee(miles, packing);
  const itemPrice = Number(listing.price) || 0; const seller = store.data.users.find(candidate => candidate.id === listing.ownerId);
  const fees = { buyer: { rate: tradeFeeRate(user), amount: itemPrice * tradeFeeRate(user) }, seller: { rate: tradeFeeRate(seller), amount: itemPrice * tradeFeeRate(seller) } };
  const buyerSubtotal = itemPrice + fees.buyer.amount + courierPay;
  const minimumBuyerFee = itemPrice < 10 ? 1.5 : 0;
  const paypalFee = paypalProcessingFee(buyerSubtotal + minimumBuyerFee);
  return { listing, address, destination, provider, method, miles, packing, courierPay, itemPrice, fees, buyerSubtotal, minimumBuyerFee, paypalFee, alcoholRestricted, total: Math.round((buyerSubtotal + minimumBuyerFee + paypalFee) * 100) / 100 };
}
function purchaseDelivery(purchase, buyer, status) {
  return { id: id(), listingId: purchase.listing.id, buyerId: buyer.id, sellerId: purchase.listing.ownerId, shippingAddress: purchase.address, recipientAddress: purchase.destination, itemPrice: purchase.itemPrice, fees: purchase.fees, deliveryProvider: purchase.provider, deliveryMiles: purchase.miles, packagingCost: purchase.packing, courierPay: purchase.courierPay, deliveryFee: purchase.courierPay, paymentMethod: purchase.method, paypalFee: purchase.paypalFee, buyerSubtotal: purchase.buyerSubtotal, minimumBuyerFee: purchase.minimumBuyerFee, alcoholAgeConfirmedAt: purchase.alcoholRestricted ? now() : null, status, courier: '', trackingNumber: '', messages: [], history: [], createdAt: now(), updatedAt: now() };
}
app.post('/purchase', required, (req, res) => {
  res.status(410).json({ error: 'Direct checkout is disabled. Create a PayPal order first.' });
});
app.get('/paypal/config', (req, res) => res.json({ clientId: process.env.PAYPAL_CLIENT_ID || '', environment: paypalEnvironment() }));
function addVipCuratorMonth(user) {
  const currentExpiry = new Date(user.curatorMembershipExpiresAt || 0).valueOf();
  const startsAt = Math.max(Date.now(), Number.isFinite(currentExpiry) ? currentExpiry : 0);
  user.curator = true;
  user.membership = 'curator';
  user.curatorMembershipExpiresAt = new Date(startsAt + vipCuratorDays * 24 * 60 * 60 * 1000).toISOString();
  return user.curatorMembershipExpiresAt;
}
app.get('/membership/vip-curator', required, (req, res) => res.json({
  price: vipCuratorPrice,
  currency: 'USD',
  durationDays: vipCuratorDays,
  active: hasActiveCuratorMembership(req.user),
  developerPass: hasDeveloperPass(req.user),
  expiresAt: req.user.curatorMembershipExpiresAt || null
}));
app.post('/membership/vip-curator/paypal/order', required, async (req, res) => {
  if (hasDeveloperPass(req.user)) return res.status(400).json({ error: 'Your Developer Pass already includes the marketplace fee benefit.' });
  try {
    const membership = { id: id(), userId: req.user.id, type: 'vip_curator', amount: vipCuratorPrice, currency: 'USD', status: 'creating', createdAt: now(), paypal: { environment: paypalEnvironment(), status: 'CREATING' } };
    store.data.memberships.unshift(membership);
    const order = await paypalRequest('POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: membership.id, custom_id: membership.id, description: `VIP Curator membership · ${vipCuratorDays} days`, amount: { currency_code: 'USD', value: vipCuratorPrice.toFixed(2) } }] }, `vip-curator-${membership.id}`);
    membership.status = 'awaiting_paypal_approval';
    membership.paypal = { environment: paypalEnvironment(), status: order.status || 'CREATED', orderId: order.id, amount: vipCuratorPrice };
    await store.save();
    res.status(201).json({ membershipId: membership.id, orderId: order.id, amount: vipCuratorPrice, environment: paypalEnvironment() });
  } catch (error) {
    res.status(400).json({ error: error.message, code: error.code || '', debugId: error.debugId || '' });
  }
});
app.post('/membership/vip-curator/:membershipId/paypal/capture', required, async (req, res) => {
  const membership = store.data.memberships.find(row => row.id === req.params.membershipId && row.userId === req.user.id && row.type === 'vip_curator');
  if (!membership?.paypal?.orderId) return res.status(404).json({ error: 'VIP Curator checkout not found.' });
  if (req.body.orderId && req.body.orderId !== membership.paypal.orderId) return res.status(400).json({ error: 'The approved PayPal order does not match this membership checkout.' });
  try {
    if (membership.paypal.status !== 'COMPLETED') {
      const capture = await paypalRequest('POST', `/v2/checkout/orders/${encodeURIComponent(membership.paypal.orderId)}/capture`, {}, `vip-curator-capture-${membership.id}`);
      if (capture.status !== 'COMPLETED') throw new Error('PayPal did not complete the VIP Curator payment.');
      membership.status = 'active';
      membership.paypal = { ...membership.paypal, status: 'COMPLETED', captureId: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || '', capturedAt: now() };
      membership.expiresAt = addVipCuratorMonth(req.user);
      activity('vip_curator', req.user.id, { membershipId: membership.id });
      await store.save();
    }
    res.json({ membership: { id: membership.id, status: membership.status, expiresAt: membership.expiresAt }, user: publicUser(req.user) });
  } catch (error) {
    membership.paypal = { ...membership.paypal, lastError: { code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '', at: now() } };
    store.save();
    res.status(400).json({ error: error.message, code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '' });
  }
});
app.post('/membership/vip-curator/:membershipId/paypal/cancel', required, (req, res) => {
  const membership = store.data.memberships.find(row => row.id === req.params.membershipId && row.userId === req.user.id && row.type === 'vip_curator');
  if (!membership) return res.status(404).json({ error: 'VIP Curator checkout not found.' });
  if (membership.status !== 'active') { membership.status = 'cancelled'; membership.paypal = { ...membership.paypal, status: 'CANCELLED', cancelledAt: now() }; store.save(); }
  res.status(204).end();
});
app.post('/paypal/orders', required, async (req, res) => {
  let purchase; let delivery;
  if (req.user.paymentRestrictedAt) return res.status(423).json({ error: 'Payments are temporarily restricted after repeated failed attempts. Contact support if this was unexpected.' });
  try {
    purchase = preparePurchase(req.user, req.body);
    if (purchase.method !== 'PayPal') throw new Error('PayPal is the only checkout method currently available.');
    delivery = purchaseDelivery(purchase, req.user, 'awaiting_paypal_approval');
    delivery.paypal = { environment: paypalEnvironment(), status: 'CREATING', amount: purchase.total };
    purchase.listing.status = 'pending_payment'; store.data.deliveries.unshift(delivery);
    // Smart Buttons handles the payer's payment source in its secure in-page
    // checkout. Supplying a payment_source here turns this into redirect flow.
    const order = await paypalRequest('POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: delivery.id, custom_id: delivery.id, description: purchase.listing.title.slice(0, 127), amount: { currency_code: 'USD', value: purchase.total.toFixed(2) } }] }, delivery.id);
    const approvalUrl = order.links?.find(link => link.rel === 'payer-action' || link.rel === 'approve')?.href;
    delivery.paypal = { environment: paypalEnvironment(), status: order.status || 'CREATED', orderId: order.id, amount: purchase.total };
    recordDeliveryUpdate(delivery, req.user.id, delivery.status, `${paypalLabel()} checkout created; awaiting buyer approval.`);
    store.save(); res.status(201).json({ approvalUrl, deliveryId: delivery.id, orderId: order.id, environment: paypalEnvironment() });
  } catch (error) {
    if (delivery) { store.data.deliveries = store.data.deliveries.filter(row => row.id !== delivery.id); if (purchase?.listing?.status === 'pending_payment') purchase.listing.status = 'active'; store.save(); }
    recordPaymentFailure(req.user, req, error.code || error.message); store.save();
    res.status(400).json({ error: error.message });
  }
});
async function capturePayPalDelivery(delivery) {
  if (delivery.paypal?.status === 'COMPLETED') return delivery;
  const capture = await paypalRequest('POST', `/v2/checkout/orders/${encodeURIComponent(delivery.paypal.orderId)}/capture`, {}, `capture-${delivery.id}`);
  if (capture.status !== 'COMPLETED') throw new Error(`${paypalLabel()} did not complete the payment.`);
  delivery.paypal = { ...delivery.paypal, status: 'COMPLETED', captureId: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || '' };
  delivery.status = 'awaiting_seller_dispatch'; const listing = store.data.listings.find(row => row.id === delivery.listingId); if (listing) listing.status = 'pending_delivery';
  recordDeliveryUpdate(delivery, delivery.buyerId, delivery.status, `${paypalLabel()} payment captured. The seller can now prepare dispatch.`);
  notify(delivery.sellerId, 'delivery', `${paypalLabel()} payment was approved; your item is ready to dispatch.`, `/delivery/${delivery.id}`); activity('purchase', delivery.buyerId, { listingId: delivery.listingId, deliveryId: delivery.id }); await store.save();
  return delivery;
}
function cancelPayPalDelivery(delivery) {
  if (!delivery || delivery.status !== 'awaiting_paypal_approval') return;
  delivery.status = 'payment_cancelled'; delivery.paypal = { ...delivery.paypal, status: 'CANCELLED' }; const listing = store.data.listings.find(row => row.id === delivery.listingId); if (listing) listing.status = 'active'; recordDeliveryUpdate(delivery, delivery.buyerId, delivery.status, `Buyer cancelled ${paypalLabel()} checkout.`); store.save();
}
app.post('/paypal/orders/:deliveryId/capture', required, async (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.deliveryId && row.buyerId === req.user.id);
  if (!delivery?.paypal?.orderId) return res.status(404).json({ error: 'PayPal checkout not found.' });
  if (req.body.orderId && req.body.orderId !== delivery.paypal.orderId) return res.status(400).json({ error: 'The approved PayPal order does not match this checkout.' });
  try { res.json(deliveryView(await capturePayPalDelivery(delivery), req.user.id)); } catch (error) { delivery.paypal = { ...delivery.paypal, lastError: { code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '', at: now() } }; store.save(); res.status(400).json({ error: error.message, code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '' }); }
});
app.post('/paypal/orders/:deliveryId/cancel', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.deliveryId && row.buyerId === req.user.id);
  if (!delivery) return res.status(404).json({ error: 'PayPal checkout not found.' });
  cancelPayPalDelivery(delivery); res.status(204).end();
});
app.post('/trade/:id/paypal/order', required, async (req, res) => {
  const trade = store.data.trades.find(row => row.id === req.params.id && (row.senderId === req.user.id || row.receiverId === req.user.id)); const cash = trade && tradeCashDetails(trade);
  if (!trade || !cash || cash.payerId !== req.user.id || trade.status !== 'awaiting_cash_payment') return res.status(400).json({ error: 'This trade is not awaiting a cash payment from your account.' });
  if (trade.cashPayment?.status === 'COMPLETED') return res.status(400).json({ error: 'This trade payment is already complete.' });
  try {
    const total = Math.round((cash.cash + cash.processingFee) * 100) / 100;
    // PayPal may invoke createOrder more than once while rendering Smart Buttons.
    // Reuse an approval-ready order, but never reuse one the buyer cancelled.
    if (trade.cashPayment?.orderId && ['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'APPROVED'].includes(trade.cashPayment.status)) {
      return res.json({ orderId: trade.cashPayment.orderId, tradeId: trade.id, total: trade.cashPayment.total, environment: trade.cashPayment.environment });
    }
    const attempt = Number(trade.cashPayment?.attempt || 0) + 1;
    const order = await paypalRequest('POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: `trade-${trade.id}`, custom_id: trade.id, description: `Trade cash contribution · ${trade.id.slice(0, 8)}`, amount: { currency_code: 'USD', value: total.toFixed(2) } }] }, `trade-${trade.id}-${attempt}`);
    trade.cashPayment = { payerId: cash.payerId, recipientId: cash.recipientId, cash: cash.cash, processingFee: cash.processingFee, total, environment: paypalEnvironment(), status: order.status || 'CREATED', orderId: order.id, attempt, createdAt: now() };
    store.save(); res.status(201).json({ orderId: order.id, tradeId: trade.id, total, environment: paypalEnvironment() });
  } catch (error) { res.status(400).json({ error: error.message, code: error.code || '', debugId: error.debugId || '' }); }
});
app.post('/trade/:id/paypal/capture', required, async (req, res) => {
  const trade = store.data.trades.find(row => row.id === req.params.id && (row.senderId === req.user.id || row.receiverId === req.user.id)); const cash = trade && tradeCashDetails(trade);
  if (!trade || !cash || cash.payerId !== req.user.id || !trade.cashPayment?.orderId) return res.status(404).json({ error: 'Trade payment not found.' });
  if (req.body.orderId && req.body.orderId !== trade.cashPayment.orderId) return res.status(400).json({ error: 'The approved PayPal order does not match this trade.' });
  try {
    if (trade.cashPayment.status !== 'COMPLETED') { const capture = await paypalRequest('POST', `/v2/checkout/orders/${encodeURIComponent(trade.cashPayment.orderId)}/capture`, {}, `trade-capture-${trade.id}`); if (capture.status !== 'COMPLETED') throw new Error('PayPal did not complete the trade payment.'); trade.cashPayment = { ...trade.cashPayment, status: 'COMPLETED', captureId: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || '', capturedAt: now() }; activateTradeDeliveries(trade, req.user.id); }
    store.save(); res.json(tradeView(trade, req.user.id));
  } catch (error) { trade.cashPayment = { ...trade.cashPayment, lastError: { code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '', at: now() } }; store.save(); res.status(400).json({ error: error.message, code: error.code || 'CAPTURE_FAILED', debugId: error.debugId || '' }); }
});
app.post('/trade/:id/paypal/cancel', required, (req, res) => {
  const trade = store.data.trades.find(row => row.id === req.params.id); const cash = trade && tradeCashDetails(trade);
  if (!trade || !cash || cash.payerId !== req.user.id || trade.status !== 'awaiting_cash_payment') return res.status(404).json({ error: 'Trade payment not found.' });
  // Keep the audit information but clear the active order so the next attempt
  // receives a fresh PayPal order rather than an already-cancelled approval.
  trade.cashPayment = { ...trade.cashPayment, status: 'CANCELLED', cancelledAt: now(), orderId: '' }; store.save(); res.status(204).end();
});
app.get('/paypal/return', async (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.query.deliveryId && row.paypal?.orderId === req.query.token);
  if (!delivery) return res.redirect('/?paypal=sandbox-error');
  if (delivery.paypal?.status === 'COMPLETED') return res.redirect(`/?paypal=sandbox-success&delivery=${encodeURIComponent(delivery.id)}`);
  try {
    await capturePayPalDelivery(delivery);
    res.redirect(`/?paypal=sandbox-success&delivery=${encodeURIComponent(delivery.id)}`);
  } catch (error) { res.redirect('/?paypal=sandbox-error'); }
});
app.get('/paypal/cancel', (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.query.deliveryId);
  cancelPayPalDelivery(delivery);
  res.redirect('/?paypal=sandbox-cancelled');
});
app.get('/deliveries', required, (req, res) => res.json(store.data.deliveries.filter(row => row.buyerId === req.user.id || row.sellerId === req.user.id).map(row => deliveryView(row, req.user.id))));
app.get('/delivery/providers', (req, res) => res.json(Object.entries(deliveryProviders).map(([name, details]) => ({ name, ...details }))));
app.get('/delivery/:id', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' }); res.json(deliveryView(delivery, req.user.id)); });
app.post('/delivery/:id/evidence', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id);
  const type = String(req.body.type || 'condition').trim(); const url = String(req.body.url || '').trim(); const note = String(req.body.note || '').trim();
  if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' });
  if (!['condition', 'shipment', 'pickup', 'delivery'].includes(type) || !(/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(url)) || url.length > 2_000_000) return res.status(400).json({ error: 'Upload a valid proof image and choose a proof type.' });
  if (!Array.isArray(delivery.evidence)) delivery.evidence = [];
  delivery.evidence.push({ id: id(), type, url, note: note.slice(0, 500), submittedBy: req.user.id, createdAt: now() });
  recordDeliveryUpdate(delivery, req.user.id, `proof_${type}_submitted`, `Proof of ${type} submitted.`); securityLog('delivery_evidence_submitted', req, { userId: req.user.id, deliveryId: delivery.id, type }); store.save(); res.status(201).json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/dispute', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id); const reason = String(req.body.reason || '').trim();
  if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' });
  if (reason.length < 10 || reason.length > 1000) return res.status(400).json({ error: 'Describe the dispute in 10 to 1,000 characters.' });
  delivery.status = 'dispute_open'; delivery.dispute = { openedBy: req.user.id, reason, openedAt: now(), status: 'investigating' };
  [delivery.buyerId, delivery.sellerId].forEach(userId => { const user = store.data.users.find(row => row.id === userId); if (user) user.frozenAt = now(); });
  recordDeliveryUpdate(delivery, req.user.id, 'dispute_open', 'Account activity frozen pending dispute review.'); securityLog('dispute_opened', req, { userId: req.user.id, deliveryId: delivery.id }); store.save(); res.status(201).json(deliveryView(delivery, req.user.id));
});
app.put('/delivery/:id', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || (delivery.buyerId !== req.user.id && delivery.sellerId !== req.user.id)) return res.status(404).json({ error: 'Delivery not found' });
  const sellerStatuses = ['packed', 'picked_up', 'in_transit']; const { status, courier, trackingNumber, note = '' } = req.body;
  if (delivery.status === 'completed') return res.status(400).json({ error: 'This delivery is already completed.' });
  if (delivery.buyerId === req.user.id && status === 'issue_reported') { delivery.status = status; recordDeliveryUpdate(delivery, req.user.id, status, String(note).trim() || 'Buyer reported an issue'); }
  else if (delivery.sellerId === req.user.id && sellerStatuses.includes(status)) { const order = ['awaiting_seller_dispatch', 'packed', 'picked_up', 'in_transit']; const current = order.indexOf(delivery.status); const next = order.indexOf(status); if (next !== current + 1) return res.status(400).json({ error: 'Update the delivery one step at a time.' }); const provider = delivery.deliveryProvider || String(courier || delivery.courier || '').trim(); const providerDetails = deliveryProviders[provider] || { trackingRequired: true }; const chosenCourier = String(courier ?? delivery.courier ?? provider).trim() || provider; if (delivery.deliveryProvider && chosenCourier !== delivery.deliveryProvider) return res.status(400).json({ error: `Use the buyer-selected delivery option: ${delivery.deliveryProvider}.` }); if (status === 'packed' && !(delivery.evidence || []).some(item => item.type === 'condition' && item.submittedBy === req.user.id)) return res.status(400).json({ error: 'Upload proof-of-condition before marking an item packed.' }); if (['picked_up', 'in_transit'].includes(status) && providerDetails.trackingRequired && !String(trackingNumber || delivery.trackingNumber).trim()) return res.status(400).json({ error: 'A tracking number is required for this delivery option once it is picked up.' }); if (status === 'picked_up' && !(delivery.evidence || []).some(item => item.type === 'shipment' && item.submittedBy === req.user.id)) return res.status(400).json({ error: 'Upload proof-of-shipment before confirming carrier pickup.' }); delivery.courier = chosenCourier; if (trackingNumber !== undefined) delivery.trackingNumber = String(trackingNumber).trim(); delivery.status = status; recordDeliveryUpdate(delivery, req.user.id, status, String(note).trim()); }
  else return res.status(403).json({ error: 'This delivery update is not allowed.' });
  const otherUser = delivery.buyerId === req.user.id ? delivery.sellerId : delivery.buyerId; notify(otherUser, 'delivery', `${req.user.username} updated delivery status to ${delivery.status.replaceAll('_', ' ')}`, `/delivery/${delivery.id}`); store.save(); res.json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/confirm', required, (req, res) => { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || delivery.buyerId !== req.user.id) return res.status(404).json({ error: 'Delivery not found' }); if (delivery.status !== 'in_transit') return res.status(400).json({ error: 'A package can be confirmed after it is marked in transit.' }); delivery.status = 'completed'; recordDeliveryUpdate(delivery, req.user.id, 'completed', 'Buyer confirmed delivery received'); const listing = store.data.listings.find(row => row.id === delivery.listingId); if (listing) listing.status = delivery.tradeId ? 'traded' : 'sold'; if (delivery.tradeId) { const trade = store.data.trades.find(row => row.id === delivery.tradeId); const tradeDeliveries = (trade?.deliveryIds || []).map(deliveryId => store.data.deliveries.find(row => row.id === deliveryId)).filter(Boolean); if (trade && tradeDeliveries.length && tradeDeliveries.every(row => row.status === 'completed')) { trade.status = 'completed'; [...tradeSenderIds(trade), ...tradeReceiverIds(trade)].forEach(listingId => { const tradeListing = store.data.listings.find(row => row.id === listingId); if (tradeListing) tradeListing.status = 'traded'; }); notify(trade.senderId === req.user.id ? trade.receiverId : trade.senderId, 'trade', 'All trade deliveries were confirmed — the trade is complete.', `/trade/${trade.id}`); } } notify(delivery.sellerId, 'delivery', `${req.user.username} confirmed delivery for “${listing?.title || 'your listing'}”`, `/delivery/${delivery.id}`); store.save(); res.json(deliveryView(delivery, req.user.id)); });
app.post('/delivery/:id/return-request', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id);
  const reason = String(req.body.reason || '').trim();
  if (!delivery || delivery.buyerId !== req.user.id) return res.status(404).json({ error: 'Delivery not found' });
  if (delivery.status !== 'completed' || delivery.return?.status) return res.status(400).json({ error: 'A return can only be requested once after a completed delivery.' });
  if (reason.length < 10 || reason.length > 1000) return res.status(400).json({ error: 'Describe the return reason in 10 to 1,000 characters.' });
  delivery.return = { status: 'requested', reason, requestedAt: now(), requestedBy: req.user.id, trackingNumber: '', carrier: delivery.deliveryProvider || 'UPS Priority', updates: [] };
  recordDeliveryUpdate(delivery, req.user.id, 'return_requested', `Return requested: ${reason}`);
  notify(delivery.sellerId, 'return', `${req.user.username} requested a return for “${store.data.listings.find(row => row.id === delivery.listingId)?.title || 'a collector item'}”`, `/delivery/${delivery.id}`);
  store.save(); res.status(201).json(deliveryView(delivery, req.user.id));
});
app.put('/delivery/:id/return', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id);
  const decision = String(req.body.decision || '').trim(); const note = String(req.body.note || '').trim();
  if (!delivery || !delivery.return) return res.status(404).json({ error: 'Return request not found' });
  if (delivery.sellerId !== req.user.id || delivery.return.status !== 'requested' || !['approved', 'declined'].includes(decision)) return res.status(403).json({ error: 'This return decision is not allowed.' });
  delivery.return.status = decision; delivery.return.decisionNote = note.slice(0, 1000); delivery.return.decidedAt = now(); delivery.return.decidedBy = req.user.id;
  recordDeliveryUpdate(delivery, req.user.id, `return_${decision}`, `Return ${decision}${note ? `: ${note}` : ''}`);
  notify(delivery.buyerId, 'return', `${req.user.username} ${decision} your return request`, `/delivery/${delivery.id}`);
  store.save(); res.json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/return-tracking', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id);
  const trackingNumber = String(req.body.trackingNumber || '').trim(); const carrier = String(req.body.carrier || '').trim();
  if (!delivery || delivery.buyerId !== req.user.id || delivery.return?.status !== 'approved') return res.status(404).json({ error: 'An approved return was not found.' });
  if (trackingNumber.length < 4 || trackingNumber.length > 120) return res.status(400).json({ error: 'Enter a valid return tracking number.' });
  delivery.return.status = 'shipped'; delivery.return.trackingNumber = trackingNumber; delivery.return.carrier = carrier || delivery.deliveryProvider || 'UPS Priority'; delivery.return.shippedAt = now();
  recordDeliveryUpdate(delivery, req.user.id, 'return_shipped', `Return shipped with ${delivery.return.carrier}. Tracking: ${trackingNumber}`);
  notify(delivery.sellerId, 'return', `${req.user.username} shipped a return`, `/delivery/${delivery.id}`);
  store.save(); res.json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/return-received', required, (req, res) => {
  const delivery = store.data.deliveries.find(row => row.id === req.params.id);
  if (!delivery || delivery.sellerId !== req.user.id || delivery.return?.status !== 'shipped') return res.status(404).json({ error: 'A shipped return was not found.' });
  delivery.return.status = 'received'; delivery.return.receivedAt = now(); delivery.return.receivedBy = req.user.id; delivery.status = 'returned';
  recordDeliveryUpdate(delivery, req.user.id, 'return_received', 'Seller confirmed the returned item was received. Process any eligible refund in PayPal.');
  const listing = store.data.listings.find(row => row.id === delivery.listingId); if (listing && !delivery.tradeId) listing.status = 'archived';
  notify(delivery.buyerId, 'return', `${req.user.username} confirmed receipt of your return`, `/delivery/${delivery.id}`);
  store.save(); res.json(deliveryView(delivery, req.user.id));
});
app.post('/delivery/:id/shippo/rate', required, async (req, res) => { try { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || delivery.sellerId !== req.user.id) return res.status(404).json({ error: 'Delivery not found' }); if (delivery.deliveryProvider !== 'UPS Priority') return res.status(400).json({ error: 'This order did not select UPS Priority.' }); const origin = shippoAddress(req.body.origin, 'sender'); const destination = shippoAddress(delivery.recipientAddress || req.body.destination, 'recipient'); const parcel = shippoParcel(req.body.parcel); const shipment = await shippoRequest('/shipments/', { address_from: origin, address_to: destination, parcels: [parcel], async: false, metadata: `CollectorMarketplace ${delivery.id}` }); const upsRates = (shipment.rates || []).filter(row => /ups/i.test(`${row.provider || ''} ${row.servicelevel?.name || ''}`)); const rate = upsRates.find(row => /priority/i.test(row.servicelevel?.name || '')) || upsRates.sort((left, right) => Number(left.amount || Infinity) - Number(right.amount || Infinity))[0]; if (!rate) return res.status(400).json({ error: 'Shippo returned no UPS rate for these details.' }); delivery.shippo = { shipmentId: shipment.object_id, rateId: rate.object_id, amount: Number(rate.amount), currency: rate.currency || 'USD', provider: rate.provider || 'UPS', service: rate.servicelevel?.name || 'UPS', origin, destination, parcel }; recordDeliveryUpdate(delivery, req.user.id, delivery.status, `Live UPS quote: ${delivery.shippo.currency} ${delivery.shippo.amount.toFixed(2)} · ${delivery.shippo.service}.`); store.save(); res.json(deliveryView(delivery, req.user.id)); } catch (error) { res.status(400).json({ error: error.message }); } });
app.post('/delivery/:id/shippo/label', required, async (req, res) => { try { const delivery = store.data.deliveries.find(row => row.id === req.params.id); if (!delivery || delivery.sellerId !== req.user.id) return res.status(404).json({ error: 'Delivery not found' }); if (!delivery.shippo?.rateId) return res.status(400).json({ error: 'Request a UPS rate first.' }); if (delivery.shippo.transactionId) return res.status(400).json({ error: 'A label was already purchased for this delivery.' }); const transaction = await shippoRequest('/transactions/', { rate: delivery.shippo.rateId, async: false, label_file_type: 'PDF_4x6', metadata: `CollectorMarketplace ${delivery.id}` }); if (transaction.status !== 'SUCCESS') return res.status(400).json({ error: transaction.messages?.[0]?.text || 'Shippo could not purchase this label.' }); delivery.shippo = { ...delivery.shippo, transactionId: transaction.object_id, labelUrl: transaction.label_url, trackingUrl: transaction.tracking_url_provider }; delivery.trackingNumber = transaction.tracking_number || ''; recordDeliveryUpdate(delivery, req.user.id, delivery.status, `UPS label purchased. Tracking: ${delivery.trackingNumber || 'pending'}.`); store.save(); res.json(deliveryView(delivery, req.user.id)); } catch (error) { res.status(400).json({ error: error.message }); } });

const xmlEscape = value => String(value ?? '').replace(/[<>&'\"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
const htmlEscape = xmlEscape;
const merchantCondition = value => ['New', 'New with Tags', 'Sealed', 'Mint'].includes(String(value || '')) ? 'new' : 'used';
const listingImageUrl = (listing, index = 0) => { const image = String(listing?.images?.[index] || ''); if (/^data:image\/(jpeg|png|webp);base64,/i.test(image)) return `${publicSiteUrl}/listing-image/${encodeURIComponent(listing.id)}/${index}`; if (/^\//.test(image)) return `${publicSiteUrl}${image}`; return image; };
const googleShoppingEligible = listing => listing?.status === 'active' && listing.listingMode !== 'auction_only' && Number(listing.price) > 0 && !listing.riskFlags?.length && Boolean(listingImageUrl(listing));
const googleShoppingProduct = listing => ({
  id: `cm-${listing.id}`,
  title: listing.title,
  description: listing.description,
  link: `${publicSiteUrl}/product/${encodeURIComponent(listing.id)}`,
  image: listingImageUrl(listing),
  price: `${Number(listing.price).toFixed(2)} USD`,
  availability: 'in_stock',
  condition: merchantCondition(listing.condition),
  productType: listing.category || 'Collectibles'
});
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
  'listing-creation.css', 'listing-workspace.css', 'listing-detail.css', 'listing-actions.css', 'listing-category.css',
  'listing-sort.css', 'delivery-workspace.css', 'app-performance.css', 'account-connections.css', 'social-chat.css', 'jungle-chat.css', 'account-venice.css', 'sell-fire.css', 'voice-chat.css', 'account-workspace.css', 'tags-expanded.css', 'professional-ui.css', 'workspace-scrolling.css', 'scroll-stability.css', 'page-scroll-fixes.css', 'listing-form-refined.css', 'lobby-song.css', 'site-theme.css', 'conveyor-smog.css', 'purchase-wonderland.css', 'favicon.png', 'favicon-512.png', 'sitemap.xml', 'robots.txt', 'BingSiteAuth.xml'
]);
app.use('/public', express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/data/listings.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'listings.json')));
app.get('/data/auctions.json', (req, res) => res.sendFile(path.join(__dirname, 'data', 'auctions.json')));
app.get('/listing-image/:id/:index', (req, res) => {
  const listing = store.data.listings.find(row => row.id === req.params.id && row.status === 'active');
  const image = String(listing?.images?.[Number(req.params.index)] || '');
  const match = /^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=]+)$/i.exec(image);
  if (!match) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=3600');
  res.type(`image/${match[1].toLowerCase()}`).send(Buffer.from(match[2], 'base64'));
});
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/google-shopping.xml', (req, res) => {
  const products = store.data.listings.filter(googleShoppingEligible).map(googleShoppingProduct);
  const items = products.map(product => `  <item>\n    <g:id>${xmlEscape(product.id)}</g:id>\n    <g:title>${xmlEscape(product.title)}</g:title>\n    <g:description>${xmlEscape(product.description)}</g:description>\n    <g:link>${xmlEscape(product.link)}</g:link>\n    <g:image_link>${xmlEscape(product.image)}</g:image_link>\n    <g:availability>${product.availability}</g:availability>\n    <g:price>${product.price}</g:price>\n    <g:condition>${product.condition}</g:condition>\n    <g:product_type>${xmlEscape(product.productType)}</g:product_type>\n    <g:identifier_exists>no</g:identifier_exists>\n  </item>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n  <title>CollectorMarketplace Google Shopping Feed</title>\n  <link>${xmlEscape(publicSiteUrl)}</link>\n  <description>Active collector listings available for purchase.</description>\n${items}\n</channel>\n</rss>`);
});
app.get('/product/:id', (req, res) => {
  const listing = store.data.listings.find(row => row.id === req.params.id && googleShoppingEligible(row));
  if (!listing) return res.status(404).send('This product is no longer available.');
  const product = googleShoppingProduct(listing);
  const image = htmlEscape(product.image); const title = htmlEscape(product.title); const description = htmlEscape(product.description); const condition = htmlEscape(listing.condition || 'Used');
  const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: listing.title, description: listing.description, image: [product.image], category: product.productType, sku: product.id, offers: { '@type': 'Offer', url: product.link, priceCurrency: 'USD', price: Number(listing.price).toFixed(2), availability: 'https://schema.org/InStock', itemCondition: product.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition' } }).replace(/</g, '\\u003c');
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | CollectorMarketplace</title><meta name="description" content="${description}"><link rel="canonical" href="${htmlEscape(product.link)}"><meta property="og:type" content="product"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><script type="application/ld+json">${structuredData}</script><style>body{margin:0;background:#111;color:#f5f3eb;font:16px system-ui,sans-serif}.product{max-width:980px;margin:auto;padding:32px;display:grid;gap:28px;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr)}img{width:100%;max-height:70vh;object-fit:contain;background:#000}.panel{padding:28px;border:1px solid #65552c;background:#191919}h1{margin:0 0 14px;font-size:clamp(2rem,5vw,3.4rem)}.price{font-size:2rem;color:#77e5af;font-weight:800}.meta{color:#d8c17a;text-transform:uppercase;font-size:.75rem;letter-spacing:.08em}.buy{display:inline-block;margin-top:24px;padding:14px 20px;background:#165c41;color:#fff;text-decoration:none;font-weight:800}@media(max-width:700px){.product{grid-template-columns:1fr;padding:18px}}</style></head><body><main class="product"><img src="${image}" alt="${title}"><section class="panel"><p class="meta">${htmlEscape(product.productType)} · ${condition}</p><h1>${title}</h1><p>${description}</p><p class="price">$${Number(listing.price).toFixed(2)}</p><p>Available now on CollectorMarketplace. Pickup and delivery options are confirmed during checkout.</p><a class="buy" href="${publicSiteUrl}/#browse">View listing &amp; buy</a></section></main></body></html>`);
});
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
