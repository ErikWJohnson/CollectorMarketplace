const stream = document.querySelector('#listing-stream');
const search = document.querySelector('#search');
const tagSearch = document.querySelector('#tag-search');
const tags = document.querySelector('#tags');
const audienceTags = document.querySelector('#audience-tags');
const categories = document.querySelector('#categories');
const listingSort = document.querySelector('#listing-sort');
const priceMin = document.querySelector('#price-min');
const priceMax = document.querySelector('#price-max');
const sentinel = document.querySelector('#sentinel');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
let listings = [], auctions = [], accounts = [], collectives = [], brands = [], couriers = [], chatrooms = [], deliveries = [], uploadedListingImages = [], uploadedListingVideos = [], activeCategory = 'All', activeQuery = '', activeTags = [], searchScope = 'listings', sortMode = 'popular', page = 1, observer, searchRenderTimer, auctionClock;
const siteThemeAudio = document.querySelector('#site-theme-audio');
const auctionWaterfallAudio = document.querySelector('#auction-waterfall-audio');
const jungleChatAudio = document.querySelector('#jungle-chat-audio');
const accountVeniceAudio = document.querySelector('#account-venice-audio');
const sellLavaAudio = document.querySelector('#sell-lava-audio');
const auctionBlockPlaceAudio = document.querySelector('#auction-block-place-audio');
const auctionBlockClearAudio = document.querySelector('#auction-block-clear-audio');
const rocketBoostAudio = document.querySelector('#rocket-boost-audio');
const gameLaserAudio = document.querySelector('#game-laser-audio');
const gameAsteroidAudio = document.querySelector('#game-asteroid-audio');
const gameSpaceshipExplosionAudio = document.querySelector('#game-spaceship-explosion-audio');
const puppyJumpAudio = document.querySelector('#puppy-jump-audio');
const puppyAngerAudio = document.querySelector('#puppy-anger-audio');
const startAuctionWaterfall = () => {
  if (!auctionWaterfallAudio) return;
  auctionWaterfallAudio.loop = true;
  auctionWaterfallAudio.volume = 0.16;
  auctionWaterfallAudio.play().then(syncAuctionWaterfallControl).catch(syncAuctionWaterfallControl);
};
const stopAuctionWaterfall = () => {
  if (!auctionWaterfallAudio) return;
  auctionWaterfallAudio.pause();
  auctionWaterfallAudio.currentTime = 0;
  stopAuctionBlocks();
  syncAuctionWaterfallControl();
};
const startJungleChatAmbience = () => {
  if (!jungleChatAudio) return;
  jungleChatAudio.loop = true;
  jungleChatAudio.volume = 0.18;
  jungleChatAudio.play().catch(() => {});
};
const stopJungleChatAmbience = () => {
  if (!jungleChatAudio) return;
  jungleChatAudio.pause();
  jungleChatAudio.currentTime = 0;
};
const startAccountVeniceAmbience = () => {
  if (!accountVeniceAudio) return;
  accountVeniceAudio.loop = true;
  // Keep the recorded harbor detail present above the music bed without
  // becoming harsh.  A short fade-in avoids an artificial hard start.
  accountVeniceAudio.volume = 0.03;
  accountVeniceAudio.play().then(() => {
    const startedAt = performance.now();
    const raiseVolume = now => {
      if (accountVeniceAudio.paused || !document.body.classList.contains('app-section-account')) return;
      accountVeniceAudio.volume = Math.min(.46, .03 + ((now - startedAt) / 700) * .43);
      if (accountVeniceAudio.volume < .46) requestAnimationFrame(raiseVolume);
      else syncAccountVeniceControl();
    };
    requestAnimationFrame(raiseVolume);
    syncAccountVeniceControl();
  }).catch(() => syncAccountVeniceControl());
};
const stopAccountVeniceAmbience = () => {
  if (!accountVeniceAudio) return;
  accountVeniceAudio.pause();
  accountVeniceAudio.currentTime = 0;
};
const startSellLavaAmbience = () => {
  if (!sellLavaAudio) return;
  sellLavaAudio.loop = true;
  sellLavaAudio.volume = .30;
  sellLavaAudio.play().catch(() => {});
};
const stopSellLavaAmbience = () => {
  if (!sellLavaAudio) return;
  sellLavaAudio.pause();
  sellLavaAudio.currentTime = 0;
};
function syncAccountVeniceControl() {
  const hero = stream?.querySelector('.profile-hero');
  if (!hero || !accountVeniceAudio) return;
  let control = hero.querySelector('[data-account-venice-sound]');
  if (!control) {
    control = document.createElement('button');
    control.type = 'button';
    control.className = 'account-venice-sound-control';
    control.dataset.accountVeniceSound = '';
    hero.append(control);
  }
  const playing = !accountVeniceAudio.paused;
  control.textContent = playing ? 'Dock ambience · On' : 'Dock ambience · Play';
  control.setAttribute('aria-pressed', String(playing));
}
accountVeniceAudio?.addEventListener('play', syncAccountVeniceControl);
accountVeniceAudio?.addEventListener('pause', syncAccountVeniceControl);
const veniceSailingGame = { host: null, frame: 0, restartTimer: 0, started: false, playerAngle: Math.PI / 2, enemyAngle: -Math.PI / 2, enemyDirection: 1, enemyActive: true, enemyRespawnAt: 0, playerShots: [], enemyShots: [], explosions: [], score: 0, highScore: Number(localStorage.getItem('collector-marketplace-venice-cannon-high-score') || 0), lastShot: 0, lastEnemyShot: 0, shieldUntil: 0, shieldReadyAt: 0, invulnerableUntil: 0, lastFrame: 0, message: 'Press Play to begin your cannon run.' };
const veniceOrbitPoint = angle => ({ x: 50 + Math.cos(angle) * 37, y: 51 + Math.sin(angle) * 31 });
const distanceToVeniceShotPath = (shot, target) => {
  const startX = shot.previousX ?? shot.x;
  const startY = shot.previousY ?? shot.y;
  const segmentX = shot.x - startX;
  const segmentY = shot.y - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const progress = segmentLengthSquared ? Math.max(0, Math.min(1, ((target.x - startX) * segmentX + (target.y - startY) * segmentY) / segmentLengthSquared)) : 0;
  return Math.hypot(target.x - (startX + segmentX * progress), target.y - (startY + segmentY * progress));
};
const sellLavaGame = { host: null, frame: 0, restartTimer: 0, started: false, playerX: 24, playerY: 43, velocityY: 0, grounded: true, movingLeft: false, movingRight: false, platforms: [], obstacles: [], enemies: [], shots: [], blasts: [], score: 0, best: Number(localStorage.getItem('collector-marketplace-lava-run-high-score') || 0), lastFrame: 0, lastSpawn: 0, lastEnemy: 0, lastShot: 0, message: 'Press Play to enter the lava platforms.' };
function renderSellLavaGame() {
  const game = sellLavaGame; if (!game.host?.isConnected) return;
  const platform = item => `<i class="sell-lava-platform" style="--platform-x:${item.x}%;--platform-y:${item.y}px;--platform-width:${item.width}%;--platform-height:${item.height}px" aria-hidden="true"></i>`;
  const obstacle = item => item.type === 'block' ? `<i class="sell-lava-block" style="--obstacle-x:${item.x}%;--obstacle-y:${item.y}px;--obstacle-height:${item.height}px" aria-hidden="true"></i>` : `<i class="sell-lava-spike" style="--obstacle-x:${item.x}%;--obstacle-y:${item.y}px" aria-hidden="true"></i>`;
  const enemy = item => `<i class="sell-lava-enemy" style="--enemy-x:${item.x}%;--enemy-y:${item.y}px" aria-label="Lava drone" role="img">🛸</i>`;
  const shot = item => `<i class="sell-lava-shot" style="--shot-x:${item.x}%;--shot-y:${item.y}px" aria-hidden="true"></i>`;
  const blast = item => `<i class="sell-lava-blast" style="--blast-x:${item.x}%;--blast-y:${item.y}px" aria-hidden="true">✦</i>`;
  game.host.innerHTML = `<section class="sell-lava-game"><header><b>Lava Platform Run</b><span>Score ${String(Math.floor(game.score)).padStart(4, '0')} · Best ${String(game.best).padStart(4, '0')}</span></header><div class="sell-lava-field"><i class="sell-lava-grid" aria-hidden="true"></i><i class="sell-lava-ground" aria-hidden="true"></i>${game.platforms.map(platform).join('')}${game.obstacles.map(obstacle).join('')}${game.enemies.map(enemy).join('')}${game.shots.map(shot).join('')}${game.blasts.map(blast).join('')}<i class="sell-lava-runner${game.grounded ? ' is-grounded' : ''}" style="--runner-x:${game.playerX}%;--runner-y:${game.playerY}px" aria-label="Your lava runner" role="img"></i>${!game.started ? `<div class="sell-lava-toast"><span>${game.message}</span></div>` : ''}</div><footer><small>[ and ] move · = jump · \` laser · land on platforms and clear drones</small><div><button type="button" data-sell-lava-left aria-label="Move left">←</button><button type="button" data-sell-lava-jump>Jump</button><button type="button" data-sell-lava-shoot>Laser</button><button type="button" data-sell-lava-right aria-label="Move right">→</button><button type="button" data-sell-lava-play>${game.started ? 'Restart' : 'Play'}</button></div></footer></section>`;
}
function resetSellLavaGame() { const game = sellLavaGame; game.playerX = 24; game.playerY = 43; game.velocityY = 0; game.grounded = true; game.movingLeft = false; game.movingRight = false; game.platforms = [{ x: -8, y: 18, width: 52, height: 25 }, { x: 47, y: 18, width: 28, height: 25 }, { x: 80, y: 46, width: 24, height: 20 }]; game.obstacles = [{ type: 'spike', x: 60, y: 43, height: 24 }]; game.enemies = []; game.shots = []; game.blasts = []; game.score = 0; game.lastFrame = performance.now(); game.lastSpawn = performance.now(); game.lastEnemy = performance.now(); game.lastShot = 0; game.message = 'Press Play to enter the lava platforms.'; }
function endSellLavaGame(message) { const game = sellLavaGame; game.started = false; game.movingLeft = false; game.movingRight = false; game.best = Math.max(game.best, Math.floor(game.score)); localStorage.setItem('collector-marketplace-lava-run-high-score', String(game.best)); game.message = `${message} Restarting…`; renderSellLavaGame(); clearTimeout(game.restartTimer); game.restartTimer = window.setTimeout(() => { if (game.host?.isConnected && document.body.classList.contains('app-section-listing')) launchSellLavaGame(); }, 1400); }
function jumpSellLavaRunner() { const game = sellLavaGame; if (!game.started || !game.grounded) return; game.velocityY = .42; game.grounded = false; playVeniceGameSound(gameLaserAudio, .18); }
function shootSellLavaRunner() { const game = sellLavaGame; const now = performance.now(); if (!game.started || now - game.lastShot < 220) return; game.lastShot = now; game.shots.push({ x: game.playerX + 2.4, y: game.playerY + 16 }); playVeniceGameSound(gameLaserAudio, .26); }
function moveSellLavaRunner(direction) { const game = sellLavaGame; if (!game.started) return; game.playerX = Math.max(7, Math.min(88, game.playerX + direction * 7)); renderSellLavaGame(); }
function updateSellLavaGame(timestamp) {
  const game = sellLavaGame; if (!game.started || !game.host?.isConnected || !document.body.classList.contains('app-section-listing')) return;
  const delta = Math.min(40, timestamp - game.lastFrame || 16); game.lastFrame = timestamp; game.score += delta / 28;
  const scrollSpeed = .018 + Math.min(.011, game.score / 15000);
  game.platforms.forEach(item => { item.x -= scrollSpeed * delta; }); game.obstacles.forEach(item => { item.x -= scrollSpeed * delta; }); game.enemies.forEach(item => { item.x -= scrollSpeed * delta * .62; item.y += Math.sin((timestamp + item.seed) / 210) * .08 * delta; }); game.shots.forEach(item => { item.x += .13 * delta; });
  if (timestamp - game.lastSpawn > Math.max(760, 1180 - game.score * 1.4)) {
    const last = game.platforms.at(-1) || { x: 82, y: 18, width: 28, height: 25 }; const nextY = Math.max(18, Math.min(118, last.y + (Math.random() < .55 ? 0 : (Math.random() < .5 ? 28 : -28)))); const next = { x: 104, y: nextY, width: 23 + Math.random() * 14, height: nextY === 18 ? 25 : 19 }; game.platforms.push(next); if (Math.random() < .34 && next.width > 27) game.obstacles.push({ type: Math.random() < .8 ? 'spike' : 'block', x: next.x + next.width * .58, y: next.y + next.height, height: 29 }); game.lastSpawn = timestamp;
  }
  if (timestamp - game.lastEnemy > 2700 + Math.random() * 1100) { game.enemies.push({ x: 105, y: 70 + Math.random() * 118, seed: timestamp }); game.lastEnemy = timestamp; }
  game.platforms = game.platforms.filter(item => item.x + item.width > -8); game.obstacles = game.obstacles.filter(item => item.x > -8); game.enemies = game.enemies.filter(item => item.x > -8); game.shots = game.shots.filter(item => item.x < 108); game.blasts = game.blasts.filter(item => timestamp - item.at < 360);
  if (game.movingLeft) game.playerX = Math.max(7, game.playerX - .055 * delta); if (game.movingRight) game.playerX = Math.min(88, game.playerX + .055 * delta);
  const priorY = game.playerY; game.velocityY -= .00115 * delta; game.playerY += game.velocityY * delta; game.grounded = false;
  if (game.velocityY <= 0) { const landing = game.platforms.filter(item => game.playerX + 3 >= item.x && game.playerX - 3 <= item.x + item.width).find(item => { const top = item.y + item.height; return priorY >= top && game.playerY <= top; }); if (landing) { game.playerY = landing.y + landing.height; game.velocityY = 0; game.grounded = true; } }
  const player = { left: game.playerX - 1.9, right: game.playerX + 1.9, bottom: game.playerY + 2, top: game.playerY + 30 };
  const overlaps = box => player.left < box.right && player.right > box.left && player.bottom < box.top && player.top > box.bottom;
  const hit = game.obstacles.find(item => overlaps({ left: item.x - 1.5, right: item.x + (item.type === 'block' ? 3.2 : 1.5), bottom: item.y, top: item.y + (item.type === 'block' ? item.height : 24) }));
  const hitEnemy = game.enemies.find(item => overlaps({ left: item.x - 2.5, right: item.x + 2.5, bottom: item.y - 2, top: item.y + 26 }));
  const destroyed = game.enemies.filter(enemy => game.shots.some(shot => shot.x >= enemy.x - 3 && shot.x <= enemy.x + 4 && shot.y >= enemy.y - 4 && shot.y <= enemy.y + 28));
  if (destroyed.length) { game.enemies = game.enemies.filter(enemy => !destroyed.includes(enemy)); game.shots = game.shots.filter(shot => !destroyed.some(enemy => shot.x >= enemy.x - 3 && shot.x <= enemy.x + 4 && shot.y >= enemy.y - 4 && shot.y <= enemy.y + 28)); destroyed.forEach(enemy => game.blasts.push({ x: enemy.x, y: enemy.y + 10, at: timestamp })); game.score += destroyed.length * 55; playVeniceGameSound(gameAsteroidAudio, .22); }
  if (hit || hitEnemy || game.playerY < 7) { playVeniceGameSound(gameAsteroidAudio, .35); endSellLavaGame(hit || hitEnemy ? `You hit ${hitEnemy ? 'a lava drone' : 'an obstacle'}. Score: ${Math.floor(game.score)}.` : `The lava caught you. Score: ${Math.floor(game.score)}.`); return; }
  renderSellLavaGame(); game.frame = requestAnimationFrame(updateSellLavaGame);
}
function launchSellLavaGame() { clearTimeout(sellLavaGame.restartTimer); cancelAnimationFrame(sellLavaGame.frame); resetSellLavaGame(); sellLavaGame.started = true; renderSellLavaGame(); sellLavaGame.frame = requestAnimationFrame(updateSellLavaGame); }
function stopSellLavaGame() { clearTimeout(sellLavaGame.restartTimer); cancelAnimationFrame(sellLavaGame.frame); sellLavaGame.frame = 0; sellLavaGame.started = false; sellLavaGame.host = null; }
function mountSellLavaGame() { const host = stream?.querySelector('.sell-lava-game-host'); if (!host) return stopSellLavaGame(); sellLavaGame.host = host; renderSellLavaGame(); }
document.addEventListener('click', event => { if (event.target.closest('[data-sell-lava-play]')) { launchSellLavaGame(); return; } if (event.target.closest('[data-sell-lava-jump]')) { jumpSellLavaRunner(); return; } if (event.target.closest('[data-sell-lava-shoot]')) { shootSellLavaRunner(); return; } if (event.target.closest('[data-sell-lava-left]')) moveSellLavaRunner(-1); if (event.target.closest('[data-sell-lava-right]')) moveSellLavaRunner(1); });
document.addEventListener('keydown', event => { if (!sellLavaGame.started || !document.body.classList.contains('app-section-listing') || !canUseAutoScroll(event.target)) return; if (event.code === 'Equal') { event.preventDefault(); if (!event.repeat) jumpSellLavaRunner(); } if (event.code === 'Backquote') { event.preventDefault(); if (!event.repeat) shootSellLavaRunner(); } if (event.code === 'BracketLeft') { event.preventDefault(); sellLavaGame.movingLeft = true; } if (event.code === 'BracketRight') { event.preventDefault(); sellLavaGame.movingRight = true; } });
document.addEventListener('keyup', event => { if (event.code === 'BracketLeft') sellLavaGame.movingLeft = false; if (event.code === 'BracketRight') sellLavaGame.movingRight = false; });
function renderVeniceSailingGame() {
  const game = veniceSailingGame; if (!game.host?.isConnected) return;
  const player = veniceOrbitPoint(game.playerAngle); const enemy = veniceOrbitPoint(game.enemyAngle);
  const ship = (className, point, emoji, label) => `<div class="sailing-emoji-ship ${className}" style="left:${point.x}%;top:${point.y}%" aria-label="${label}" role="img">${emoji}</div>`;
  const shot = (item, enemyShot = false) => `<i class="sailing-cannonball${enemyShot ? ' enemy' : ''}" style="left:${item.x}%;top:${item.y}%;transform:rotate(${item.angle}deg)"></i>`;
  const blast = item => `<i class="sailing-explosion" style="left:${item.x}%;top:${item.y}%"><b>✦</b><b>✦</b><b>✦</b><b>✦</b></i>`;
  const muzzle = performance.now() - game.lastShot < 105 ? `<i class="sailing-muzzle-flash" style="left:${player.x}%;top:${player.y}%">✹</i>` : '';
  const protectedFor = Math.max(0, game.invulnerableUntil - performance.now());
  const shieldFor = Math.max(0, game.shieldUntil - performance.now());
  const shieldCooldown = Math.max(0, game.shieldReadyAt - performance.now());
  const protection = game.started && protectedFor ? `<div class="sailing-protection">Safe harbor · ${(protectedFor / 1000).toFixed(1)}s</div>` : '';
  const shield = game.started ? `<div class="sailing-shield-status${shieldFor ? ' is-active' : ''}">${shieldFor ? `Shield · ${(shieldFor / 1000).toFixed(1)}s` : shieldCooldown ? `Shield ready in ${(shieldCooldown / 1000).toFixed(1)}s` : 'Shield ready · `'}</div>` : '';
  const respawn = game.started && !game.enemyActive ? `<div class="sailing-respawn">Pirate flag returns in ${Math.max(0, (game.enemyRespawnAt - performance.now()) / 1000).toFixed(1)}s</div>` : '';
  game.host.innerHTML = `<section class="account-sailing-game"><header><b>Venice Cannon Run</b><span>Score ${String(game.score).padStart(4, '0')} · Best ${String(game.highScore).padStart(4, '0')}</span></header><div class="sailing-battlefield"><i class="sailing-orbit-ring" aria-hidden="true"></i><div class="sailing-skyline">⚜️　⛪　🏛️　⛪　⚜️</div>${game.enemyActive ? ship('sailing-enemy', enemy, '🏴‍☠️', 'Rival pirate flag') : ''}${ship(`sailing-player${protectedFor || shieldFor ? ' is-protected' : ''}`, player, '⛵', 'Your merchant sailboat')}${game.playerShots.map(item => shot(item)).join('')}${game.enemyShots.map(item => shot(item, true)).join('')}${game.explosions.map(blast).join('')}${muzzle}${protection}${shield}${respawn}${!game.started ? `<div class="sailing-toast"><span>${game.message}</span></div>` : ''}</div><footer><small>[ and ] orbit your ship · = fires a cannon · \` uses shield<br>Sink pirate flags. Avoid their cannon fire.</small><div class="sailing-controls"><button type="button" data-venice-sailing-left aria-label="Sail left">←</button><button type="button" data-venice-sailing-fire>Fire</button><button type="button" data-venice-sailing-shield>Shield</button><button type="button" data-venice-sailing-right aria-label="Sail right">→</button><button type="button" data-venice-sailing-play>${game.started ? 'Restart' : 'Play'}</button></div></footer></section>`;
}
function resetVeniceSailingGame() { const game = veniceSailingGame; game.playerAngle = Math.PI / 2; game.enemyAngle = -Math.PI / 2; game.enemyDirection = Math.random() > .5 ? 1 : -1; game.enemyActive = true; game.enemyRespawnAt = 0; game.playerShots = []; game.enemyShots = []; game.explosions = []; game.score = 0; game.lastShot = 0; game.lastEnemyShot = 0; game.shieldUntil = 0; game.shieldReadyAt = 0; game.lastFrame = performance.now(); game.invulnerableUntil = performance.now() + 2000; game.message = 'Press Play to begin your cannon run.'; }
const playVeniceGameSound = (audio, volume) => { if (!audio) return; audio.pause(); audio.currentTime = 0; audio.volume = volume; audio.play().catch(() => {}); };
function fireVeniceCannon() { const game = veniceSailingGame; const now = performance.now(); if (!game.started || !game.enemyActive || now - game.lastShot < 240) return; const player = veniceOrbitPoint(game.playerAngle); const enemy = veniceOrbitPoint(game.enemyAngle); const dx = enemy.x - player.x; const dy = enemy.y - player.y; const distance = Math.hypot(dx, dy) || 1; game.lastShot = now; game.playerShots.push({ x: player.x, y: player.y, vx: dx / distance * .16, vy: dy / distance * .16, angle: Math.atan2(dy, dx) * 180 / Math.PI + 90 }); playVeniceGameSound(gameLaserAudio, .32); }
function activateVeniceShield() { const game = veniceSailingGame; const now = performance.now(); if (!game.started || now < game.shieldReadyAt) return; game.shieldUntil = now + 2000; game.shieldReadyAt = now + 8000; renderVeniceSailingGame(); }
function moveVeniceSailingShip(direction) { const game = veniceSailingGame; if (!game.started) return; game.playerAngle += direction * .29; renderVeniceSailingGame(); }
function endVeniceSailingGame(message) { const game = veniceSailingGame; game.started = false; game.highScore = Math.max(game.highScore, game.score); localStorage.setItem('collector-marketplace-venice-cannon-high-score', String(game.highScore)); game.message = `${message} Restarting…`; renderVeniceSailingGame(); clearTimeout(game.restartTimer); game.restartTimer = window.setTimeout(() => { if (game.host?.isConnected && document.body.classList.contains('app-section-account')) launchVeniceSailingGame(); }, 1600); }
function updateVeniceSailingGame(timestamp) {
  const game = veniceSailingGame; if (!game.started || !game.host?.isConnected || !document.body.classList.contains('app-section-account')) return;
  const delta = Math.min(40, timestamp - game.lastFrame || 16); game.lastFrame = timestamp;
  if (game.enemyActive) {
    game.enemyAngle += game.enemyDirection * delta * .00075;
    if (Math.random() < .006) game.enemyDirection *= -1;
  }
  game.playerShots.forEach(item => { item.previousX = item.x; item.previousY = item.y; item.x += item.vx * delta; item.y += item.vy * delta; }); game.enemyShots.forEach(item => { item.previousX = item.x; item.previousY = item.y; item.x += item.vx * delta; item.y += item.vy * delta; });
  game.playerShots = game.playerShots.filter(item => item.x > -5 && item.x < 105 && item.y > -5 && item.y < 105); game.enemyShots = game.enemyShots.filter(item => item.x > -5 && item.x < 105 && item.y > -5 && item.y < 105);
  game.explosions = game.explosions.filter(item => timestamp - item.at < 520);
  const now = performance.now();
  const player = veniceOrbitPoint(game.playerAngle); const enemy = veniceOrbitPoint(game.enemyAngle);
  if (!game.enemyActive && now >= game.enemyRespawnAt) { game.enemyActive = true; game.enemyAngle = game.playerAngle + Math.PI; game.enemyDirection = Math.random() > .5 ? 1 : -1; game.lastEnemyShot = now; }
  if (game.enemyActive && now - game.lastEnemyShot > 900 + Math.random() * 600) { const dx = player.x - enemy.x; const dy = player.y - enemy.y; const distance = Math.hypot(dx, dy) || 1; game.lastEnemyShot = now; game.enemyShots.push({ x: enemy.x, y: enemy.y, vx: dx / distance * .12, vy: dy / distance * .12, angle: Math.atan2(dy, dx) * 180 / Math.PI + 90 }); playVeniceGameSound(gameLaserAudio, .17); }
  const hitEnemy = game.enemyActive && game.playerShots.find(item => distanceToVeniceShotPath(item, enemy) <= 4.4);
  if (hitEnemy) { game.score += 100; game.explosions.push({ x: enemy.x, y: enemy.y, at: timestamp }); game.enemyActive = false; game.enemyRespawnAt = now + 2000; game.enemyShots = []; game.playerShots = []; playVeniceGameSound(gameAsteroidAudio, .36); }
  const hitPlayer = game.enemyShots.find(item => distanceToVeniceShotPath(item, player) <= 4.8);
  if (hitPlayer) { game.enemyShots = game.enemyShots.filter(item => item !== hitPlayer); game.explosions.push({ x: player.x, y: player.y, at: timestamp }); if (now < game.invulnerableUntil || now < game.shieldUntil) { playVeniceGameSound(gameAsteroidAudio, .18); } else { playVeniceGameSound(gameAsteroidAudio, .4); endVeniceSailingGame(`Your ship was hit. Final score: ${game.score}. Press Play to sail again.`); return; } }
  renderVeniceSailingGame(); game.frame = requestAnimationFrame(updateVeniceSailingGame);
}
function launchVeniceSailingGame() { clearTimeout(veniceSailingGame.restartTimer); cancelAnimationFrame(veniceSailingGame.frame); resetVeniceSailingGame(); veniceSailingGame.started = true; renderVeniceSailingGame(); veniceSailingGame.frame = requestAnimationFrame(updateVeniceSailingGame); }
function stopVeniceSailingGame() { clearTimeout(veniceSailingGame.restartTimer); cancelAnimationFrame(veniceSailingGame.frame); veniceSailingGame.frame = 0; veniceSailingGame.started = false; veniceSailingGame.host = null; }
function mountVeniceSailingGame() { const host = stream?.querySelector('.account-sailing-game-host'); if (!host) return stopVeniceSailingGame(); veniceSailingGame.host = host; renderVeniceSailingGame(); }
document.addEventListener('click', event => { if (event.target.closest('[data-venice-sailing-play]')) { launchVeniceSailingGame(); return; } if (event.target.closest('[data-venice-sailing-left]')) { moveVeniceSailingShip(-1); return; } if (event.target.closest('[data-venice-sailing-right]')) { moveVeniceSailingShip(1); return; } if (event.target.closest('[data-venice-sailing-fire]')) { fireVeniceCannon(); return; } if (event.target.closest('[data-venice-sailing-shield]')) activateVeniceShield(); });
document.addEventListener('keydown', event => { if (!veniceSailingGame.started || !document.body.classList.contains('app-section-account') || !canUseAutoScroll(event.target)) return; if (!['BracketLeft', 'BracketRight', 'Equal', 'Backquote'].includes(event.code)) return; event.preventDefault(); if (event.code === 'BracketLeft') moveVeniceSailingShip(-1); else if (event.code === 'BracketRight') moveVeniceSailingShip(1); else if (!event.repeat && event.code === 'Equal') fireVeniceCannon(); else if (!event.repeat) activateVeniceShield(); });
function syncAuctionWaterfallControl() {
  const head = stream?.querySelector('.auction-head');
  if (!head || !auctionWaterfallAudio) return;
  let control = head.querySelector('[data-auction-waterfall-sound]');
  if (!control) {
    control = document.createElement('button');
    control.type = 'button';
    control.className = 'auction-sound-control';
    control.dataset.auctionWaterfallSound = '';
    head.append(control);
  }
  const playing = !auctionWaterfallAudio.paused;
  control.textContent = playing ? 'Waterfall sound · On' : 'Waterfall sound · Play';
  control.setAttribute('aria-pressed', String(playing));
}
const siteThemeControl = document.querySelector('[data-site-theme-toggle]');
const siteThemePlaylist = [
  { name: 'Finding the Old Docks', src: '/public/finding-the-old-docks.mp3' },
  { name: 'Waves in the Ionosphere', src: '/public/waves-in-the-ionosphere.mp3' }
];
function initializeSiteTheme() {
  if (!siteThemeAudio || !siteThemeControl) return;
  const status = siteThemeControl.querySelector('[data-site-theme-status]'); const action = siteThemeControl.querySelector('[data-site-theme-action]'); const name = siteThemeControl.querySelector('[data-site-theme-name]');
  let activeTrack = Math.floor(Math.random() * siteThemePlaylist.length);
  const setTrack = (index) => {
    activeTrack = index;
    const track = siteThemePlaylist[activeTrack];
    siteThemeAudio.src = track.src;
    if (name) name.textContent = track.name;
    siteThemeAudio.load();
  };
  setTrack(activeTrack);
  siteThemeAudio.muted = localStorage.getItem('collector-marketplace-theme-muted') === 'true';
  const render = () => {
    const paused = siteThemeAudio.paused; const muted = siteThemeAudio.muted;
    if (status) status.textContent = paused ? '— Ready to play' : muted ? '— Muted' : '— Playing';
    if (action) action.textContent = paused ? 'Play' : muted ? 'Unmute' : 'Mute';
    siteThemeControl.classList.toggle('is-muted', muted || paused);
    siteThemeControl.setAttribute('aria-label', paused ? 'Play site theme' : muted ? 'Unmute site theme' : 'Mute site theme');
    siteThemeControl.setAttribute('aria-pressed', String(!paused && !muted));
  };
  const start = () => siteThemeAudio.play().then(render).catch(render);
  const advanceTrack = () => {
    const choices = siteThemePlaylist.map((_, index) => index).filter(index => index !== activeTrack);
    setTrack(choices[Math.floor(Math.random() * choices.length)] ?? activeTrack);
    start();
  };
  siteThemeAudio.addEventListener('play', render); siteThemeAudio.addEventListener('pause', render); siteThemeAudio.addEventListener('volumechange', render);
  siteThemeAudio.addEventListener('ended', advanceTrack);
  siteThemeControl.addEventListener('click', event => {
    if (event.target.closest('[data-site-theme-skip]')) { advanceTrack(); return; }
    if (siteThemeAudio.paused) { siteThemeAudio.muted = false; localStorage.setItem('collector-marketplace-theme-muted', 'false'); start(); return; }
    siteThemeAudio.muted = !siteThemeAudio.muted; localStorage.setItem('collector-marketplace-theme-muted', String(siteThemeAudio.muted)); render();
  });
  // A browser may block sound before any interaction. The first ordinary tap
  // starts the loop in that case; the control remains available either way.
  window.addEventListener('pointerdown', () => { if (siteThemeAudio.paused) start(); }, { once: true, passive: true });
  render(); start();
}
initializeSiteTheme();
let browseMode = localStorage.getItem('collector-marketplace-browse-mode') === 'doomscroll' ? 'doomscroll' : 'conveyor', conveyorFrame = 0, conveyorTimer = 0;
// Keep comma/period keyboard navigation in the same order as the visible scope bar.
const searchScopes = ['listings', 'accounts', 'collectives', 'brands', 'chatrooms', 'couriers'];
const socialScopeMeta = {
  listings: { heading: 'Fresh drops', noun: 'listing' }, accounts: { heading: 'Collector network', noun: 'collector' },
  collectives: { heading: 'Collector groups', noun: 'group' }, brands: { heading: 'Brand communities', noun: 'brand' },
  couriers: { heading: 'Delivery network', noun: 'service' }, chatrooms: { heading: 'Live collector rooms', noun: 'room' }
};
const setSearchScope = (scope, syncRoute = true) => {
  if (!searchScopes.includes(scope)) return;
  searchScope = scope;
  document.querySelectorAll('[data-search-scope]').forEach(button => button.classList.toggle('active', button.dataset.searchScope === searchScope));
  search.placeholder = searchScope === 'listings' ? 'Search collector finds' : searchScope === 'accounts' ? 'Find collectors by name or interest' : searchScope === 'collectives' ? 'Find collector groups and interests' : searchScope === 'brands' ? 'Find brands and their communities' : searchScope === 'couriers' ? 'Find collector-friendly delivery services' : 'Find live collector rooms';
  const marketHeading = document.querySelector('.market-head span');
  if (marketHeading) marketHeading.textContent = socialScopeMeta[searchScope].heading;
  syncBrowseModeUi();
  renderFeed();
  if (syncRoute && typeof syncTagRoute === 'function') syncTagRoute();
};
let activeAuctionId = null, auctionActivity = [], auctionFeedClock, auctionFeedPausedUntil = 0;
let postState = {};
try { postState = JSON.parse(localStorage.getItem('collector-marketplace-post-state') || '{}'); } catch { postState = {}; }
let session = null;
try { session = JSON.parse(localStorage.getItem('collector-marketplace-session') || 'null'); } catch { session = null; }
let checkoutPreferences = { address: '', paymentMethod: 'PayPal', deliveryProvider: '', deliveryPreferenceChosen: false, estimateEnabled: false, coordinates: null };
try { checkoutPreferences = { ...checkoutPreferences, ...JSON.parse(localStorage.getItem('collector-marketplace-checkout-preferences') || '{}') }; } catch { /* retain defaults */ }
if (!checkoutPreferences.deliveryPreferenceChosen) checkoutPreferences.deliveryProvider = '';
const saveCheckoutPreferences = () => localStorage.setItem('collector-marketplace-checkout-preferences', JSON.stringify(checkoutPreferences));
const renderCheckoutPreferenceButtons = () => { const location = document.querySelector('[data-checkout-location]'); const payment = document.querySelector('[data-checkout-payment]'); const delivery = document.querySelector('[data-checkout-delivery]'); const estimate = document.querySelector('[data-checkout-estimate]'); if (location) location.textContent = checkoutPreferences.address ? '⌖ ZIP code set' : checkoutPreferences.coordinates ? '⌖ Current location set' : '⌖ ZIP code'; if (payment) payment.textContent = `Payment · ${checkoutPreferences.paymentMethod || 'PayPal'}`; if (delivery) delivery.textContent = checkoutPreferences.deliveryProvider ? `Delivery · ${checkoutPreferences.deliveryProvider}` : 'Delivery option'; if (estimate) { estimate.classList.toggle('active', Boolean(checkoutPreferences.estimateEnabled)); estimate.setAttribute('aria-pressed', String(Boolean(checkoutPreferences.estimateEnabled))); estimate.textContent = checkoutPreferences.estimateEnabled ? 'BUY EST · ON' : 'BUY EST'; } };
renderCheckoutPreferenceButtons();
let listingDraft = {};
try { listingDraft = JSON.parse(localStorage.getItem('collector-marketplace-listing-draft') || '{}'); } catch { listingDraft = {}; }
const saveListingDraft = form => {
  if (!form?.classList.contains('listing-form')) return;
  const next = {};
  form.querySelectorAll('input:not([type="file"]), textarea, select').forEach(field => {
    if (!field.name || field.type === 'hidden') return;
    if (field.type === 'checkbox' || field.type === 'radio') { if (field.checked) next[field.name] = field.value || 'on'; }
    else next[field.name] = field.value;
  });
  listingDraft = next;
  localStorage.setItem('collector-marketplace-listing-draft', JSON.stringify(next));
};
const restoreListingDraft = form => {
  if (!form?.classList.contains('listing-form')) return;
  Object.entries(listingDraft).forEach(([name, value]) => {
    const fields = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
    fields.forEach(field => { if (field.type === 'checkbox' || field.type === 'radio') field.checked = field.value === value; else field.value = value; });
  });
  const selectedMode = form.querySelector('[name="listingMode"]:checked');
  if (selectedMode?.value !== 'marketplace') selectedMode.dispatchEvent(new Event('change', { bubbles: true }));
  syncListingPreview();
};
let viewerLocation = null;
if (location.pathname === '/' && !location.search && !location.hash) history.replaceState({}, '', '/#browse');

let tagMatchMode = 'any';
let lockedTags = [];
let voidTags = [];
try { lockedTags = JSON.parse(localStorage.getItem('collector-marketplace-locked-tags') || '[]').filter(tag => typeof tag === 'string'); } catch { lockedTags = []; }
try { voidTags = JSON.parse(localStorage.getItem('collector-marketplace-void-tags') || '[]').filter(tag => typeof tag === 'string'); } catch { voidTags = []; }
const tagMatchControl = document.createElement('div');
tagMatchControl.className = 'tag-match-mode';
tagMatchControl.setAttribute('role', 'group');
tagMatchControl.setAttribute('aria-label', 'Tag matching mode');
tagMatchControl.innerHTML = '<button type="button" data-tag-match="any" aria-pressed="true">ANY</button><button type="button" data-tag-match="all" aria-pressed="false">ALL</button>';
tagSearch.closest('.tag-search')?.append(tagMatchControl);
const renderTagMatchMode = () => tagMatchControl.querySelectorAll('[data-tag-match]').forEach(button => { const selected = button.dataset.tagMatch === tagMatchMode; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
renderTagMatchMode();

let tagHoldTimer = null;
let heldTagValue = '';
let suppressTagClick = '';
let hoveredTagValue = '';
const saveLockedTags = () => { localStorage.setItem('collector-marketplace-locked-tags', JSON.stringify(lockedTags)); localStorage.setItem('collector-marketplace-void-tags', JSON.stringify(voidTags)); };
const markLockedTags = () => document.querySelectorAll('#tags [data-tag], #audience-tags [data-tag]').forEach(button => { const value = button.dataset.tag.toLowerCase(); const locked = lockedTags.includes(value); const voided = voidTags.includes(value); button.classList.toggle('locked', locked); button.classList.toggle('void', voided); button.title = locked ? 'Locked tag — hold briefly to unlock' : voided ? 'Void tag — hold briefly to unlock' : 'Click to add or remove. Shift-click adds; Ctrl-click removes. Hold briefly to lock or void.'; button.setAttribute('aria-label', `${button.textContent.trim()}${locked ? ', locked; hold briefly to unlock' : voided ? ', voided; hold briefly to unlock' : '; click toggles selection, Shift adds, Ctrl removes, and holding locks or voids'}`); });
const refreshLockedTagResults = () => { renderTags(); markLockedTags(); if (auctionTagView) refreshTaggedAuction(); else renderFeed(); };
const toggleLockedTag = value => { const locked = lockedTags.includes(value); const voided = voidTags.includes(value); if (locked) lockedTags = lockedTags.filter(tag => tag !== value); else if (voided) voidTags = voidTags.filter(tag => tag !== value); else if (activeTags.includes(value)) { lockedTags = [...lockedTags, value]; activeTags = activeTags.filter(tag => tag !== value); } else voidTags = [...voidTags, value]; saveLockedTags(); reloadTagRoute(); };
new MutationObserver(() => { renderAudienceTags(); markLockedTags(); }).observe(tags, { childList: true });
document.addEventListener('pointerdown', event => { const tag = event.target.closest('[data-tag]'); if (!tag || event.button !== 0) return; heldTagValue = tag.dataset.tag.toLowerCase(); tagHoldTimer = setTimeout(() => { suppressTagClick = heldTagValue; toggleLockedTag(heldTagValue); navigator.vibrate?.(35); }, 450); });
document.addEventListener('pointerup', () => { clearTimeout(tagHoldTimer); tagHoldTimer = null; });
document.addEventListener('pointercancel', () => { clearTimeout(tagHoldTimer); tagHoldTimer = null; });
document.addEventListener('click', event => { const tag = event.target.closest('[data-tag]'); if (!tag) return; const value = tag.dataset.tag.toLowerCase(); if (suppressTagClick === value || lockedTags.includes(value) || voidTags.includes(value)) { event.preventDefault(); event.stopImmediatePropagation(); suppressTagClick = ''; } }, true);
document.addEventListener('change', event => {
  if (event.target.name !== 'listingMode') return;
  const form = event.target.closest('.listing-form'); const details = form?.querySelector('.auction-listing-details');
  if (!details) return;
  const enabled = event.target.value !== 'marketplace';
  details.hidden = !enabled;
  details.querySelector('[name="auctionStartPrice"]')?.toggleAttribute('required', enabled);
  const fixedPrice = form.querySelector('[name="price"]');
  if (fixedPrice) fixedPrice.required = event.target.value !== 'auction_only';
});
const applyHoverTagModifier = event => { if (!hoveredTagValue || (!event.ctrlKey && !event.metaKey && !event.shiftKey) || lockedTags.includes(hoveredTagValue) || voidTags.includes(hoveredTagValue)) return; if (event.shiftKey) { if (activeTags.includes(hoveredTagValue)) return; activeTags = [...activeTags, hoveredTagValue]; reloadTagRoute(); return; } if (!activeTags.includes(hoveredTagValue)) return; activeTags = activeTags.filter(tag => tag !== hoveredTagValue); reloadTagRoute(); };
document.addEventListener('pointerover', event => { const tag = event.target.closest('[data-tag]'); if (!tag) return; hoveredTagValue = tag.dataset.tag.toLowerCase(); applyHoverTagModifier(event); });
document.addEventListener('pointerout', event => { const tag = event.target.closest('[data-tag]'); if (tag && tag.dataset.tag.toLowerCase() === hoveredTagValue) hoveredTagValue = ''; });
document.addEventListener('keydown', event => { if (['Control', 'Meta', 'Shift'].includes(event.key)) applyHoverTagModifier(event); });

/* NumPad cursor for the full platform. 8/4/6/2 move cardinally, 7/9/1/3
   move diagonally, and 5 activates the focused control. */
const numpadDirections = { Numpad8: [0, -1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad2: [0, 1], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1] };
let platformCursorTarget = null;
let numpadCursorEnabled = false;
const numpadCursor = document.createElement('div');
numpadCursor.id = 'numpad-cursor'; numpadCursor.hidden = true; numpadCursor.setAttribute('aria-hidden', 'true'); document.body.append(numpadCursor);
const platformCursorTargets = () => [...(modal.open ? modal : document).querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"]')].filter(element => element.getClientRects().length && !element.closest('[hidden], [aria-hidden="true"]'));
const renderNumpadCursor = () => { if (!numpadCursorEnabled || !platformCursorTarget?.isConnected) { numpadCursor.hidden = true; return; } const rect = platformCursorTarget.getBoundingClientRect(); numpadCursor.hidden = !rect.width || !rect.height; numpadCursor.style.left = `${rect.left}px`; numpadCursor.style.top = `${rect.top}px`; numpadCursor.style.width = `${rect.width}px`; numpadCursor.style.height = `${rect.height}px`; };
const trackPlatformTarget = target => { platformCursorTarget = target || null; target?.focus({ preventScroll: true }); requestAnimationFrame(renderNumpadCursor); };
const focusPlatformTarget = target => { trackPlatformTarget(target); target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); };
const setNumpadCursorEnabled = enabled => {
  numpadCursorEnabled = enabled;
  document.body.classList.toggle('numpad-cursor-enabled', enabled);
  if (!enabled) return renderNumpadCursor();
  const targets = platformCursorTargets();
  const rect = platformCursorTarget?.getBoundingClientRect();
  const targetIsVisible = targets.includes(platformCursorTarget) && rect && rect.bottom > 10 && rect.top < window.innerHeight - 10;
  if (targetIsVisible) return trackPlatformTarget(platformCursorTarget);
  // Re-enable exactly where the collector is reading; never scroll the page
  // merely because Num Lock was switched back on.
  moveNumpadCursorToViewport('top');
};
const nextPlatformTarget = (current, direction, targets) => {
  const currentRect = current.getBoundingClientRect(); const currentX = currentRect.left + currentRect.width / 2; const currentY = currentRect.top + currentRect.height / 2; const [moveX, moveY] = direction;
  const candidates = targets.filter(target => { if (target === current) return false; const rect = target.getBoundingClientRect(); const x = rect.left + rect.width / 2 - currentX; const y = rect.top + rect.height / 2 - currentY; return (!moveX || x * moveX > 2) && (!moveY || y * moveY > 2); });
  return candidates.sort((left, right) => { const score = target => { const rect = target.getBoundingClientRect(); const x = rect.left + rect.width / 2 - currentX; const y = rect.top + rect.height / 2 - currentY; const forward = Math.abs(moveX ? x : y); const cross = Math.abs(moveX ? y : x); return moveX && moveY ? Math.hypot(x, y) + Math.abs(Math.abs(x) - Math.abs(y)) * .65 : forward + cross * 4; }; return score(left) - score(right); })[0];
};
const toggleNumpadTagState = (target, state) => {
  const tag = target?.closest?.('[data-tag]'); if (!tag) return false;
  const value = tag.dataset.tag.toLowerCase();
  activeTags = activeTags.filter(activeTag => activeTag !== value);
  if (state === 'locked') { voidTags = voidTags.filter(voidTag => voidTag !== value); lockedTags = lockedTags.includes(value) ? lockedTags.filter(lockedTag => lockedTag !== value) : [...lockedTags, value]; }
  else { lockedTags = lockedTags.filter(lockedTag => lockedTag !== value); voidTags = voidTags.includes(value) ? voidTags.filter(voidTag => voidTag !== value) : [...voidTags, value]; }
  saveLockedTags(); reloadTagRoute();
  requestAnimationFrame(() => focusPlatformTarget(platformCursorTargets().find(button => button.dataset?.tag?.toLowerCase() === value) || platformCursorTargets()[0]));
  return true;
};
document.addEventListener('keydown', event => {
  if (event.code === 'NumLock' || event.key === 'NumLock') { const reportedState = event.getModifierState?.('NumLock'); setNumpadCursorEnabled(typeof reportedState === 'boolean' && reportedState !== numpadCursorEnabled ? reportedState : !numpadCursorEnabled); return; }
  const direction = numpadDirections[event.code];
  if (typeof event.getModifierState?.('NumLock') === 'boolean' && event.getModifierState('NumLock') !== numpadCursorEnabled) setNumpadCursorEnabled(event.getModifierState('NumLock'));
  const tagState = event.code === 'NumpadAdd' ? 'locked' : event.code === 'NumpadSubtract' ? 'void' : '';
  const isNumpadKey = event.code.startsWith('Numpad');
  if (!numpadCursorEnabled || !isNumpadKey) return;
  // Reserve the physical NumPad for the marketplace cursor so the browser,
  // page, and focused form controls never also perform their native action.
  event.preventDefault();
  event.stopImmediatePropagation();
  if ((!direction && event.code !== 'Numpad5' && !tagState) || event.repeat) return;
  const targets = platformCursorTargets(); if (!targets.length) return;
  const focused = document.activeElement instanceof Element ? document.activeElement : null;
  const current = targets.includes(focused) ? focused : targets.includes(platformCursorTarget) ? platformCursorTarget : targets[0];
  if (tagState) { if (!toggleNumpadTagState(current, tagState)) return; return; }
  if (event.code === 'Numpad5') {
    if (focused !== current) return focusPlatformTarget(current);
    const activatedTarget = current;
    const activatedTag = activatedTarget.dataset?.tag?.toLowerCase() || '';
    current.click();
    requestAnimationFrame(() => {
      const availableTargets = platformCursorTargets();
      const replacementTag = activatedTag && availableTargets.find(target => target.dataset?.tag?.toLowerCase() === activatedTag);
      focusPlatformTarget(availableTargets.includes(activatedTarget) ? activatedTarget : (replacementTag || (availableTargets.includes(platformCursorTarget) ? platformCursorTarget : availableTargets[0])));
    });
    return;
  }
  focusPlatformTarget(nextPlatformTarget(current, direction, targets) || current);
});
const moveNumpadCursorToViewport = (edge = 'top') => {
  if (!numpadCursorEnabled || modal.open) return requestAnimationFrame(renderNumpadCursor);
  const visible = platformCursorTargets().filter(target => {
    if (target.closest('.masthead, .bottom-nav')) return false;
    const rect = target.getBoundingClientRect();
    return rect.bottom > 10 && rect.top < window.innerHeight - 10;
  });
  if (!visible.length) return requestAnimationFrame(renderNumpadCursor);
  const next = visible.sort((left, right) => {
    const leftRect = left.getBoundingClientRect(); const rightRect = right.getBoundingClientRect();
    return edge === 'top' ? leftRect.top - rightRect.top : rightRect.bottom - leftRect.bottom;
  })[0];
  trackPlatformTarget(next);
};
const followNumpadCursorWhileScrolling = () => {
  if (!numpadCursorEnabled || !autoScrollActive || modal.open) return requestAnimationFrame(renderNumpadCursor);
  const currentRect = platformCursorTarget?.getBoundingClientRect();
  const currentIsPersistent = platformCursorTarget?.closest('.masthead, .bottom-nav');
  const currentVisible = currentRect && currentRect.bottom > 10 && currentRect.top < window.innerHeight - 10;
  if (currentVisible && !currentIsPersistent) return requestAnimationFrame(renderNumpadCursor);
  moveNumpadCursorToViewport(autoScrollDirection > 0 ? 'top' : 'bottom');
};
window.addEventListener('scroll', followNumpadCursorWhileScrolling, { passive: true });
window.addEventListener('resize', renderNumpadCursor);

/* Hold ↑ or ↓ to move through the marketplace continuously. Form fields and
   full-screen workspaces keep their normal keyboard behavior. */
const heldScrollKeys = new Set();
let heldScrollFrame = 0;
const canUseHeldScroll = target => {
  if (modal.open) return false;
  /* Tags mode focuses its empty search box automatically; arrows should still
     browse the full tag catalogue until the collector begins typing. */
  if (target === tagSearch && !tagSearch.value) return true;
  return !(target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]'));
};
const runHeldScroll = () => {
  const direction = heldScrollKeys.has('ArrowDown') ? 1 : heldScrollKeys.has('ArrowUp') ? -1 : 0;
  if (!direction) { heldScrollFrame = 0; return; }
  window.scrollBy({ top: direction * 18, left: 0, behavior: 'auto' });
  heldScrollFrame = requestAnimationFrame(runHeldScroll);
};
document.addEventListener('keydown', event => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !canUseHeldScroll(event.target)) return;
  event.preventDefault();
  heldScrollKeys.add(event.key);
  if (!heldScrollFrame) heldScrollFrame = requestAnimationFrame(runHeldScroll);
});
document.addEventListener('keyup', event => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  heldScrollKeys.delete(event.key);
});
window.addEventListener('blur', () => { heldScrollKeys.clear(); });

/* Space toggles a gentle hands-free feed scroll. Alt immediately returns to
   the top; neither shortcut takes over while a collector is typing or using a
   full-screen workspace. */
let autoScrollActive = false;
let autoScrollFrame = 0;
let autoScrollDirection = 1;
const canUseAutoScroll = target => !modal.open && !(target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]'));
const stopAutoScroll = () => {
  autoScrollActive = false;
  if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
  autoScrollFrame = 0;
  document.body.classList.remove('auto-scroll-active');
};
const runAutoScroll = () => {
  if (!autoScrollActive || modal.open || document.hidden) return stopAutoScroll();
  const before = window.scrollY;
  window.scrollBy({ top: autoScrollDirection * 3.5, left: 0, behavior: 'auto' });
  const atEdge = autoScrollDirection > 0 ? window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 : window.scrollY <= 0;
  if (atEdge && window.scrollY === before) return stopAutoScroll();
  autoScrollFrame = requestAnimationFrame(runAutoScroll);
};
const toggleAutoScroll = () => {
  if (autoScrollActive) return stopAutoScroll();
  autoScrollActive = true;
  document.body.classList.add('auto-scroll-active');
  autoScrollFrame = requestAnimationFrame(runAutoScroll);
};
const reverseAutoScroll = () => {
  autoScrollDirection *= -1;
  if (!autoScrollActive) toggleAutoScroll();
};
function stopConveyor() { if (conveyorFrame) cancelAnimationFrame(conveyorFrame); if (conveyorTimer) clearInterval(conveyorTimer); conveyorFrame = 0; conveyorTimer = 0; }
function runConveyor() {
  if (browseMode !== 'conveyor' || searchScope !== 'listings' || modal.open || document.body.classList.contains('auction-mode')) { stopConveyor(); return; }
  const first = stream.querySelector('.listing:not([data-conveyor-copy])');
  const copy = stream.querySelector('[data-conveyor-copy]');
  const loopWidth = first && copy ? copy.offsetLeft - first.offsetLeft : 0;
  if (loopWidth > 0) {
    const laneStart = loopWidth;
    const laneEnd = loopWidth * 2;
    const lanePosition = stream.scrollLeft < laneStart || stream.scrollLeft >= laneEnd ? laneStart + (stream.scrollLeft % loopWidth) : stream.scrollLeft;
    const next = lanePosition + 1.5;
    stream.scrollLeft = next >= laneEnd ? next - loopWidth : next;
  } else {
    const next = stream.scrollLeft + 1.5;
    const scrollLimit = Math.max(0, stream.scrollWidth - stream.clientWidth);
    if (scrollLimit > 0) stream.scrollLeft = next >= scrollLimit ? 0 : next;
  }
}
function startConveyor() {
  stopConveyor();
  if (browseMode === 'conveyor' && searchScope === 'listings') {
    const first = stream.querySelector('.listing:not([data-conveyor-copy])');
    const copy = stream.querySelector('[data-conveyor-copy]');
    stream.scrollTo({ left: first && copy ? copy.offsetLeft - first.offsetLeft : 0, behavior: 'auto' });
    conveyorTimer = setInterval(runConveyor, 16);
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && browseMode === 'conveyor' && searchScope === 'listings' && !modal.open && !document.body.classList.contains('auction-mode')) startConveyor();
});
const zodiacConstellations = [
  // Distinct traditional sky-pattern silhouettes: ram, bull horns, twins,
  // crab, lion sickle, maiden, scales, scorpion hook, teapot, sea-goat,
  // water waves, and the two fish joined by a cord.
  ['Aries', ['24,94 66,55 110,72 156,30'], 5, 22, 31, 2],
  ['Taurus', ['30,90 84,48 138,74 188,50', '84,48 65,20', '84,48 122,18'], 24, 69, 36, 8],
  ['Gemini', ['35,22 64,50 50,94 30,116', '128,22 156,51 147,94 177,116', '64,50 156,51'], 48, 78, 33, 13],
  ['Cancer', ['22,88 61,51 102,72 143,34 193,61'], 72, 65, 41, 6],
  ['Leo', ['20,95 51,61 88,72 112,40 135,66 116,98 154,110 200,76'], 78, 17, 38, 16],
  ['Virgo', ['22,38 57,64 86,30 116,72 151,46 180,95', '116,72 92,112'], 53, 41, 44, 10],
  ['Libra', ['32,37 90,30 152,59 99,101 32,37', '99,101 176,103'], 8, 48, 35, 19],
  ['Scorpio', ['20,28 52,56 86,43 117,76 148,65 179,104 205,95'], 37, 7, 40, 4],
  ['Sagittarius', ['42,85 72,44 129,43 159,84 42,85', '72,44 53,20', '129,43 155,20', '159,84 199,99'], 62, 50, 42, 14],
  ['Capricorn', ['22,42 61,74 101,38 140,90 180,56', '61,74 83,111 140,90'], 14, 81, 39, 11],
  ['Aquarius', ['20,39 51,63 82,42 113,67 145,46 177,70', '20,78 51,102 82,81 113,106 145,85 177,109'], 83, 45, 37, 7],
  ['Pisces', ['20,52 46,26 75,51 49,79 20,52', '133,53 162,23 195,51 163,81 133,53', '75,51 133,53'], 38, 26, 45, 18]
];

function zodiacSkyMarkup() {
  return zodiacConstellations.map(([sign, lines, top, left, duration, delay]) => {
    const stars = [...new Set(lines.flatMap(points => points.split(' ')))].map(pair => { const [cx, cy] = pair.split(','); return `<circle cx="${cx}" cy="${cy}" r="2.7"/>`; }).join('');
    const paths = lines.map(points => `<polyline points="${points}"/>`).join('');
    return `<svg class="conveyor-constellation zodiac-constellation zodiac-${sign.toLowerCase()}" aria-label="${sign} constellation" style="--z-top:${top}%;--z-left:${left}%;--z-duration:${duration}s;--z-delay:-${delay}s" viewBox="0 0 225 130">${paths}${stars}</svg>`;
  }).join('');
}

const conveyorRocket = { node: null, frame: 0, x: 50, y: 76, vx: .055, vy: -.025, angle: 0, keys: new Set() };
const conveyorRocketGame = { layer: null, hud: null, started: false, score: 0, highScore: Number(localStorage.getItem('collector-marketplace-star-run-high-score') || 0), hull: 3, asteroids: [], enemies: [], lasers: [], enemyLasers: [], lastAsteroid: 0, lastEnemy: 0, lastScore: 0, lastShot: 0, lastHit: 0 };
const rocketControlCodes = new Set(['Equal', 'BracketLeft', 'BracketRight', 'ArrowLeft', 'ArrowRight', 'Backquote']);
const pauseRocketBoost = () => { if (!rocketBoostAudio) return; rocketBoostAudio.pause(); rocketBoostAudio.currentTime = 0; };
const playRocketBoost = () => { if (!rocketBoostAudio || !rocketBoostAudio.paused) return; rocketBoostAudio.volume = .46; rocketBoostAudio.play().catch(() => {}); };
const playGameEffect = (source, volume = .5) => { if (!source?.src) return; const effect = new Audio(source.currentSrc || source.src); effect.volume = volume; effect.play().catch(() => {}); };
const rocketDistance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
const rocketRandom = (min, max) => min + Math.random() * (max - min);
function startRocketGame(node) {
  const game = conveyorRocketGame;
  game.layer = node.parentElement?.querySelector('.rocket-game-layer') || null;
  game.hud = document.querySelector('.rocket-game-hud');
  game.started = false; node.parentElement?.classList.remove('is-running'); game.score = 0; game.hull = 3; game.asteroids = []; game.enemies = []; game.lasers = []; game.enemyLasers = [];
  game.lastAsteroid = 0; game.lastEnemy = 0; game.lastScore = Date.now(); game.lastShot = 0; game.lastHit = 0;
  renderRocketGameHud();
}
function renderRocketGameHud() {
  const game = conveyorRocketGame; if (!game.hud) return;
  if (!game.started) { game.hud.innerHTML = `<button type="button" data-star-run-play title="Press Play to launch STAR RUN">▶ STAR RUN · PLAY</button><small>HIGH ${String(game.highScore).padStart(6, '0')}</small>`; return; }
  game.hud.innerHTML = `<b>STAR RUN</b><span>SCORE ${String(game.score).padStart(6, '0')} · HIGH ${String(game.highScore).padStart(6, '0')}</span><small>HULL ${'●'.repeat(game.hull)}${'○'.repeat(3 - game.hull)}</small><em><strong>[</strong> <strong>]</strong> TURN · <strong>=</strong> BOOST · <strong>\`</strong> LASER</em>`;
}
function launchStarRun() {
  const game = conveyorRocketGame; if (!game.layer || game.started) return;
  game.started = true; conveyorRocket.node?.parentElement?.classList.add('is-running'); game.score = 0; game.hull = 3; game.asteroids = []; game.enemies = []; game.lasers = []; game.enemyLasers = [];
  game.lastAsteroid = 0; game.lastEnemy = 0; game.lastScore = Date.now(); game.lastShot = 0; game.lastHit = 0;
  renderRocketGameHud();
}
function spawnRocketAsteroid() { const radius = rocketRandom(1.3, 2.8); conveyorRocketGame.asteroids.push({ x: rocketRandom(2, 98), y: -radius * 2, vx: rocketRandom(-.055, .055), vy: rocketRandom(.045, .11), radius, spin: rocketRandom(-4, 4), rotation: rocketRandom(0, 360) }); }
function spawnRocketEnemy() { const fromLeft = Math.random() > .5; conveyorRocketGame.enemies.push({ x: fromLeft ? -4 : 104, y: rocketRandom(9, 78), vx: fromLeft ? rocketRandom(.055, .09) : rocketRandom(-.09, -.055), vy: rocketRandom(-.025, .025), rotation: 0, nextShot: Date.now() + rocketRandom(2200, 4800) }); }
function hitRocket() {
  const game = conveyorRocketGame; const now = Date.now(); if (now - game.lastHit < 900) return;
  game.lastHit = now; game.hull -= 1; playGameEffect(gameSpaceshipExplosionAudio, .56); conveyorRocket.node?.classList.add('is-hit'); setTimeout(() => conveyorRocket.node?.classList.remove('is-hit'), 420);
  if (game.hull > 0) return;
  game.score = 0; game.hull = 3; game.asteroids = []; game.enemies = []; game.enemyLasers = [];
  conveyorRocket.x = 50; conveyorRocket.y = 76; conveyorRocket.vx = .055; conveyorRocket.vy = -.025;
}
function fireRocketLaser() {
  const game = conveyorRocketGame; const now = Date.now(); if (!game.started || !game.layer || now - game.lastShot < 180) return;
  game.lastShot = now; playGameEffect(gameLaserAudio, .32); const radians = conveyorRocket.angle * Math.PI / 180;
  game.lasers.push({ x: conveyorRocket.x + Math.sin(radians) * 3, y: conveyorRocket.y - Math.cos(radians) * 3, vx: Math.sin(radians) * .92 + conveyorRocket.vx, vy: -Math.cos(radians) * .92 + conveyorRocket.vy, rotation: conveyorRocket.angle });
}
function updateRocketGame() {
  const game = conveyorRocketGame; const now = Date.now(); if (!game.layer?.isConnected) return;
  if (now - game.lastAsteroid > 740 && game.asteroids.length < 15) { spawnRocketAsteroid(); game.lastAsteroid = now; }
  if (now - game.lastEnemy > 5200 && game.enemies.length < 3) { spawnRocketEnemy(); game.lastEnemy = now; }
  if (now - game.lastScore > 650) { game.score += 1; game.lastScore = now; }
  game.asteroids.forEach(asteroid => { asteroid.x += asteroid.vx; asteroid.y += asteroid.vy; asteroid.rotation += asteroid.spin; });
  game.asteroids = game.asteroids.filter(asteroid => asteroid.y < 106 && asteroid.x > -7 && asteroid.x < 107);
  game.enemies.forEach(enemy => { enemy.y += Math.sign(conveyorRocket.y - enemy.y) * .01 + enemy.vy; enemy.x += enemy.vx; if (now >= enemy.nextShot) { const length = Math.max(.01, rocketDistance(conveyorRocket, enemy)); game.enemyLasers.push({ x: enemy.x, y: enemy.y, vx: (conveyorRocket.x - enemy.x) / length * .36, vy: (conveyorRocket.y - enemy.y) / length * .36, rotation: Math.atan2(conveyorRocket.x - enemy.x, -(conveyorRocket.y - enemy.y)) * 180 / Math.PI }); enemy.nextShot = now + rocketRandom(2900, 5100); } });
  game.enemies = game.enemies.filter(enemy => enemy.x > -8 && enemy.x < 108 && enemy.y > -8 && enemy.y < 108);
  game.lasers.forEach(laser => { laser.x += laser.vx; laser.y += laser.vy; }); game.enemyLasers.forEach(laser => { laser.x += laser.vx; laser.y += laser.vy; });
  game.lasers = game.lasers.filter(laser => laser.x > -4 && laser.x < 104 && laser.y > -4 && laser.y < 104); game.enemyLasers = game.enemyLasers.filter(laser => laser.x > -4 && laser.x < 104 && laser.y > -4 && laser.y < 104);
  for (let index = game.lasers.length - 1; index >= 0; index--) { const laser = game.lasers[index]; const asteroidIndex = game.asteroids.findIndex(asteroid => rocketDistance(laser, asteroid) < asteroid.radius + .7); const enemyIndex = game.enemies.findIndex(enemy => rocketDistance(laser, enemy) < 2.5); if (asteroidIndex >= 0) { game.asteroids.splice(asteroidIndex, 1); game.lasers.splice(index, 1); playGameEffect(gameAsteroidAudio, .48); game.score += 10; continue; } if (enemyIndex >= 0) { game.enemies.splice(enemyIndex, 1); game.lasers.splice(index, 1); playGameEffect(gameSpaceshipExplosionAudio, .5); game.score += 50; } }
  if (game.asteroids.some(asteroid => rocketDistance(conveyorRocket, asteroid) < asteroid.radius + 1.8) || game.enemies.some(enemy => rocketDistance(conveyorRocket, enemy) < 3)) hitRocket();
  game.enemyLasers.forEach(laser => { if (rocketDistance(conveyorRocket, laser) < 1.7) hitRocket(); });
  game.layer.innerHTML = `${game.asteroids.map(asteroid => `<i class="rocket-game-asteroid" style="--x:${asteroid.x}%;--y:${asteroid.y}%;--size:${asteroid.radius * 10}px;--spin:${asteroid.rotation}deg"></i>`).join('')}${game.enemies.map(enemy => `<i class="rocket-game-enemy" style="--x:${enemy.x}%;--y:${enemy.y}%;--rotation:${enemy.rotation}deg"></i>`).join('')}${game.lasers.map(laser => `<i class="rocket-game-laser" style="--x:${laser.x}%;--y:${laser.y}%;--rotation:${laser.rotation}deg"></i>`).join('')}${game.enemyLasers.map(laser => `<i class="rocket-game-enemy-laser" style="--x:${laser.x}%;--y:${laser.y}%;--rotation:${laser.rotation}deg"></i>`).join('')}`;
  if (game.score > game.highScore) { game.highScore = game.score; localStorage.setItem('collector-marketplace-star-run-high-score', String(game.highScore)); }
  renderRocketGameHud();
}
function stopConveyorRocket() {
  if (conveyorRocket.frame) cancelAnimationFrame(conveyorRocket.frame);
  conveyorRocket.frame = 0;
  conveyorRocket.keys.clear();
  conveyorRocket.node = null;
  conveyorRocketGame.layer = null; conveyorRocketGame.hud = null;
  pauseRocketBoost();
}
function flyConveyorRocket() {
  const rocket = conveyorRocket;
  if (!rocket.node?.isConnected) return stopConveyorRocket();
  if (!conveyorRocketGame.started) { rocket.node.classList.remove('is-thrusting'); rocket.node.style.setProperty('--rocket-x', `${rocket.x}%`); rocket.node.style.setProperty('--rocket-y', `${rocket.y}%`); rocket.node.style.setProperty('--rocket-tilt', `${rocket.angle}deg`); rocket.frame = requestAnimationFrame(flyConveyorRocket); return; }
  if (rocket.keys.has('BracketLeft') || rocket.keys.has('ArrowLeft')) rocket.angle -= 4.25;
  if (rocket.keys.has('BracketRight') || rocket.keys.has('ArrowRight')) rocket.angle += 4.25;
  rocket.angle = (rocket.angle + 360) % 360;
  const radians = rocket.angle * Math.PI / 180;
  const thrust = rocket.keys.has('Equal') ? .014 : .0009;
  rocket.vx = (rocket.vx + Math.sin(radians) * thrust) * .985;
  rocket.vy = (rocket.vy - Math.cos(radians) * thrust) * .985;
  const speed = Math.hypot(rocket.vx, rocket.vy);
  if (speed > .27) { rocket.vx = rocket.vx / speed * .27; rocket.vy = rocket.vy / speed * .27; }
  rocket.x = (rocket.x + rocket.vx + 100) % 100;
  rocket.y += rocket.vy;
  if (rocket.y < 5) rocket.y = 91;
  if (rocket.y > 91) rocket.y = 5;
  rocket.node.style.setProperty('--rocket-x', `${rocket.x}%`);
  rocket.node.style.setProperty('--rocket-y', `${rocket.y}%`);
  rocket.node.style.setProperty('--rocket-tilt', `${rocket.angle}deg`);
  rocket.node.classList.add('is-cruising');
  rocket.node.classList.toggle('is-thrusting', rocket.keys.has('Equal'));
  updateRocketGame();
  rocket.frame = requestAnimationFrame(flyConveyorRocket);
}
function startConveyorRocket(node) {
  if (!node) return stopConveyorRocket();
  if (conveyorRocket.node !== node) { stopConveyorRocket(); conveyorRocket.node = node; startRocketGame(node); }
  if (!conveyorRocket.frame) conveyorRocket.frame = requestAnimationFrame(flyConveyorRocket);
}
document.addEventListener('keydown', event => {
  const laserKey = event.code === 'Backquote' || event.key === '`';
  if ((!rocketControlCodes.has(event.code) && !laserKey) || !conveyorRocketGame.started || !document.body.classList.contains('browse-conveyor') || !canUseAutoScroll(event.target)) return;
  event.preventDefault();
  if (laserKey) { fireRocketLaser(); return; }
  const isNewBoost = event.code === 'Equal' && !conveyorRocket.keys.has('Equal');
  conveyorRocket.keys.add(event.code);
  if (isNewBoost) playRocketBoost();
});
document.addEventListener('keyup', event => { if (!rocketControlCodes.has(event.code) && event.key !== '`') return; conveyorRocket.keys.delete(event.code); if (event.code === 'Equal') pauseRocketBoost(); });
window.addEventListener('blur', () => { conveyorRocket.keys.clear(); pauseRocketBoost(); });
document.addEventListener('click', event => { if (event.target.closest('[data-star-run-play]')) launchStarRun(); });

// Puppy Jump is a light Doodle-Jump-style counterpoint to the space game.
// It only exists while collectors are browsing in Doomscroll mode.
const puppyJump = { node: null, frame: 0, x: 50, y: 82, vx: 0, vy: 0, keys: new Set() };
const puppyJumpGame = { layer: null, hud: null, started: false, score: 0, highScore: Number(localStorage.getItem('collector-marketplace-puppy-jump-high-score') || 0), platforms: [], angries: [], lasers: [], jumps: 2, lastHud: 0, lastAngry: 0, lastShot: 0, lastJump: 0, jumpHeld: false, invulnerableUntil: 0, combo: 0, restarting: false, restartTimer: 0 };
const puppyControlCodes = new Set(['BracketLeft', 'BracketRight', 'Equal', 'Backquote']);
const puppyRandom = (min, max) => min + Math.random() * (max - min);
function puppyStartingPlatforms() {
  return [
    { x: 50, y: 93, width: 27, vx: .035 }, { x: 28, y: 81, width: 24, vx: -.035 },
    { x: 67, y: 68, width: 25, vx: .045 }, { x: 36, y: 55, width: 23, vx: -.04 },
    { x: 72, y: 42, width: 25, vx: .035 }, { x: 45, y: 29, width: 24, vx: -.04 }, { x: 76, y: 16, width: 23, vx: .035 }
  ];
}
function renderPuppyJumpHud() {
  const game = puppyJumpGame; if (!game.hud) return;
  if (game.restarting) {
    game.hud.innerHTML = `<b>PUPPY JUMP</b><span>RUN COMPLETE · ${String(game.score).padStart(6, '0')}</span><small>NEW CLOUD RUN STARTING…</small>`;
    return;
  }
  if (!game.started) {
    game.hud.innerHTML = `<button type="button" data-puppy-jump-play title="Start Puppy Jump">🐾 PUPPY JUMP · PLAY</button><small>HIGH ${String(game.highScore).padStart(6, '0')}</small>`;
    return;
  }
  game.hud.innerHTML = `<b>PUPPY JUMP</b><span>SCORE ${String(game.score).padStart(6, '0')} · HIGH ${String(game.highScore).padStart(6, '0')}</span><small>☁ AUTO-BOUNCE · ${game.jumps ? '= AIR BOOST READY' : 'FIND A CLOUD'}</small><em><strong>[</strong> <strong>]</strong> MOVE · <strong>=</strong> AIR BOOST · <strong>\`</strong> LASER</em>`;
}
function resetPuppyJump() {
  const game = puppyJumpGame;
  // Start just above the first cloud so Play immediately gives the puppy a
  // stable landing instead of dropping the player into an empty lane.
  puppyJump.x = 50; puppyJump.y = 84; puppyJump.vx = 0; puppyJump.vy = -1.08;
  game.score = 0; game.platforms = puppyStartingPlatforms(); game.angries = []; game.lasers = []; game.jumps = 1; game.lastHud = 0; game.lastAngry = 0; game.lastShot = 0; game.lastJump = 0; game.jumpHeld = false; game.combo = 0; game.invulnerableUntil = Date.now() + 1800;
}
function startPuppyJump(node) {
  if (!node) return stopPuppyJump();
  if (puppyJump.node !== node) {
    stopPuppyJump(); puppyJump.node = node; puppyJumpGame.layer = node.parentElement?.querySelector('.puppy-game-layer') || null; puppyJumpGame.hud = document.querySelector('.puppy-game-hud'); puppyJumpGame.started = false; resetPuppyJump(); renderPuppyJumpHud();
  }
  if (!puppyJump.frame) puppyJump.frame = requestAnimationFrame(flyPuppyJump);
}
function launchPuppyJump() {
  const game = puppyJumpGame; if (!game.layer || game.started) return;
  game.started = true; resetPuppyJump(); puppyJump.node?.parentElement?.classList.add('is-running'); renderPuppyJumpHud();
}
function stopPuppyJump() {
  if (puppyJump.frame) cancelAnimationFrame(puppyJump.frame);
  if (puppyJumpGame.restartTimer) clearTimeout(puppyJumpGame.restartTimer);
  puppyJump.frame = 0; puppyJump.keys.clear(); puppyJump.node = null;
  puppyJumpGame.restartTimer = 0; puppyJumpGame.restarting = false;
  puppyJumpGame.layer = null; puppyJumpGame.hud = null; puppyJumpGame.started = false; puppyJumpGame.jumpHeld = false;
}
function finishPuppyJump() {
  const game = puppyJumpGame;
  if (game.restarting) return;
  game.highScore = Math.max(game.highScore, game.score);
  localStorage.setItem('collector-marketplace-puppy-jump-high-score', String(game.highScore));
  game.started = false; game.restarting = true; puppyJump.keys.clear(); puppyJump.node?.parentElement?.classList.remove('is-running'); renderPuppyJumpHud();
  game.restartTimer = setTimeout(() => {
    if (!game.layer?.isConnected || !puppyJump.node?.isConnected || !document.body.classList.contains('browse-doomscroll')) return;
    game.restarting = false; game.restartTimer = 0; game.started = true; resetPuppyJump(); puppyJump.node.parentElement?.classList.add('is-running'); renderPuppyJumpHud();
  }, 900);
}
function spawnPuppyAnger() {
  puppyJumpGame.angries.push({ x: puppyRandom(12, 88), y: -8, vx: puppyRandom(-.08, .08) || .045, drift: puppyRandom(.015, .05) });
  playGameEffect(puppyAngerAudio, .25);
}
function firePuppyLaser() {
  const game = puppyJumpGame; const now = Date.now();
  if (!game.started || now - game.lastShot < 180) return;
  game.lastShot = now;
  playGameEffect(gameLaserAudio, .28);
  game.lasers.push({ x: puppyJump.x, y: puppyJump.y - 5, vy: -1.18 });
}
function jumpPuppy() {
  const game = puppyJumpGame; const now = Date.now();
  if (!game.started || game.jumps <= 0 || game.jumpHeld || now - game.lastJump < 150) return;
  game.jumpHeld = true; game.lastJump = now;
  game.jumps -= 1;
  puppyJump.vy = -1.24;
  playGameEffect(puppyJumpAudio, .3);
  renderPuppyJumpHud();
}
function updatePuppyJump() {
  const game = puppyJumpGame; if (!game.layer) return;
  const priorY = puppyJump.y;
  if (puppyJump.keys.has('BracketLeft')) puppyJump.vx -= .022;
  if (puppyJump.keys.has('BracketRight')) puppyJump.vx += .022;
  puppyJump.vx *= .9; puppyJump.vx = Math.max(-.38, Math.min(.38, puppyJump.vx));
  puppyJump.vy += .039;
  puppyJump.x = (puppyJump.x + puppyJump.vx + 100) % 100;
  puppyJump.y += puppyJump.vy;
  const cloudFall = .022 + Math.min(.04, game.score / 120000);
  game.platforms.forEach(platform => { platform.x += platform.vx; platform.y += cloudFall; if (platform.x < platform.width / 2 + 3 || platform.x > 97 - platform.width / 2) platform.vx *= -1; });
  if (puppyJump.vy > 0) {
    const landing = game.platforms.find(platform => {
      const acrossSeam = Math.min(Math.abs(puppyJump.x - platform.x), 100 - Math.abs(puppyJump.x - platform.x));
      return priorY <= platform.y && puppyJump.y >= platform.y && acrossSeam < platform.width / 2 + 4;
    });
    if (landing) {
      // Clouds rebound the puppy automatically. = is now an optional, clean
      // midair double-jump rather than something that must be spammed.
      puppyJump.y = landing.y - .7; puppyJump.vy = -1.14; game.jumps = 1; game.jumpHeld = false; game.combo += 1; game.score += 10 + Math.min(15, game.combo); playGameEffect(puppyJumpAudio, .18);
    }
  }
  if (puppyJump.y < 40 && puppyJump.vy < 0) {
    const rise = Math.min(.42, 40 - puppyJump.y);
    puppyJump.y += rise;
    game.platforms.forEach(platform => { platform.y += rise; });
    game.score += Math.max(1, Math.round(rise * 3));
  }
  game.platforms = game.platforms.filter(platform => platform.y < 106);
  while (game.platforms.length < 7) {
    const nextY = Math.min(...game.platforms.map(platform => platform.y)) - puppyRandom(10.5, 12.8);
    game.platforms.push({ x: puppyRandom(12, 88), y: nextY, width: puppyRandom(21, 28), vx: puppyRandom(-.055, .055) || .035 });
  }
  const now = Date.now();
  if (now - game.lastAngry > 4600 && game.angries.length < 2) { spawnPuppyAnger(); game.lastAngry = now; }
  game.angries.forEach(angry => { angry.x += angry.vx; angry.y += cloudFall * 1.25 + angry.drift; if (angry.x < 7 || angry.x > 93) angry.vx *= -1; });
  game.angries = game.angries.filter(angry => angry.y < 109);
  game.lasers.forEach(laser => { laser.y += laser.vy; });
  game.lasers = game.lasers.filter(laser => laser.y > -7);
  for (let index = game.lasers.length - 1; index >= 0; index--) {
    const laser = game.lasers[index]; const hit = game.angries.findIndex(angry => Math.hypot(laser.x - angry.x, laser.y - angry.y) < 5.6);
    if (hit >= 0) { game.lasers.splice(index, 1); game.angries.splice(hit, 1); playGameEffect(puppyAngerAudio, .45); game.score += 50; }
  }
  if (now > game.invulnerableUntil && game.angries.some(angry => Math.hypot(puppyJump.x - angry.x, puppyJump.y - angry.y) < 5.2)) finishPuppyJump();
  if (puppyJump.y > 108) finishPuppyJump();
  puppyJump.node.style.setProperty('--puppy-x', `${puppyJump.x}%`);
  puppyJump.node.style.setProperty('--puppy-y', `${puppyJump.y}%`);
  puppyJump.node.classList.toggle('is-hopping', puppyJump.vy < -.15);
  game.layer.innerHTML = `${game.platforms.map(platform => `<i class="puppy-game-cloud" style="--x:${platform.x}%;--y:${platform.y}%;--width:${platform.width}%"></i>`).join('')}${game.angries.map(angry => `<i class="puppy-game-anger" style="--x:${angry.x}%;--y:${angry.y}%"></i>`).join('')}${game.lasers.map(laser => `<i class="puppy-game-laser" style="--x:${laser.x}%;--y:${laser.y}%"></i>`).join('')}`;
  if (game.score > game.highScore) { game.highScore = game.score; localStorage.setItem('collector-marketplace-puppy-jump-high-score', String(game.highScore)); }
  if (Date.now() - game.lastHud > 140) { renderPuppyJumpHud(); game.lastHud = Date.now(); }
}
function flyPuppyJump() {
  if (!puppyJump.node?.isConnected) return stopPuppyJump();
  if (puppyJumpGame.started) updatePuppyJump();
  puppyJump.frame = requestAnimationFrame(flyPuppyJump);
}
document.addEventListener('keydown', event => {
  if (!puppyControlCodes.has(event.code) || !puppyJumpGame.started || !document.body.classList.contains('browse-doomscroll') || !canUseAutoScroll(event.target)) return;
  event.preventDefault();
  if (event.code === 'Backquote') { firePuppyLaser(); return; }
  if (event.code === 'Equal') { if (!event.repeat) jumpPuppy(); return; }
  puppyJump.keys.add(event.code);
});
document.addEventListener('keyup', event => { if (puppyControlCodes.has(event.code)) puppyJump.keys.delete(event.code); if (event.code === 'Equal') puppyJumpGame.jumpHeld = false; });
window.addEventListener('blur', () => { puppyJump.keys.clear(); puppyJumpGame.jumpHeld = false; });
document.addEventListener('click', event => { if (event.target.closest('[data-puppy-jump-play]')) launchPuppyJump(); });

// Auction Falls is a compact falling-block game that lives only on the
// waterfall auction surface. It starts on demand so normal bidding controls
// and keyboard shortcuts remain untouched until the collector presses Play.
const auctionBlocks = { host: null, board: [], piece: null, x: 3, y: 0, timer: 0, started: false, score: 0, highScore: Number(localStorage.getItem('collector-marketplace-auction-falls-high-score') || 0), bombTimers: [], gameOver: false };
const auctionBlockShapes = [
  [[1]],
  [[1, 1]], [[1], [1]],
  [[1, 1, 1]], [[1, 0], [1, 1]], [[1, 1], [1, 0]],
  [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]],
  [[1, 1, 1, 1, 1]], [[1, 0], [1, 0], [1, 1], [1, 0]], [[1, 1, 1], [0, 1, 0], [0, 1, 0]], [[1, 1, 0], [0, 1, 1], [0, 1, 0]]
];
const emptyAuctionBoard = () => Array.from({ length: 16 }, () => Array(10).fill(0));
const rotateAuctionPiece = piece => piece[0].map((_, index) => piece.map(row => row[index]).reverse());
function auctionBlocksCollide(piece = auctionBlocks.piece, x = auctionBlocks.x, y = auctionBlocks.y) {
  return piece.some((row, rowIndex) => row.some((filled, colIndex) => filled && (x + colIndex < 0 || x + colIndex >= 10 || y + rowIndex >= 16 || (y + rowIndex >= 0 && auctionBlocks.board[y + rowIndex][x + colIndex]))));
}
function renderAuctionBlocks() {
  const game = auctionBlocks; if (!game.host?.isConnected) return;
  const display = game.board.map(row => [...row]);
  if (game.piece) game.piece.forEach((row, rowIndex) => row.forEach((filled, colIndex) => { const y = game.y + rowIndex; const x = game.x + colIndex; if (filled && y >= 0 && y < 16 && x >= 0 && x < 10) display[y][x] = 2; }));
  const status = game.started ? '[ ] move · = rotate · ` drops · row bombs appear' : game.gameOver ? 'Water swept the stack away · Play again' : '[ ] move · = rotate · ` drops · row bombs appear';
  game.host.innerHTML = `<section class="auction-block-game"><header><b>AUCTION FALLS</b><span>${String(game.score).padStart(4, '0')} · HI ${String(game.highScore).padStart(4, '0')}</span></header><div class="auction-block-grid" aria-label="Auction Falls game board">${display.flat().map(cell => `<i class="${cell === 2 ? 'is-falling' : cell === 3 ? 'is-bomb' : cell ? 'is-set' : ''}"></i>`).join('')}</div><footer>${game.started ? '<button type="button" data-auction-blocks-pause>Pause</button>' : '<button type="button" data-auction-blocks-play>▶ Play</button>'}<small>⚠ ROW BOMBS DETONATE AUTOMATICALLY</small><small>${status}</small></footer></section>`;
}
function spawnAuctionPiece() {
  auctionBlocks.piece = auctionBlockShapes[Math.floor(Math.random() * auctionBlockShapes.length)].map(row => [...row]);
  auctionBlocks.x = Math.floor((10 - auctionBlocks.piece[0].length) / 2); auctionBlocks.y = 0;
  if (auctionBlocksCollide()) endAuctionBlocks();
}
function settleAuctionPiece() {
  const game = auctionBlocks;
  game.piece.forEach((row, rowIndex) => row.forEach((filled, colIndex) => { const y = game.y + rowIndex; const x = game.x + colIndex; if (filled && y >= 0) game.board[y][x] = 1; }));
  playGameEffect(auctionBlockPlaceAudio, .34);
  const retained = game.board.filter(row => !row.every(Boolean)); const cleared = 16 - retained.length;
  while (retained.length < 16) retained.unshift(Array(10).fill(0));
  game.board = retained; game.score += cleared ? cleared * cleared * 100 : 8; if (cleared) playGameEffect(auctionBlockClearAudio, .46); spawnAuctionPiece(); spawnAuctionRowBomb(); renderAuctionBlocks();
}
function tickAuctionBlocks() { const game = auctionBlocks; if (!game.started) return; if (!auctionBlocksCollide(game.piece, game.x, game.y + 1)) { game.y += 1; renderAuctionBlocks(); } else settleAuctionPiece(); }
function launchAuctionBlocks() {
  const game = auctionBlocks; if (!game.host?.isConnected || game.started) return;
  game.bombTimers.forEach(clearTimeout); game.bombTimers = []; game.board = emptyAuctionBoard(); game.score = 0; game.gameOver = false; game.started = true; spawnAuctionPiece(); clearInterval(game.timer); game.timer = setInterval(tickAuctionBlocks, 560); renderAuctionBlocks();
}
function spawnAuctionRowBomb() {
  const game = auctionBlocks; if (!game.started || Math.random() > .24) return;
  const row = Math.floor(6 + Math.random() * 10); const emptyColumns = game.board[row].map((cell, index) => cell === 0 ? index : -1).filter(index => index >= 0);
  if (!emptyColumns.length) return;
  const column = emptyColumns[Math.floor(Math.random() * emptyColumns.length)]; game.board[row][column] = 3; renderAuctionBlocks();
  const timer = setTimeout(() => { if (!game.started) return; game.board[row] = Array(10).fill(0); game.score += 75; playGameEffect(auctionBlockClearAudio, .56); renderAuctionBlocks(); }, 1250);
  game.bombTimers.push(timer);
}
function endAuctionBlocks() {
  const game = auctionBlocks; clearInterval(game.timer); game.timer = 0; game.started = false; game.gameOver = true; game.highScore = Math.max(game.highScore, game.score); localStorage.setItem('collector-marketplace-auction-falls-high-score', String(game.highScore)); renderAuctionBlocks();
}
function stopAuctionBlocks() { clearInterval(auctionBlocks.timer); auctionBlocks.bombTimers.forEach(clearTimeout); auctionBlocks.bombTimers = []; auctionBlocks.timer = 0; auctionBlocks.started = false; auctionBlocks.piece = null; auctionBlocks.host = null; }
function mountAuctionBlocks() {
  const auctionHouse = stream?.querySelector('.auction-house');
  if (!auctionHouse) return stopAuctionBlocks();
  let host = auctionHouse.querySelector('.auction-block-game-host');
  if (!host) { host = document.createElement('div'); host.className = 'auction-block-game-host'; auctionHouse.append(host); }
  auctionBlocks.host = host;
  if (!auctionBlocks.board.length) auctionBlocks.board = emptyAuctionBoard();
  renderAuctionBlocks();
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-auction-blocks-play]')) { launchAuctionBlocks(); return; }
  if (event.target.closest('[data-auction-blocks-pause]')) { endAuctionBlocks(); auctionBlocks.gameOver = false; renderAuctionBlocks(); }
});
document.addEventListener('keydown', event => {
  const game = auctionBlocks; if (!game.started || !document.body.classList.contains('auction-mode') || !canUseAutoScroll(event.target)) return;
  if (!['BracketLeft', 'BracketRight', 'Equal', 'Backquote'].includes(event.code)) return;
  event.preventDefault();
  if (event.code === 'BracketLeft' && !auctionBlocksCollide(game.piece, game.x - 1, game.y)) game.x -= 1;
  if (event.code === 'BracketRight' && !auctionBlocksCollide(game.piece, game.x + 1, game.y)) game.x += 1;
  if (event.code === 'Equal') { const turned = rotateAuctionPiece(game.piece); if (!auctionBlocksCollide(turned)) game.piece = turned; }
  if (event.code === 'Backquote') while (!auctionBlocksCollide(game.piece, game.x, game.y + 1)) game.y += 1;
  if (event.code === 'Backquote') settleAuctionPiece(); else renderAuctionBlocks();
});

// Canopy Run is an optional little jungle game for the Messages workspace.
// Its controls mirror the other site games without capturing normal typing.
const jungleChatGame = { host: null, timer: 0, started: false, lane: 1, jump: 0, score: 0, highScore: Number(localStorage.getItem('collector-marketplace-canopy-run-high-score') || 0), hazards: [], lastHazard: 0, lastTick: 0, gameOver: false };
function renderJungleChatGame() {
  const game = jungleChatGame; if (!game.host?.isConnected) return;
  const status = game.started ? '[ ] move · = leap · ` swipe' : game.gameOver ? 'Caught in the vines · Play again' : 'Run the canopy between messages';
  game.host.innerHTML = `<section class="jungle-chat-game"><header><b>CANOPY RUN</b><span>${String(game.score).padStart(4, '0')} · HI ${String(game.highScore).padStart(4, '0')}</span></header><div class="jungle-run-field"><i class="jungle-runner ${game.jump ? 'is-jumping' : ''}" style="--lane:${game.lane}">🦜</i>${game.hazards.map(hazard => `<i class="jungle-hazard" style="--lane:${hazard.lane};--y:${hazard.y}%">${hazard.type}</i>`).join('')}</div><footer>${game.started ? '<button type="button" data-jungle-game-stop>Pause</button>' : '<button type="button" data-jungle-game-play>▶ Play</button>'}<small>${status}</small></footer></section>`;
}
function launchJungleChatGame() {
  const game = jungleChatGame; if (!game.host?.isConnected || game.started) return;
  game.started = true; game.gameOver = false; game.lane = 1; game.jump = 0; game.score = 0; game.hazards = []; game.lastHazard = 0; game.lastTick = Date.now(); clearInterval(game.timer); game.timer = setInterval(tickJungleChatGame, 95); renderJungleChatGame();
}
function endJungleChatGame() {
  const game = jungleChatGame; clearInterval(game.timer); game.timer = 0; game.started = false; game.gameOver = true; game.highScore = Math.max(game.highScore, game.score); localStorage.setItem('collector-marketplace-canopy-run-high-score', String(game.highScore)); renderJungleChatGame();
}
function stopJungleChatGame() { clearInterval(jungleChatGame.timer); jungleChatGame.timer = 0; jungleChatGame.started = false; jungleChatGame.hazards = []; jungleChatGame.host = null; }
function tickJungleChatGame() {
  const game = jungleChatGame; if (!game.started) return; const now = Date.now();
  if (now - game.lastHazard > 920) { game.hazards.push({ lane: Math.floor(Math.random() * 3), y: -14, type: Math.random() > .5 ? '🍃' : '🪵' }); game.lastHazard = now; }
  game.hazards.forEach(hazard => { hazard.y += 5.2; }); game.hazards = game.hazards.filter(hazard => hazard.y < 112);
  if (game.jump > 0) game.jump -= 1;
  if (game.hazards.some(hazard => hazard.lane === game.lane && hazard.y > 72 && hazard.y < 95) && !game.jump) return endJungleChatGame();
  if (now - game.lastTick > 220) { game.score += 1; game.lastTick = now; }
  renderJungleChatGame();
}
function mountJungleChatGame() {
  const page = stream?.querySelector('.app-section-page'); if (!page || !document.body.classList.contains('app-section-chat')) return stopJungleChatGame();
  let host = page.querySelector('.jungle-chat-game-host'); if (!host) { host = document.createElement('div'); host.className = 'jungle-chat-game-host'; page.append(host); }
  jungleChatGame.host = host; renderJungleChatGame();
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-jungle-game-play]')) { launchJungleChatGame(); return; }
  if (event.target.closest('[data-jungle-game-stop]')) { endJungleChatGame(); jungleChatGame.gameOver = false; renderJungleChatGame(); }
});
document.addEventListener('keydown', event => {
  const game = jungleChatGame; if (!game.started || !document.body.classList.contains('app-section-chat') || !canUseAutoScroll(event.target)) return;
  if (!['BracketLeft', 'BracketRight', 'Equal', 'Backquote'].includes(event.code)) return;
  event.preventDefault();
  if (event.code === 'BracketLeft') game.lane = Math.max(0, game.lane - 1);
  if (event.code === 'BracketRight') game.lane = Math.min(2, game.lane + 1);
  if (event.code === 'Equal') game.jump = 6;
  if (event.code === 'Backquote') { const target = game.hazards.find(hazard => hazard.lane === game.lane && hazard.y > 24 && hazard.y < 92); if (target) { game.hazards = game.hazards.filter(hazard => hazard !== target); game.score += 12; } }
  renderJungleChatGame();
});

function syncBrowseModeUi() {
  const auctionActive = document.body.classList.contains('auction-mode');
  if (!auctionActive) stopAuctionWaterfall();
  if (!document.body.classList.contains('app-section-chat')) { stopJungleChatGame(); stopJungleChatAmbience(); }
  if (!document.body.classList.contains('app-section-account')) { stopAccountVeniceAmbience(); stopVeniceSailingGame(); }
  if (!document.body.classList.contains('app-section-listing')) { stopSellLavaAmbience(); stopSellLavaGame(); }
  const browseSurface = !document.body.classList.contains('app-section-mode') && !modal.open;
  const conveyor = browseMode === 'conveyor' && searchScope === 'listings' && browseSurface && !auctionActive;
  const doomscroll = browseMode === 'doomscroll' && searchScope === 'listings' && browseSurface && !auctionActive;
  document.body.classList.toggle('browse-conveyor', conveyor);
  document.body.classList.toggle('browse-doomscroll', doomscroll);
  let smog = document.querySelector('.conveyor-smog-layer');
  if (conveyor && !smog) { smog = document.createElement('div'); smog.className = 'conveyor-smog-layer'; smog.setAttribute('aria-hidden', 'true'); smog.innerHTML = '<span></span><span></span><span></span><span></span><span></span>'; document.body.append(smog); }
  if (!conveyor) smog?.remove();
  let orbit = document.querySelector('.conveyor-orbit-layer');
  if (conveyor && !orbit) { orbit = document.createElement('div'); orbit.className = 'conveyor-orbit-layer'; orbit.setAttribute('aria-hidden', 'true'); orbit.innerHTML = `<i></i><i></i><i></i><b class="conveyor-earth"><em></em><em></em></b><svg class="conveyor-constellation constellation-a" viewBox="0 0 240 150"><polyline points="18,104 63,64 112,82 155,34 211,57"/><circle cx="18" cy="104" r="3"/><circle cx="63" cy="64" r="3"/><circle cx="112" cy="82" r="3"/><circle cx="155" cy="34" r="3"/><circle cx="211" cy="57" r="3"/></svg><svg class="conveyor-constellation constellation-b" viewBox="0 0 220 150"><polyline points="20,43 67,80 114,34 160,91 204,56"/><circle cx="20" cy="43" r="3"/><circle cx="67" cy="80" r="3"/><circle cx="114" cy="34" r="3"/><circle cx="160" cy="91" r="3"/><circle cx="204" cy="56" r="3"/></svg>${zodiacSkyMarkup()}`; document.querySelector('.app-shell')?.prepend(orbit); }
  let playfield = document.querySelector('.rocket-game-playfield');
  if (conveyor && !playfield) { playfield = document.createElement('div'); playfield.className = 'rocket-game-playfield'; playfield.setAttribute('aria-hidden', 'true'); playfield.innerHTML = '<div class="rocket-game-layer"></div><div class="conveyor-rocket"><img src="/public/star-run-rocket.png" alt=""></div>'; document.querySelector('.app-shell')?.append(playfield); }
  let gameHud = document.querySelector('.rocket-game-hud');
  if (conveyor && !gameHud) { gameHud = document.createElement('aside'); gameHud.className = 'rocket-game-hud'; gameHud.setAttribute('aria-live', 'off'); document.querySelector('.tag-search-layout')?.append(gameHud); }
  if (conveyor) startConveyorRocket(playfield?.querySelector('.conveyor-rocket')); else { orbit?.remove(); playfield?.remove(); gameHud?.remove(); stopConveyorRocket(); }
  let cloudLayer = document.querySelector('.puppy-cloud-layer');
  if (doomscroll && !cloudLayer) { cloudLayer = document.createElement('div'); cloudLayer.className = 'puppy-cloud-layer'; cloudLayer.setAttribute('aria-hidden', 'true'); cloudLayer.innerHTML = '<i></i><i></i><i></i><i></i><i></i>'; document.body.append(cloudLayer); }
  if (!doomscroll) cloudLayer?.remove();
  let puppyField = document.querySelector('.puppy-game-playfield');
  if (doomscroll && !puppyField) { puppyField = document.createElement('div'); puppyField.className = 'puppy-game-playfield'; puppyField.setAttribute('aria-hidden', 'true'); puppyField.innerHTML = '<div class="puppy-game-layer"></div><div class="puppy-game-pup"><img src="/public/puppy-jump.png" alt=""></div>'; document.querySelector('.app-shell')?.append(puppyField); }
  let puppyHud = document.querySelector('.puppy-game-hud');
  if (doomscroll && !puppyHud) { puppyHud = document.createElement('aside'); puppyHud.className = 'puppy-game-hud'; puppyHud.setAttribute('aria-live', 'off'); document.querySelector('.tag-search-layout')?.append(puppyHud); }
  if (doomscroll) startPuppyJump(puppyField?.querySelector('.puppy-game-pup')); else { puppyField?.remove(); puppyHud?.remove(); stopPuppyJump(); }
  const button = document.querySelector('[data-browse-mode]');
  if (button) { button.disabled = searchScope !== 'listings' || auctionActive; button.firstChild.textContent = browseMode === 'conveyor' ? 'Conveyor ' : 'Doomscroll '; button.setAttribute('aria-label', `Browsing mode: ${browseMode}. Press Q to switch.`); button.setAttribute('aria-pressed', String(browseMode === 'conveyor')); }
  if (conveyor) startConveyor(); else stopConveyor();
}
function toggleBrowseMode() {
  browseMode = browseMode === 'doomscroll' ? 'conveyor' : 'doomscroll';
  localStorage.setItem('collector-marketplace-browse-mode', browseMode);
  stopAutoScroll(); stream.scrollLeft = 0; syncBrowseModeUi(); renderFeed();
}
document.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'q' && searchScope === 'listings' && !document.body.classList.contains('auction-mode') && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && canUseAutoScroll(event.target)) { event.preventDefault(); toggleBrowseMode(); } });
document.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  if (event.key === 'Alt' && !event.ctrlKey && !event.metaKey && canUseAutoScroll(event.target)) {
    event.preventDefault();
    stopAutoScroll();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    moveNumpadCursorToViewport('top');
    return;
  }
  /* Fn is not exposed by most browsers; R gives every collector a reliable
     way to switch the active auto-scroll between forward and backward. */
  if ((event.key === 'Fn' || event.key.toLowerCase() === 'r') && !event.repeat && canUseAutoScroll(event.target)) {
    event.preventDefault();
    reverseAutoScroll();
    return;
  }
  if (event.code !== 'Space' || event.repeat || !canUseAutoScroll(event.target)) return;
  event.preventDefault();
  toggleAutoScroll();
});
const keyboardNavigation = { l: { selector: '[data-sell]', hash: 'list-item' }, a: { selector: '[data-auction]', hash: 'auction-house' }, b: { selector: '[data-home]', hash: 'browse' }, c: { selector: '[data-chat]', hash: 'chat' }, u: { selector: '[data-account]', hash: 'account' } };
const modalWorkspaceHashes = new Set(['list-item', 'vip-curator', 'fees']);
let restoringWorkspaceHistory = false;
// Async page loads must not be allowed to overwrite a page the visitor chose
// after the request began. Every primary workspace route claims a new id.
let workspaceRouteId = 0;
let workspaceIntent = 'browse';
const beginWorkspaceRoute = kind => { if (kind) workspaceIntent = kind; return ++workspaceRouteId; };
const setWorkspaceHash = hash => {
  const next = `#${hash}`;
  if (location.hash === next) return;
  history.pushState({ collectorWorkspaceHash: hash, returnHash: location.hash || '#browse' }, '', `${location.pathname}${location.search}${next}`);
};
// Claim the destination before any asynchronous panel request begins. If a
// previous request resolves later, openModal will ignore that stale result.
document.addEventListener('click', event => {
  const target = event.target.closest('[data-home],[data-market],[data-auction],[data-chat],[data-sell],[data-account],[data-curator],[data-profile],[data-collector-chat],[data-conversation],[data-trade-chat],[data-delivery]');
  if (!target) return;
  if (target.matches('[data-home],[data-market]')) { beginWorkspaceRoute('browse'); document.body.classList.remove('app-section-membership', 'listing-page'); }
  else if (target.matches('[data-auction]')) { beginWorkspaceRoute('auction'); document.body.classList.remove('app-section-listing', 'app-section-membership', 'listing-page'); }
  else if (target.matches('[data-chat],[data-collector-chat],[data-conversation],[data-trade-chat],[data-delivery]')) beginWorkspaceRoute('chat');
  else if (target.matches('[data-sell]')) beginWorkspaceRoute('listing');
  else if (target.matches('[data-curator]')) beginWorkspaceRoute('membership');
  else beginWorkspaceRoute('account');
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !canUseAutoScroll(event.target) || document.body.classList.contains('app-section-mode') || document.body.classList.contains('auction-mode') || modal.open) return;
  const destination = keyboardNavigation[event.key.toLowerCase()];
  if (!destination) return;
  event.preventDefault();
  setWorkspaceHash(destination.hash);
  document.querySelector(destination.selector)?.click();
});
const openDiscoveryShortcut = mode => {
  const target = mode === 'search' ? search : tags;
  setDiscoveryMode(mode);
  setWorkspaceHash(mode);
  target.closest('.discovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => (mode === 'search' ? search : tagSearch).focus({ preventScroll: true }), 180);
};
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !canUseAutoScroll(event.target)) return;
  if (event.key.toLowerCase() === 's') { event.preventDefault(); openDiscoveryShortcut('search'); }
  if (event.key.toLowerCase() === 't') { event.preventDefault(); openDiscoveryShortcut('tags'); }
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !canUseAutoScroll(event.target) || ![',', '.'].includes(event.key)) return;
  event.preventDefault();
  const current = searchScopes.indexOf(searchScope);
  const direction = event.key === ',' ? -1 : 1;
  setSearchScope(searchScopes[(current + direction + searchScopes.length) % searchScopes.length]);
});
const bottomNavigation = ['home', 'auction', 'chat', 'sell', 'account'];
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !canUseAutoScroll(event.target) || !['z', 'x'].includes(key)) return;
  event.preventDefault();
  const activeButton = document.querySelector('.bottom-nav button.active');
  const current = Math.max(0, bottomNavigation.findIndex(name => activeButton?.hasAttribute(`data-${name}`)));
  const direction = key === 'z' ? -1 : 1;
  const destination = bottomNavigation[(current + direction + bottomNavigation.length) % bottomNavigation.length];
  document.querySelector(`.bottom-nav [data-${destination}]`)?.click();
});
const applyHashLocation = () => {
  const hash = location.hash.slice(1).toLowerCase();
  if (hash === 'search' || hash === 'tags') { openDiscoveryShortcut(hash); return; }
  const destination = Object.values(keyboardNavigation).find(item => item.hash === hash);
  if (destination) document.querySelector(destination.selector)?.click();
};
window.addEventListener('hashchange', () => { if (listings.length) applyHashLocation(); });
document.addEventListener('wheel', stopAutoScroll, { passive: true });
document.addEventListener('touchstart', stopAutoScroll, { passive: true });
document.addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) stopAutoScroll(); });
window.addEventListener('blur', stopAutoScroll);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAutoScroll(); });

const placeSportsAfterShoes = () => {
  const groups = [...tags.querySelectorAll('.tag-group')];
  const shoes = groups.find(group => group.querySelector('h3')?.textContent === 'Shoes & Sneakers');
  const sports = groups.find(group => group.querySelector('h3')?.textContent === 'Sports & Autographs');
  const home = groups.find(group => group.querySelector('h3')?.textContent === 'Home, Decor & Kitchen');
  const vanity = groups.find(group => group.querySelector('h3')?.textContent === 'Vanity');
  if (shoes && sports && shoes.nextElementSibling !== sports) shoes.after(sports);
  if (sports && home && sports.nextElementSibling !== home) sports.after(home);
  if (home && vanity && home.nextElementSibling !== vanity) home.after(vanity);
};
new MutationObserver(placeSportsAfterShoes).observe(tags, { childList: true });

const voiceChat = {
  roomId: null, label: '', stream: null, peers: new Map(), names: new Map(), remoteVideos: new Map(), videoStates: new Map(), cursor: 0, timer: null, muted: false, videoEnabled: false,
  async join(roomId, label) {
    if (!session) return openAuthPanel('login');
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return openModal('Voice unavailable', 'This browser does not support live voice chat. Try a current version of Chrome, Edge, Firefox, or Safari.');
    if (this.roomId === roomId) return;
    await this.leave();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const joined = await api(`/voice/${encodeURIComponent(roomId)}/join`, { method: 'POST', body: '{}' });
      this.roomId = roomId; this.label = label; this.cursor = joined.cursor; this.names.set(session.user.id, session.user.username);
      joined.peers.forEach(peer => this.names.set(peer.userId, peer.username)); this.render();
      for (const peer of joined.peers) await this.connect(peer.userId, true);
      this.poll();
    } catch (error) { this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; this.roomId = null; openModal('Could not join voice', error.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow microphone access in your browser and try again.' : error.message); }
  },
  async connect(userId, makeOffer = false) {
    if (this.peers.has(userId)) return this.peers.get(userId);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] });
    pc.pendingCandidates = []; this.stream.getTracks().forEach(track => pc.addTrack(track, this.stream));
    pc.onicecandidate = event => { if (event.candidate && this.roomId) this.signal(userId, 'candidate', event.candidate).catch(() => {}); };
    pc.ontrack = event => { if (event.track.kind === 'video') { this.remoteVideos.set(userId, event.streams[0]); if (!this.videoStates.has(userId)) this.videoStates.set(userId, true); this.render(); return; } let audio = document.querySelector(`[data-voice-audio="${CSS.escape(userId)}"]`); if (!audio) { audio = document.createElement('audio'); audio.autoplay = true; audio.dataset.voiceAudio = userId; document.body.append(audio); } audio.srcObject = event.streams[0]; };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.removePeer(userId); this.render(); };
    this.peers.set(userId, pc); this.render();
    if (makeOffer) { await pc.setLocalDescription(await pc.createOffer()); await this.signal(userId, 'offer', pc.localDescription); }
    return pc;
  },
  signal(to, type, data) { return api(`/voice/${encodeURIComponent(this.roomId)}/signal`, { method: 'POST', body: JSON.stringify({ to, type, data }) }); },
  async handle(event) {
    if (event.type === 'join') { this.names.set(event.from, event.username || 'Collector'); this.render(); return; }
    if (event.type === 'leave') { this.removePeer(event.from); return; }
    if (event.type === 'media-state') { this.videoStates.set(event.from, Boolean(event.data?.videoEnabled)); this.render(); return; }
    const pc = await this.connect(event.from);
    if (event.type === 'offer') { await pc.setRemoteDescription(event.data); while (pc.pendingCandidates.length) await pc.addIceCandidate(pc.pendingCandidates.shift()); await pc.setLocalDescription(await pc.createAnswer()); await this.signal(event.from, 'answer', pc.localDescription); }
    if (event.type === 'answer') { await pc.setRemoteDescription(event.data); while (pc.pendingCandidates.length) await pc.addIceCandidate(pc.pendingCandidates.shift()); }
    if (event.type === 'candidate') { if (pc.remoteDescription) await pc.addIceCandidate(event.data); else pc.pendingCandidates.push(event.data); }
  },
  async poll() {
    if (!this.roomId) return;
    try { const result = await api(`/voice/${encodeURIComponent(this.roomId)}/events?after=${this.cursor}`); this.cursor = result.cursor; for (const event of result.events) await this.handle(event); this.render(result.participants); } catch (error) { if (this.roomId) console.warn('Voice polling paused:', error.message); }
    if (this.roomId) this.timer = setTimeout(() => this.poll(), 1200);
  },
  removePeer(userId) { this.peers.get(userId)?.close(); this.peers.delete(userId); this.names.delete(userId); this.remoteVideos.delete(userId); this.videoStates.delete(userId); document.querySelector(`[data-voice-audio="${CSS.escape(userId)}"]`)?.remove(); this.render(); },
  toggleMute() { this.muted = !this.muted; this.stream?.getAudioTracks().forEach(track => { track.enabled = !this.muted; }); this.render(); },
  async toggleVideo() { if (!this.roomId || !this.stream) return; let track = this.stream.getVideoTracks()[0]; if (!track) { const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } }, audio: false }); track = camera.getVideoTracks()[0]; this.stream.addTrack(track); for (const [userId, peer] of this.peers) { peer.addTrack(track, this.stream); await peer.setLocalDescription(await peer.createOffer()); await this.signal(userId, 'offer', peer.localDescription); } } this.videoEnabled = !this.videoEnabled; track.enabled = this.videoEnabled; await Promise.all([...this.peers.keys()].map(userId => this.signal(userId, 'media-state', { videoEnabled: this.videoEnabled }).catch(() => {}))); this.render(); },
  async leave() { const roomId = this.roomId; this.roomId = null; clearTimeout(this.timer); this.peers.forEach(peer => peer.close()); this.peers.clear(); this.names.clear(); this.remoteVideos.clear(); this.videoStates.clear(); this.videoEnabled = false; this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; document.querySelectorAll('[data-voice-audio]').forEach(node => node.remove()); document.querySelector('.voice-dock')?.remove(); if (roomId && session) await api(`/voice/${encodeURIComponent(roomId)}`, { method: 'DELETE' }).catch(() => {}); },
  render(participantCount) {
    if (!this.roomId) return; let dock = document.querySelector('.voice-dock');
    if (!dock) { dock = document.createElement('aside'); dock.className = 'voice-dock'; document.body.append(dock); }
    dock.classList.toggle('is-muted', this.muted); const people = [...this.names.values()]; const remoteTiles = [...this.remoteVideos.entries()].filter(([userId]) => this.videoStates.get(userId) !== false).map(([userId]) => `<figure class="voice-video-tile"><video data-voice-video="${safe(userId)}" autoplay playsinline muted></video><figcaption>@${safe(this.names.get(userId) || 'collector')}</figcaption></figure>`).join('');
    dock.innerHTML = `<header><i class="voice-pulse"></i><div><strong>${safe(this.label)}</strong><small>Live voice · ${participantCount || Math.max(1, people.length)} listening</small></div></header>${this.videoEnabled || remoteTiles ? `<section class="voice-video-grid">${this.videoEnabled ? `<figure class="voice-video-tile is-local"><video data-voice-local autoplay muted playsinline></video><figcaption>You</figcaption></figure>` : ''}${remoteTiles}</section>` : ''}<div class="voice-participants">${people.map(name => `<span>@${safe(name)}</span>`).join('')}</div><div class="voice-controls"><button type="button" data-voice-mute>${this.muted ? 'Unmute mic' : 'Mute mic'}</button><button type="button" data-voice-video>${this.videoEnabled ? 'Hide video' : 'Show video'}</button><button type="button" class="voice-leave" data-voice-leave>Leave</button></div>`;
    const localVideo = dock.querySelector('[data-voice-local]'); if (localVideo) localVideo.srcObject = this.stream; this.remoteVideos.forEach((stream, userId) => { const video = dock.querySelector(`[data-voice-video="${CSS.escape(userId)}"]`); if (video) video.srcObject = stream; });
  }
};

const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const accountAvatar = (user, className = 'account-avatar') => { const fallback = String(user?.avatar || user?.username || 'C').slice(0, 2).toUpperCase(); const image = String(user?.avatar || ''); return /^(https?:\/\/|data:image\/)/i.test(image) ? `<span class="${className}"><img src="${safe(image)}" alt="${safe(user?.username || 'Collector')} profile image"></span>` : `<span class="${className}">${safe(fallback)}</span>`; };
const formatListingDate = value => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Recently listed' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
const deliveryCarriers = ['UPS Priority'];
const tagGroups = { 'Sports & Autographs': ['Sports Cards', 'Sports Memorabilia', 'Sports Trophies', 'Baseball Bats', 'Baseballs', 'Autographs', 'Fishing Gear', 'Horse Saddles', 'Horse Shoes', 'Gym Equipment', 'Weights', 'Gym Machines'], 'Fashion & Luxury': ['Fashion', 'Male', 'Female', 'Unisex', 'Cosplay', 'Fur Suits', 'Animal Furs', 'Sneakers', 'Dress Shoes', 'Sunglasses', 'Suits', 'Dresses', 'T-Shirts', 'Button-Ups', 'Pants', 'Coats', 'Jackets', 'Socks', 'Underwear', 'Hats', 'Boots', 'Handbags', 'Purses', 'Wigs', 'Pomade & Hair', 'Perfume & Cologne', 'Designing Tools', 'Watches', 'Fine Jewelry', 'Real Gemstones'], 'Vehicles & Transport': ['Cars', 'Exotic Cars', 'Electric Cars', 'Automotive Parts', 'Motorcycles', 'Biker Helmets', 'Yachts', 'Super Yachts', 'Sailboats', 'Sails', 'Boat Equipment', 'Jet Skis', 'Watercraft', 'Submarines', 'Aircraft'], 'Art, History & Materials': ['Fine Art', 'Fine Sculptures', 'Statues', 'Sketches', 'Art', 'Cards', 'Tapestry', 'Looms', 'Cloth', 'Historical Artifacts', 'Religious', 'Occult', 'Retired Museum Pieces', 'Legal Human Remains (Verified)', 'Coins', 'Metal', 'Marble & Stones', 'Memorabilia', 'Vintage'], 'Home, Decor & Kitchen': ['Furniture', 'Tables', 'Chairs', 'Stools', 'Beds', 'Mattresses', 'Curtains', 'Bookshelves', 'Displays', 'Tableware', 'Glassware', 'Cooking Equipment & Appliances', 'Cookbooks', 'Tea Cups', 'Clocks', 'Decor'], 'Food & Drink': ['Bread', 'Beverages', 'Bottles', 'Candy', 'Crackers', 'Creatine', 'Freeze-Dried Food', 'Frozen Sea Creatures', 'Meats', 'Protein Powder', 'Rations', 'Salami', 'Soda', 'Sorbet', 'Sparkling Water', 'Supplements'], 'Artisan Alcohol (21+ Only)': ['Artisan Alcohol', 'Aged Alcohol', 'Whiskey', 'Bourbon', 'Scotch', 'Rum', 'Tequila', 'Gin', 'Vodka', 'Craft Beer', 'Wine', 'Champagne', 'Vintage Bottles'], 'Artisan Cheese': ['Artisan Cheese', 'Edam Cheese', 'Swiss Cheese', 'Cheddar Cheese', 'Brie Cheese', 'Gouda Cheese', 'Parmesan Cheese', 'Blue Cheese', 'Camembert Cheese', 'Manchego Cheese', 'Mozzarella Cheese'], 'Adult Only (18+)': ['Adult Only (18+)', 'Age Restricted Collectibles', 'Adult Books & Magazines', 'Adult Comics', 'Adult Film CDs', 'Adult Toys', 'Adult Tech', 'Adult Protection', 'Adult Decor', 'Adult Furniture', 'Adult Manga Books', 'Adult Manga Comics', 'Adult Manga CD Films', 'Adult Manga Merch'], 'Toys & Games': ['Dolls', 'Toys', 'Squirt Guns', 'Airsoft', 'Action Figures', 'Building Toy Sets', 'Bobbleheads', 'Board Games', 'Tabletop', 'Miniature Trains'], 'Science & Nature': ['Telescopes', 'Space Rocks', 'Fossils', 'Geodes', 'Crystals', 'Plant Seeds', 'Taxidermy'], 'Weapons & Armor': ['Armor', 'Arrows', 'Ballistic Vests (Legal Buyers)', 'Bows', 'Crossbows', 'Hunting Gear', 'Knives', 'Martial Arts Equipment', 'Martial Blades', 'Throwing Equipment'], 'Technology': ['Electronics', 'Computers', 'FPV Drones (No Explosives)', 'Phones'], 'Gaming': ['Consoles', 'VR Headsets', 'Controllers', 'Gaming Chairs', 'Arcade Machines', 'Toys-to-Life', 'Video Games', 'Gaming Merch', 'Influencer Merch'], 'Top Brands': [], 'Media & Entertainment': ['Set Props', 'Movies', 'Movie Posters', 'Vinyl', 'Records', 'CDs', 'Books', 'Comics', 'Manga Books', 'Manga Comics', 'Manga CD Films', 'Manga Merch', 'Newspapers', 'Instruments'] };
tagGroups.Location = [];
tagGroups.Gaming.push('Physical Video Game Copies', 'Retro Video Game Copies');
tagGroups['Media & Entertainment'].push('Educational Books', 'College Books');
tagGroups['Adult Only (18+)'].push('Smut Books');
tagGroups['Fashion & Luxury'].push('Gymwear');
tagGroups['Clothing Designs & Formats'] = ['Cargo', 'Cargo Pants', 'Button-Up', 'Button-Up Shirt', 'Jeans', 'Denim', 'Hoodie', 'Zip-Up Hoodie', 'Pullover Hoodie', 'Tank Top', 'T-Shirt', 'Polo Shirt', 'Dress Shirt', 'Overshirt', 'Flannel', 'Sweater', 'Cardigan', 'Turtleneck', 'Bodysuit', 'Jumpsuit', 'Romper', 'Blazer', 'Vest', 'Puffer Jacket', 'Bomber Jacket', 'Trench Coat', 'Raincoat', 'Windbreaker', 'Parka', 'Leather Jacket', 'Denim Jacket', 'Track Jacket', 'Dress', 'Maxi Dress', 'Mini Dress', 'Midi Dress', 'Skirt', 'Mini Skirt', 'Pencil Skirt', 'Shorts', 'Board Shorts', 'Leggings', 'Joggers', 'Sweatpants', 'Chinos', 'Slacks', 'Overalls', 'Coveralls', 'Socks', 'Tights', 'Underwear', 'Swimwear', 'Bikini', 'One-Piece Swimsuit', 'Sportswear', 'Uniform', 'Matching Set', 'Two-Piece Set', 'Layered', 'Oversized Fit', 'Slim Fit', 'Tailored Fit'];
tagGroups['Food & Drink'].splice(tagGroups['Food & Drink'].indexOf('Meats'), 1, 'Frozen Meats');
tagGroups['Food & Drink'].push('Mastic');
tagGroups.Technology.push('RC', 'RC Cars', 'RC Boats', 'RC Aircraft');
tagGroups['Fashion & Luxury'] = tagGroups['Fashion & Luxury'].filter(tag => tag !== 'Fur Suits');
tagGroups['Weapons & Armor'].push('Fur Suits');
tagGroups['Adult Only (18+)'].push('Adult Fur Suits');
tagGroups['Adult Only (18+)'].push('Adult Clothing', 'Adult Cosplay', 'Adult Fashion', 'Adult Lingerie');
tagGroups['Sports & Autographs'].push('Golf Balls', 'Golf Caddy', 'Golf Clubs', 'Golf Equipment', 'Golf Carts', 'Footballs');
tagGroups['Vehicles & Transport'].push('Go Karts');
tagGroups['Sports & Autographs'].push('Basketballs', 'Volleyballs');
tagGroups['Media & Entertainment'] = tagGroups['Media & Entertainment'].filter(tag => !tag.startsWith('Manga'));
tagGroups['Adult Only (18+)'] = tagGroups['Adult Only (18+)'].filter(tag => !tag.startsWith('Adult Manga'));
tagGroups['Media & Entertainment'].push('Manga');
tagGroups['Adult Only (18+)'].push('Adult Manga');
tagGroups.Technology.push('TVs', 'Record Players', 'Stereos');
tagGroups.Styles = [];
tagGroups.Styles.push('Minimalist', 'Modern', 'Vintage', 'Luxury', 'Classic', 'Streetwear', 'Techwear', 'Formal', 'Casual', 'Curated', 'Limited Edition', 'Museum Grade', 'Antique', 'Victorian', 'Edwardian', 'Art Deco', 'Mid Century', 'Retro', 'Contemporary');
tagGroups.Styles.push('Korean', 'Japanese', 'Chinese', 'French', 'Italian', 'American', 'British', 'Nordic', 'Mediterranean', 'Latin American');
tagGroups.Styles.push('Punk', 'Camp', 'Avant Garde');
tagGroups['Sports & Autographs'].push('Skateboards', 'Surfboards', 'Hockey Equipment');
tagGroups.Styles.push('Skate', 'Gothic', 'Cyberpunk', 'Kawaii', 'Lovecraft', 'Lovecraftian', 'Horror');
tagGroups.Styles = tagGroups.Styles.filter(tag => tag !== 'Lovecraft');
tagGroups.Styles.push('Rock', 'Bling');
tagGroups['Clothing & Shoe Sizes'] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', 'One Size', 'Petite', 'Tall', 'Plus Size', 'Regular Fit', 'Slim Fit', 'Relaxed Fit', 'Wide Fit', 'Narrow Fit', 'Toddler', 'Youth', 'Kids', 'Shoe Size 4', 'Shoe Size 4.5', 'Shoe Size 5', 'Shoe Size 5.5', 'Shoe Size 6', 'Shoe Size 6.5', 'Shoe Size 7', 'Shoe Size 7.5', 'Shoe Size 8', 'Shoe Size 8.5', 'Shoe Size 9', 'Shoe Size 9.5', 'Shoe Size 10', 'Shoe Size 10.5', 'Shoe Size 11', 'Shoe Size 11.5', 'Shoe Size 12', 'Shoe Size 13', 'Shoe Size 14', 'Shoe Size 15', 'Shoe Size 16', 'Wide Shoes', 'Extra Wide Shoes', 'Narrow Shoes'];
tagGroups['Fashion & Luxury'] = tagGroups['Fashion & Luxury'].filter(tag => !['Male', 'Female', 'Unisex'].includes(tag));
const audienceTagOptions = ['Male', 'Female', 'Unisex', 'LGBTQ+', 'Baby', 'Toddler', 'Child', 'Teen', 'Adult', 'Elder', 'NSFW'];
tagGroups['Fashion & Luxury'] = tagGroups['Fashion & Luxury'].filter(tag => !['Sneakers', 'Dress Shoes', 'Boots'].includes(tag));
tagGroups['Shoes & Sneakers'] = ['Shoes', 'Sneakers', 'Athletic Shoes', 'Running Shoes', 'Walking Shoes', 'Training Shoes', 'Basketball Shoes', 'Football Cleats', 'Soccer Cleats', 'Baseball Cleats', 'Golf Shoes', 'Tennis Shoes', 'Skate Shoes', 'Hiking Boots', 'Work Boots', 'Rain Boots', 'Snow Boots', 'Cowboy Boots', 'Combat Boots', 'Chelsea Boots', 'Ankle Boots', 'Knee-High Boots', 'Dress Shoes', 'Oxford Shoes', 'Loafers', 'Derby Shoes', 'Brogues', 'Monk Strap Shoes', 'Moccasins', 'Boat Shoes', 'Espadrilles', 'Sandals', 'Slides', 'Flip-Flops', 'Clogs', 'Mules', 'Ballet Flats', 'Flats', 'Mary Janes', 'Heels', 'Stilettos', 'Pumps', 'Wedges', 'Platform Shoes', 'Slingbacks', 'Peep-Toe Heels', 'Slippers', 'House Shoes', 'Orthopedic Shoes', 'Vintage Shoes', 'Designer Shoes', 'Limited Edition Sneakers', 'Kids Shoes', 'Baby Shoes'];
tagGroups.Vanity = ['Makeup', 'Skincare', 'Foundation', 'Concealer', 'Face Powder', 'Blush', 'Bronzer', 'Highlighter', 'Primer', 'Setting Spray', 'Lipstick', 'Lip Gloss', 'Lip Liner', 'Lip Balm', 'Eyeshadow', 'Eyeshadow Palettes', 'Eyeliner', 'Mascara', 'False Lashes', 'Brow Pencil', 'Brow Gel', 'Makeup Brushes', 'Makeup Sponges', 'Beauty Tools', 'Nail Polish', 'Nail Care', 'Makeup Remover', 'Facial Cleanser', 'Face Wash', 'Toner', 'Face Serum', 'Face Moisturizer', 'Face Oil', 'Sunscreen', 'Face Masks', 'Eye Cream', 'Lip Care', 'Acne Care', 'Exfoliants', 'Retinol Skincare', 'K-Beauty Skincare', 'Travel Makeup', 'Vintage Makeup'];
tagGroups['Bra Sizes'] = ['Band 26', 'Band 28', 'Band 30', 'Band 32', 'Band 34', 'Band 36', 'Band 38', 'Band 40', 'Band 42', 'Band 44', 'Band 46', 'Band 48', 'Band 50', 'Band 52', 'Band 54', 'Band 56', 'Cup AAA', 'Cup AA', 'Cup A', 'Cup B', 'Cup C', 'Cup D', 'Cup DD', 'Cup DDD/E', 'Cup F', 'Cup G', 'Cup H', 'Cup I', 'Cup J', 'Cup K', 'Cup L', 'Cup M', 'Bra Set', 'Sports Bra', 'Bralette', 'Nursing Bra', 'Strapless Bra', 'Underwire Bra', 'Wireless Bra', 'Padded Bra', 'Unpadded Bra'];
tagGroups['Height & Waist Sizes'] = ['Height 4ft 10in', 'Height 4ft 11in', 'Height 5ft 0in', 'Height 5ft 1in', 'Height 5ft 2in', 'Height 5ft 3in', 'Height 5ft 4in', 'Height 5ft 5in', 'Height 5ft 6in', 'Height 5ft 7in', 'Height 5ft 8in', 'Height 5ft 9in', 'Height 5ft 10in', 'Height 5ft 11in', 'Height 6ft 0in', 'Height 6ft 1in', 'Height 6ft 2in', 'Height 6ft 3in', 'Height 6ft 4in', 'Height 6ft 5in', 'Height 6ft 6in', 'Height 6ft 7in', 'Height 6ft 8in', 'Height 6ft 9in', 'Height 6ft 10in', 'Height 6ft 11in', 'Height 7ft 0in', 'Height 7ft 1in', 'Height 7ft 2in', 'Height 7ft 3in', 'Height 7ft 4in', 'Waist 24', 'Waist 26', 'Waist 28', 'Waist 30', 'Waist 32', 'Waist 34', 'Waist 36', 'Waist 38', 'Waist 40', 'Waist 42', 'Waist 44', 'Waist 46', 'Waist 48', 'Waist 50', 'Inseam 26', 'Inseam 28', 'Inseam 30', 'Inseam 32', 'Inseam 34', 'Inseam 36', 'Inseam 38', 'Short Length', 'Regular Length', 'Long Length', 'Tall Length'];
tagGroups['Object Dimensions'] = ['Length Under 6 in', 'Length 6–12 in', 'Length 1–2 ft', 'Length 2–3 ft', 'Length 3–5 ft', 'Length 5–8 ft', 'Length Over 8 ft', 'Width Under 6 in', 'Width 6–12 in', 'Width 1–2 ft', 'Width 2–3 ft', 'Width 3–5 ft', 'Width Over 5 ft', 'Height Under 6 in', 'Height 6–12 in', 'Height 1–2 ft', 'Height 2–3 ft', 'Height 3–5 ft', 'Height 5–8 ft', 'Height Over 8 ft', 'Depth Under 6 in', 'Depth 6–12 in', 'Depth 1–2 ft', 'Depth 2–3 ft', 'Depth Over 3 ft', 'Weight Under 1 lb', 'Weight 1–5 lb', 'Weight 5–20 lb', 'Weight 20–50 lb', 'Weight 50–100 lb', 'Weight Over 100 lb', 'Metric Dimensions', 'Imperial Dimensions', 'Compact', 'Oversized'];
tagGroups['Weights & Materials'] = ['Under 1 oz', '1–4 oz', '4–8 oz', '8–16 oz', '1–5 lb', '5–10 lb', '10–25 lb', '25–50 lb', '50–100 lb', '100–250 lb', '250–500 lb', 'Over 500 lb', 'Under 1 kg', '1–5 kg', '5–10 kg', '10–25 kg', '25–50 kg', 'Over 50 kg', 'Wood', 'Hardwood', 'Softwood', 'Bamboo', 'Cork', 'Metal', 'Steel', 'Stainless Steel', 'Iron', 'Cast Iron', 'Aluminum', 'Brass', 'Bronze', 'Copper', 'Titanium', 'Gold', 'Silver', 'Platinum', 'Leather', 'Suede', 'Fur', 'Wool', 'Silk', 'Cotton', 'Linen', 'Denim', 'Canvas', 'Nylon', 'Polyester', 'Rubber', 'Plastic', 'Acrylic', 'Resin', 'Glass', 'Crystal', 'Ceramic', 'Porcelain', 'Stone', 'Marble', 'Granite', 'Concrete', 'Paper', 'Cardboard', 'Vinyl', 'Carbon Fiber', 'Composite', 'Recycled Material'];
tagGroups.Colors = ['Black', 'White', 'Gray', 'Silver', 'Charcoal', 'Ivory', 'Cream', 'Beige', 'Tan', 'Taupe', 'Brown', 'Chocolate', 'Espresso', 'Copper', 'Bronze', 'Gold', 'Rose Gold', 'Platinum', 'Red', 'Crimson', 'Scarlet', 'Burgundy', 'Maroon', 'Ruby', 'Coral', 'Orange', 'Burnt Orange', 'Amber', 'Yellow', 'Mustard', 'Gold Yellow', 'Lemon', 'Green', 'Lime', 'Olive', 'Sage', 'Mint', 'Emerald', 'Forest Green', 'Teal', 'Turquoise', 'Aqua', 'Cyan', 'Blue', 'Navy', 'Royal Blue', 'Sky Blue', 'Baby Blue', 'Powder Blue', 'Cobalt', 'Indigo', 'Purple', 'Violet', 'Lavender', 'Lilac', 'Plum', 'Eggplant', 'Magenta', 'Fuchsia', 'Pink', 'Rose', 'Blush', 'Peach', 'Salmon', 'Multi-Color', 'Rainbow', 'Clear', 'Transparent', 'Iridescent', 'Pearlescent', 'Holographic', 'Neon', 'Glow in the Dark'];
tagGroups.Conditions = ['New', 'New with Tags', 'Sealed', 'Like New', 'Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'For Parts or Repair', 'Graded', 'Ungraded', 'Authenticated', 'Restored'];
const categoryOptions = [...Object.values(tagGroups).flat(), ...audienceTagOptions];
function enableCarrierPicker(input) { if (!document.querySelector('#delivery-carriers')) { const list = document.createElement('datalist'); list.id = 'delivery-carriers'; list.innerHTML = deliveryCarriers.map(carrier => `<option value="${safe(carrier)}">`).join(''); document.body.append(list); } input.setAttribute('list', 'delivery-carriers'); input.placeholder = 'Choose a delivery company'; }
async function api(url, options = {}) { const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers || {}) } }); const payload = response.status === 204 ? null : await response.json(); if (!response.ok) { const error = new Error(payload?.error || 'Something went wrong.'); error.code = payload?.code || ''; error.debugId = payload?.debugId || ''; throw error; } return payload; }
let paypalSdkPromise;
async function ensurePayPalSdk() {
  if (window.paypal?.Buttons) return window.paypal;
  if (paypalSdkPromise) return paypalSdkPromise;
  const config = await fetch('/paypal/config').then(response => response.ok ? response.json() : Promise.reject(new Error('PayPal is unavailable.')));
  if (!config.clientId) throw new Error('PayPal is not configured yet.');
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.async = true;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture&components=buttons`;
    script.onload = () => window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error('PayPal checkout did not load.'));
    script.onerror = () => reject(new Error('PayPal checkout could not load. Check your connection or content blocker.'));
    document.head.append(script);
  });
  return paypalSdkPromise;
}
const checkoutRecipientAddress = form => ({ name: form.querySelector('#shipping-name')?.value.trim(), street1: form.querySelector('#shipping-street1')?.value.trim(), street2: form.querySelector('#shipping-street2')?.value.trim(), city: form.querySelector('#shipping-city')?.value.trim(), state: form.querySelector('#shipping-state')?.value.trim(), zip: form.querySelector('#shipping-zip')?.value.trim(), country: 'US' });
async function renderPayPalButtonForPurchase(form) {
  const container = form.querySelector('.paypal-button-container');
  if (!container || container.dataset.ready) return;
  container.dataset.ready = 'loading'; container.innerHTML = '<small>Loading PayPal securely…</small>';
  let order; let blockedMessage = '';
  const showCheckoutError = message => { container.querySelectorAll('.listing-submit-error').forEach(node => node.remove()); container.insertAdjacentHTML('beforeend', `<p class="listing-submit-error" role="alert">${safe(message)}</p>`); };
  const validatePurchase = () => {
    const item = listings.find(row => row.id === form.dataset.listing);
    if (item?.ownerId === session?.user?.id) return 'You cannot purchase your own listing.';
    if (!form.reportValidity()) return 'Choose UPS Priority and complete every delivery address field first.';
    if (form.querySelector('#delivery-provider')?.value !== 'UPS Priority') return 'Choose UPS Priority before paying.';
    return '';
  };
  try {
    const paypal = await ensurePayPalSdk();
    const buttons = paypal.Buttons({
      onClick: (_data, actions) => { blockedMessage = validatePurchase(); if (blockedMessage) { showCheckoutError(blockedMessage); return actions.reject(); } return actions.resolve(); },
      createOrder: async () => { const problem = validatePurchase(); if (problem) throw new Error(problem); const recipientAddress = checkoutRecipientAddress(form); order = await api('/paypal/orders', { method: 'POST', body: JSON.stringify({ listingId: form.dataset.listing, recipientAddress, deliveryProvider: form.querySelector('#delivery-provider').value, deliveryMiles: form.querySelector('#delivery-miles').value, paymentMethod: form.querySelector('[name="paymentMethod"]:checked')?.value }) }); return order.orderId; },
      onApprove: async (data, actions) => { try { const delivery = await api(`/paypal/orders/${order.deliveryId}/capture`, { method: 'POST', body: JSON.stringify({ orderId: data.orderID }) }); await loadDeliveries(); await loadMarket(); await openDelivery(delivery.id); } catch (error) { if (error.code === 'INSTRUMENT_DECLINED' && actions?.restart) return actions.restart(); showCheckoutError(`${error.message}${error.debugId ? ` PayPal reference: ${error.debugId}` : ''}`); } },
      onCancel: () => order ? api(`/paypal/orders/${order.deliveryId}/cancel`, { method: 'POST', body: '{}' }).then(() => { order = null; }).catch(showError) : undefined,
      onError: error => { if (blockedMessage) return; showCheckoutError(`PayPal could not continue. No payment was captured.${error?.message ? ` ${error.message}` : ''}`); }
    });
    if (!buttons.isEligible()) throw new Error('PayPal checkout is not available in this browser.');
    container.innerHTML = ''; await buttons.render(container); container.dataset.ready = 'true';
  } catch (error) { container.dataset.ready = ''; container.innerHTML = `<p class="listing-submit-error" role="alert">${safe(error.message)}</p>`; }
}
async function renderPayPalButtonForVipCurator(container) {
  if (!container || container.dataset.ready) return;
  container.dataset.ready = 'loading'; container.innerHTML = '<small>Loading PayPal securely…</small>';
  let order;
  const showError = error => { container.querySelectorAll('.listing-submit-error').forEach(node => node.remove()); container.insertAdjacentHTML('beforeend', `<p class="listing-submit-error" role="alert">${safe(error)}</p>`); };
  try {
    const paypal = await ensurePayPalSdk();
    const buttons = paypal.Buttons({
      createOrder: async () => { order = await api('/membership/vip-curator/paypal/order', { method: 'POST', body: '{}' }); return order.orderId; },
      onApprove: async (data, actions) => { try { const result = await api(`/membership/vip-curator/${order.membershipId}/paypal/capture`, { method: 'POST', body: JSON.stringify({ orderId: data.orderID }) }); saveSession({ ...session, user: result.user }); accounts = accounts.map(account => account.id === result.user.id ? { ...account, ...result.user } : account); container.innerHTML = `<section class="vip-checkout-success"><b>VIP Curator is active</b><span>Your membership is active through ${safe(new Date(result.membership.expiresAt).toLocaleDateString())}.</span><button type="button" data-account>Open your account</button></section>`; } catch (error) { if (error.code === 'INSTRUMENT_DECLINED' && actions?.restart) return actions.restart(); showError(`${error.message}${error.debugId ? ` PayPal reference: ${error.debugId}` : ''}`); } },
      onCancel: () => order ? api(`/membership/vip-curator/${order.membershipId}/paypal/cancel`, { method: 'POST', body: '{}' }).then(() => { order = null; }).catch(showError) : undefined,
      onError: error => showError(`PayPal could not continue. No membership payment was captured.${error?.message ? ` ${error.message}` : ''}`)
    });
    if (!buttons.isEligible()) throw new Error('PayPal checkout is not available in this browser.');
    container.innerHTML = ''; await buttons.render(container); container.dataset.ready = 'true';
  } catch (error) { container.dataset.ready = ''; container.innerHTML = `<p class="listing-submit-error" role="alert">${safe(error.message)}</p>`; }
}
async function renderPayPalButtonForTrade(trade) {
  const container = modalContent.querySelector('.trade-paypal-button-container');
  if (!container || container.dataset.ready) return;
  container.dataset.ready = 'loading'; container.innerHTML = '<small>Loading PayPal securely…</small>';
  let order;
  const showError = message => {
    container.querySelectorAll('.listing-submit-error').forEach(node => node.remove());
    container.insertAdjacentHTML('beforeend', `<p class="listing-submit-error" role="alert">${safe(message)}</p>`);
  };
  try {
    const paypal = await ensurePayPalSdk();
    const buttons = paypal.Buttons({
      createOrder: async () => { order = await api(`/trade/${trade.id}/paypal/order`, { method: 'POST', body: '{}' }); return order.orderId; },
      onApprove: async (data, actions) => { try { await api(`/trade/${trade.id}/paypal/capture`, { method: 'POST', body: JSON.stringify({ orderId: data.orderID }) }); await loadMarket(); await loadDeliveries(); await openTradeChat(trade.id); } catch (error) { if (error.code === 'INSTRUMENT_DECLINED' && actions?.restart) return actions.restart(); showError(`${error.message}${error.debugId ? ` PayPal reference: ${error.debugId}` : ''}`); } },
      onCancel: () => order ? api(`/trade/${trade.id}/paypal/cancel`, { method: 'POST', body: '{}' }).then(() => { order = null; }).catch(showError) : undefined,
      onError: error => { const detail = error?.message ? ` ${error.message}` : ''; showError(`PayPal could not continue. No payment was captured.${detail}`); }
    });
    if (!buttons.isEligible()) throw new Error('PayPal checkout is not available in this browser.');
    container.innerHTML = ''; await buttons.render(container); container.dataset.ready = 'true';
  } catch (error) { container.dataset.ready = ''; container.innerHTML = `<p class="listing-submit-error" role="alert">${safe(error.message)}</p>`; }
}
function renderAccountButton() {
  const username = String(session?.user?.username || '').trim();
  const headerButton = document.querySelector('.header-nav [data-account]');
  if (headerButton) {
    headerButton.textContent = username || 'Create account';
    headerButton.setAttribute('aria-label', username ? 'Open @' + username + '\'s account' : 'Create account');
  }
  const dockButton = document.querySelector('.bottom-nav [data-account]');
  if (dockButton) {
    [...dockButton.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
    dockButton.append(document.createTextNode(username || 'Account'));
    dockButton.setAttribute('aria-label', username ? 'Open @' + username + '\'s account' : 'Open account');
  }
}
function saveSession(nextSession) { session = nextSession; if (session) localStorage.setItem('collector-marketplace-session', JSON.stringify(session)); else localStorage.removeItem('collector-marketplace-session'); renderAccountButton(); }
renderAccountButton();
const asFeedListing = listing => ({ ...listing, image: listing.images?.[0] || '', tags: listing.tags?.length ? listing.tags : [listing.category], tag: listing.tags?.[0] || listing.category, trade: listing.tradeOffer, ownerName: listing.owner?.username || 'JohnDoe' });
const listingTags = item => Array.isArray(item.tags) ? item.tags : [item.tag].filter(Boolean);
const searchedTagTerms = () => (tagSearch.value.match(/#?[a-z0-9-]+/gi) || []).map(value => value.replace('#', '').toLowerCase());
const priceRangeValue = input => { const value = input?.value.trim(); if (!value) return null; const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : null; };
const distanceFromViewer = item => {
  const coordinates = item.locationCoordinates;
  if (!viewerLocation || !coordinates || !Number.isFinite(Number(coordinates.lat)) || !Number.isFinite(Number(coordinates.lng))) return Infinity;
  const radians = value => value * Math.PI / 180;
  const lat1 = radians(viewerLocation.lat); const lat2 = radians(Number(coordinates.lat));
  const deltaLat = lat2 - lat1; const deltaLng = radians(Number(coordinates.lng) - viewerLocation.lng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const checkoutZipCache = new Map();
let checkoutAddressTimer = 0;
const zipFromAddress = value => String(value || '').match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || '';
const milesBetween = (from, to) => { const radians = value => value * Math.PI / 180; const lat1 = radians(Number(from.lat)); const lat2 = radians(Number(to.lat)); const deltaLat = lat2 - lat1; const deltaLng = radians(Number(to.lng) - Number(from.lng)); const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2; return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };
const coordinatesForZip = async zip => { if (checkoutZipCache.has(zip)) return checkoutZipCache.get(zip); const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`); if (!response.ok) throw new Error('ZIP code location unavailable'); const payload = await response.json(); const place = payload.places?.[0]; const coordinates = place ? { lat: Number(place.latitude), lng: Number(place.longitude) } : null; if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) throw new Error('ZIP code location unavailable'); checkoutZipCache.set(zip, coordinates); return coordinates; };
const calculateCheckoutDeliveryFromAddress = async field => { const form = field.closest('.purchase-checkout'); const miles = form?.querySelector('#delivery-miles'); const note = form?.querySelector('#delivery-distance-note'); const buyerZip = zipFromAddress(field.value); const sellerZip = zipFromAddress(form?.dataset.sellerZip); if (!form || !miles || !buyerZip || !sellerZip) { if (note) note.textContent = sellerZip ? 'Add a 5-digit ZIP to your address to calculate delivery.' : 'Seller location is unavailable; enter estimated miles.'; return; } try { if (note) note.textContent = 'Calculating delivery distance…'; const [buyer, seller] = await Promise.all([coordinatesForZip(buyerZip), coordinatesForZip(sellerZip)]); const calculatedMiles = milesBetween(buyer, seller); miles.value = calculatedMiles.toFixed(1); miles.readOnly = true; miles.setAttribute('aria-readonly', 'true'); if (note) note.textContent = `Distance calculated from ZIP codes: ${calculatedMiles.toFixed(1)} miles.`; updateFeeSummary(); } catch { miles.readOnly = false; miles.removeAttribute('aria-readonly'); if (note) note.textContent = 'Could not calculate distance automatically; enter estimated miles.'; } };
const refreshCheckoutEstimates = async () => { const zip = zipFromAddress(checkoutPreferences.address); if (!zip) return renderFeed(); try { checkoutPreferences.coordinates = await coordinatesForZip(zip); saveCheckoutPreferences(); } catch { checkoutPreferences.coordinates = null; } renderFeed(); };
const deliveryEstimate = miles => {
  if (!Number.isFinite(miles)) return 'Enable location for distance & ETA';
  if (miles <= 25) return 'Local delivery · about 1 day';
  if (miles <= 300) return 'Estimated delivery · 1–3 days';
  if (miles <= 1200) return 'Estimated delivery · 2–5 days';
  return 'Estimated delivery · 4–7 days';
};
const listingProximity = item => {
  const miles = distanceFromViewer(item);
  if (!Number.isFinite(miles)) return '<span>Distance unavailable</span><span>Enable location for ETA</span>';
  const radius = Math.max(0, Number(item.pickupRadiusMiles) || 0);
  const pickup = ['pickup', 'pickup_delivery', 'both'].includes(item.fulfillment) && miles <= radius;
  return `<span>${miles.toFixed(miles < 10 ? 1 : 0)} mi away</span><span>${safe(deliveryEstimate(miles))}</span>${pickup ? `<strong>Pickup available · within ${radius} mi</strong>` : radius ? `<span>Pickup radius · ${radius} mi</span>` : ''}`;
};
const filtered = () => {
  const minimumPrice = priceRangeValue(priceMin); const maximumPrice = priceRangeValue(priceMax);
  return listings.filter(item => {
    const itemTags = listingTags(item).map(tag => tag.toLowerCase()); const typedTags = searchedTagTerms();
    const matches = terms => !terms.length || (tagMatchMode === 'all' ? terms.every(term => itemTags.some(tag => tag.includes(term))) : terms.some(term => itemTags.some(tag => tag.includes(term))));
    const price = Number(item.price) || 0;
    return (activeCategory === 'All' || item.category === activeCategory) && `${item.title} ${item.description} ${item.location || ''} ${itemTags.join(' ')}`.toLowerCase().includes(activeQuery.toLowerCase()) && matches(activeTags) && matches(typedTags) && lockedTags.every(tag => itemTags.some(itemTag => itemTag.includes(tag))) && !voidTags.some(tag => itemTags.some(itemTag => itemTag.includes(tag))) && (minimumPrice === null || price >= minimumPrice) && (maximumPrice === null || price <= maximumPrice);
  }).sort((left, right) => {
    const leftDate = new Date(left.createdAt || 0).valueOf(); const rightDate = new Date(right.createdAt || 0).valueOf();
    if (sortMode === 'oldest') return leftDate - rightDate;
    if (sortMode === 'popular') return ((right.likes?.length || 0) + (right.favorites?.length || 0) + stateFor(right.id).score) - ((left.likes?.length || 0) + (left.favorites?.length || 0) + stateFor(left.id).score);
    if (sortMode === 'price-high') return (Number(right.price) || 0) - (Number(left.price) || 0);
    if (sortMode === 'closest') return distanceFromViewer(left) - distanceFromViewer(right) || rightDate - leftDate;
    return rightDate - leftDate;
  });
};
const directoryItemTags = (item, type) => type === 'accounts' ? [...new Set([...listings.filter(listing => listing.ownerId === item.id).flatMap(listingTags), ...(item.profileTags || [])].map(tag => String(tag).toLowerCase()))] : (item.tags || []).map(tag => String(tag).toLowerCase());
const tagsMatchDirectory = itemTags => {
  const matches = terms => !terms.length || (tagMatchMode === 'all' ? terms.every(term => itemTags.some(tag => tag.includes(term))) : terms.some(term => itemTags.some(tag => tag.includes(term))));
  return matches(activeTags) && matches(searchedTagTerms()) && lockedTags.every(tag => itemTags.some(itemTag => itemTag.includes(tag))) && !voidTags.some(tag => itemTags.some(itemTag => itemTag.includes(tag)));
};
const filteredDirectory = () => {
  const source = searchScope === 'accounts' ? accounts : searchScope === 'brands' ? brands : searchScope === 'couriers' ? couriers : searchScope === 'chatrooms' ? chatrooms : collectives;
  const query = activeQuery.toLowerCase();
  return source.filter(item => `${item.username || ''} ${item.name || ''} ${item.bio || ''} ${item.description || ''} ${item.category || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(query) && tagsMatchDirectory(directoryItemTags(item, searchScope)));
};
const stateFor = id => postState[id] || (postState[id] = { score: 0, vote: 0, comments: [] });
const savePostState = () => localStorage.setItem('collector-marketplace-post-state', JSON.stringify(postState));
const card = item => {
  const state = stateFor(item.id); const owner = item.owner?.username || item.ownerName || 'collector'; const avatar = accountAvatar(item.owner || { username: owner }, 'listing-owner-avatar');
  const imageCount = item.images?.length || 1; const videoCount = item.videos?.length || 0; const commentCount = Number(item.commentCount || 0);
  const publicLocation = item.location || 'Location not provided';
  const fulfillmentLabel = { pickup: 'PICKUP', pickup_delivery: 'PICKUP & DELIVERY', both: 'PICKUP & DELIVERY', delivery: 'DELIVERY' }[item.fulfillment] || 'PICKUP & DELIVERY';
  const description = String(item.description || ''); const textLength = String(item.title || '').length + description.length;
  const desktopTextSpace = Math.min(330, 170 + Math.ceil(textLength / 72) * 18); const mobileTextSpace = Math.min(340, 170 + Math.ceil(textLength / 32) * 16);
  const desktopLines = Math.max(1, Math.ceil(description.length / 88)); const mobileLines = Math.max(1, Math.ceil(description.length / 38));
  const desktopDescriptionSize = Math.max(6, Math.min(11.5, (desktopTextSpace - 155) / (desktopLines * 1.35))); const mobileDescriptionSize = Math.max(4.2, Math.min(11.5, (mobileTextSpace - 170) / (mobileLines * 1.32)));
  const vipSavings = Number(item.price || 0) * .03; const vipMessage = collectorFeeRate(session?.user) <= .01 ? 'VIP Curator marketplace fee applied' : `Save ${money(vipSavings)} with VIP Curator`;
  return `<article class="listing" style="--conveyor-copy-space:${desktopTextSpace}px;--conveyor-copy-space-mobile:${mobileTextSpace}px;--listing-description-size:${desktopDescriptionSize}px;--listing-description-size-mobile:${mobileDescriptionSize}px"><header class="collector-head">${avatar}<div><strong>@${safe(owner)} <em>CURATOR</em></strong><small>★★★★★ <i>(${item.owner?.reputation || 0})</i></small></div><time datetime="${safe(item.createdAt || '')}">${safe(formatListingDate(item.createdAt))}</time></header><div class="listing-main"><button class="media" data-detail="${item.id}"><img src="${safe(item.image)}" alt="${safe(item.title)}"><span class="grade">${safe(item.category)}</span>${imageCount > 1 || videoCount ? `<span class="image-count">${imageCount} photo${imageCount === 1 ? '' : 's'}${videoCount ? ` · ${videoCount} video${videoCount === 1 ? '' : 's'}` : ''}</span>` : ''}</button><section class="listing-copy"><h2>${safe(item.title)}</h2><div class="meta">COLLECTORMARKETPLACE.NET</div><p class="listing-location" aria-label="Item condition, public location, and fulfillment">${safe(item.condition || 'Condition not specified')} · ⌖ ${safe(publicLocation)} · ${safe(fulfillmentLabel)}</p><div class="listing-proximity" aria-label="Distance, delivery estimate, and pickup eligibility">${listingProximity(item)}</div><p class="listing-description" aria-label="Full listing description"><b>@${safe(owner)} ★★★★★</b><br>${safe(item.description)}</p><footer class="listing-actions"><button class="listing-action action-buy" data-purchase="${item.id}"><span>BUY</span><b>$${item.price}</b></button><button class="listing-action" data-trade="${item.id}"><span>⇄</span> TRADE</button><span class="vote-control"><button type="button" class="listing-action vote ${state.vote === 1 ? 'selected' : ''}" data-vote="up" data-post="${item.id}" aria-label="Upvote ${safe(item.title)}">▲</button><output>${state.score}</output><button type="button" class="listing-action vote ${state.vote === -1 ? 'selected' : ''}" data-vote="down" data-post="${item.id}" aria-label="Downvote ${safe(item.title)}">▼</button></span><button type="button" class="listing-action favorite-button ${state.favorite ? 'selected' : ''}" data-favorite="${item.id}" aria-pressed="${state.favorite ? 'true' : 'false'}" aria-label="Favorite ${safe(item.title)}">♥</button><button type="button" class="listing-action comment-button" data-comments="${item.id}" aria-label="${commentCount} comments on ${safe(item.title)}">◌ <b>${commentCount}</b> <span>COMMENTS</span></button></footer><small class="vip-savings">${vipMessage}</small></section></div></article>`;
};
const renderVisibleCheckoutEstimates = async () => { if (!checkoutPreferences.estimateEnabled || !checkoutPreferences.coordinates || !checkoutPreferences.deliveryProvider) return; const buttons = [...document.querySelectorAll('[data-purchase]')]; await Promise.all(buttons.map(async button => { const item = listings.find(row => row.id === button.dataset.purchase); if (!item) return; let seller = item.locationCoordinates; if (!seller || !Number.isFinite(Number(seller.lat)) || !Number.isFinite(Number(seller.lng))) { const zip = zipFromAddress(item.sellerZip); if (!zip) return; try { seller = await coordinatesForZip(zip); } catch { return; } } const miles = milesBetween(checkoutPreferences.coordinates, seller); const price = Number(item.price) || 0; const delivery = Math.max(8, miles * .10) + Math.max(0, Number(item.upsPackagingCost) || 0); const subtotal = price + delivery + price * collectorFeeRate(session?.user) + (price < 10 ? 10 : 0); button.innerHTML = `<span>BUY EST</span><b>${money(subtotal + paypalProcessingFee(subtotal))}</b><small>before tax</small>`; })); };

function renderCategories() { const types = ['All', ...[...new Set([...categoryOptions, ...listings.map(item => item.category)])].sort((left, right) => left.localeCompare(right))]; categories.innerHTML = types.map(type => `<button class="${type === activeCategory ? 'active' : ''}" data-category="${safe(type)}">${safe(type)}</button>`).join(''); }
function renderAudienceTags() { audienceTags.innerHTML = audienceTagOptions.map(tag => { const selected = activeTags.includes(tag.toLowerCase()); return `<button type="button" class="${selected ? 'active' : ''}" data-tag="${safe(tag)}" aria-pressed="${selected}">#${safe(tag)}</button>`; }).join(''); }
 function renderTags(filter = tagSearch.value) { const match = filter.trim().replace(/#/g, '').toLowerCase(); const available = new Set([...categoryOptions, ...listings.flatMap(listingTags)]); const usLocationTags = [...new Set(listings.flatMap(listingTags).filter(tag => tag.startsWith('US City/Town: ')))]; const bottomGroups = ['Artisan Alcohol (21+ Only)', 'Adult Only (18+)', 'Bra Sizes', 'Height & Waist Sizes', 'Object Dimensions', 'Weights & Materials', 'Colors', 'Location']; const grouped = Object.entries(tagGroups).sort(([left], [right]) => { const leftRank = bottomGroups.indexOf(left); const rightRank = bottomGroups.indexOf(right); if (leftRank !== -1 || rightRank !== -1) return (leftRank === -1 ? -1 : leftRank) - (rightRank === -1 ? -1 : rightRank); const sortNames = { 'Fashion & Luxury': 'Fashion 01', Styles: 'Fashion 02', 'Art, History & Materials': 'Fashion 02.25', 'Clothing & Shoe Sizes': 'Fashion 02.5', 'Clothing Designs & Formats': 'Fashion 02.75', 'Shoes & Sneakers': 'Fashion 03.5', 'Food & Drink': 'Fashion 04', 'Top Brands': 'Artisan Cheese', 'Artisan Cheese': 'Top Brands' }; const sortName = name => sortNames[name] || name; return sortName(left).localeCompare(sortName(right)); }).map(([name, values]) => [name, (name === 'Location' ? usLocationTags : values).filter(tag => available.has(tag) && tag.toLowerCase().includes(match)).sort((left, right) => left.localeCompare(right))]).filter(([name, values]) => values.length || ((name === 'Top Brands' || name === 'Location') && !match)); tags.innerHTML = grouped.length ? grouped.map(([name, values]) => `<section class="tag-group"><h3>${safe(name)}</h3><div class="tag-group-buttons">${values.length ? values.map(tag => { const selected = activeTags.includes(tag.toLowerCase()); return `<button type="button" class="${selected ? 'active' : ''}" data-tag="${safe(tag)}" aria-pressed="${selected}">#${safe(tag)}</button>`; }).join('') : `<span class="empty-tag">${name === 'Location' ? 'US city and town tags appear as listings are posted.' : 'Brand tags coming soon.'}</span>`}</div></section>`).join('') : '<span class="empty-tag">No tags found.</span>'; }
const socialActions = (item, type) => {
  const id = safe(item.id); const name = safe(item.username || item.name || 'collector');
  if (type === 'accounts') { const own = session?.user?.id === item.id; const following = session?.user?.following?.includes(item.id); return `<div class="directory-actions"><button type="button" data-directory-page="accounts" data-directory-id="${id}">${own ? 'Your profile' : 'View profile'}</button>${own ? '' : `<button type="button" data-follow="${id}">${following ? 'Following' : 'Follow'}</button><button type="button" data-collector-chat="${id}">Message</button>`}<button type="button" class="directory-primary" data-community="accounts" data-community-id="${id}" data-community-label="@${name}">Discuss</button></div>`; }
  if (type === 'chatrooms') return `<div class="directory-actions"><button type="button" data-community="chatrooms" data-community-id="${id}" data-community-label="${name}">Discuss</button><button type="button" class="directory-primary" data-chatroom="${id}" data-chatroom-label="${name}">Join live room</button></div>`;
  if (type === 'couriers') return `<div class="directory-actions"><button type="button" class="directory-primary" data-directory-page="couriers" data-directory-id="${id}">View service</button></div>`;
  return `<div class="directory-actions"><button type="button" data-directory-page="${safe(type)}" data-directory-id="${id}">View community</button><button type="button" class="directory-primary" data-community="${safe(type)}" data-community-id="${id}" data-community-label="${name}">Discuss</button></div>`;
};
const directoryCard = (item, type) => {
  const label = type === 'accounts' ? 'Collector' : type === 'collectives' ? 'Group' : type === 'chatrooms' ? 'Live room' : type === 'couriers' ? 'Delivery service' : 'Brand community';
  const title = type === 'accounts' ? `@${safe(item.username)}` : safe(item.name);
  const description = safe(item.bio || item.description || 'Collector community');
  const stats = type === 'accounts' ? `${Number(item.activeListingCount || 0)} posts · ${Number(item.followingCount || 0)} following · ${Number(item.reputation || 0)} reputation` : type === 'couriers' ? safe(item.category || 'Courier') : `${Number(item.members || 0).toLocaleString()} members${item.postCount !== undefined ? ` · ${Number(item.postCount || 0)} posts` : ''}`;
  const itemTags = type === 'accounts' ? item.profileTags || [] : item.tags || [];
  return `<article class="search-directory-card social-directory-card"><header><span>${label}</span><b>${title}</b></header><p>${description}</p><small>${stats}</small>${itemTags.length ? `<div class="directory-tags">${itemTags.slice(0, 4).map(tag => `<button type="button" data-tag="${safe(tag)}">#${safe(tag)}</button>`).join('')}</div>` : ''}${socialActions(item, type)}</article>`;
};
function renderFeed(reset = true) {
  if (searchScope !== 'listings') { const rows = filteredDirectory(); const meta = socialScopeMeta[searchScope]; stream.innerHTML = rows.map(item => directoryCard(item, searchScope)).join('') || `<p class="load-state">No ${meta.noun}s match that search yet.</p>`; document.querySelector('#result-count').textContent = `${rows.length} ${meta.noun}${rows.length === 1 ? '' : 's'}`; sentinel.textContent = rows.length ? 'Community directory complete.' : 'Try another name, interest, or tag.'; syncBrowseModeUi(); return; }
  const rows = filtered(); if (reset) page = 1; const visible = browseMode === 'conveyor' ? rows : rows.slice(0, page * 4);
  const originalCards = visible.map(card).join(''); const conveyorCopies = browseMode === 'conveyor' && visible.length ? Array.from({ length: 2 }, () => visible.map(item => card(item).replace('<article class="listing"', '<article class="listing" data-conveyor-copy="true"')).join('')).join('') : '';
  stream.innerHTML = originalCards ? originalCards + conveyorCopies : '<p class="load-state">No collector finds match that search.</p>';
  stream.querySelectorAll('.listing .collector-head').forEach((header, index) => { const item = visible[index % visible.length]; header.dataset.profile = item?.ownerId || ''; header.tabIndex = 0; header.setAttribute('role', 'button'); header.setAttribute('aria-label', `Open ${item?.owner?.username || 'collector'} profile`); });
  document.querySelector('#result-count').textContent = `${rows.length} listed`; sentinel.textContent = browseMode === 'conveyor' ? 'Conveyor mode · looping continuously' : page * 4 < rows.length ? 'Scroll for more finds ↓' : 'You are all caught up.'; syncBrowseModeUi(); renderVisibleCheckoutEstimates();
}
function openAppSection(kind, title, copy, content = '') {
  if (modal.open) modal.close(); stopAutoScroll(); stopConveyor(); stopAuctionWaterfall(); stopJungleChatGame(); stopJungleChatAmbience(); stopAccountVeniceAmbience(); stopSellLavaAmbience(); stopSellLavaGame(); stopVeniceSailingGame(); clearInterval(auctionClock); clearInterval(auctionFeedClock);
  document.querySelector('.conveyor-smog-layer')?.remove();
  document.querySelector('.conveyor-orbit-layer')?.remove();
  document.body.classList.remove('auction-mode', 'browse-conveyor', 'chat-open', 'account-open', 'purchase-open', 'comments-open', 'listing-page', 'app-section-chat', 'app-section-account', 'app-section-listing', 'app-section-membership');
  document.body.classList.add('app-section-mode', `app-section-${kind}`); syncBrowseModeUi(); if (kind === 'chat') startJungleChatAmbience(); if (kind === 'account') startAccountVeniceAmbience(); if (kind === 'listing') startSellLavaAmbience(); if (observer) observer.disconnect(); sentinel.hidden = true;
  const workspaceLabel = kind === 'account' ? 'Collector workspace' : kind === 'membership' ? 'Membership' : 'Social workspace';
  stream.innerHTML = `<section class="app-section-page"><header class="app-section-intro"><span>${workspaceLabel}</span><h1>${title}</h1><p>${copy || ''}</p></header><div class="app-section-content">${content}${kind === 'account' ? '<div class="account-sailing-game-host" aria-label="Venice Cannon Run game"></div>' : ''}${kind === 'listing' ? '<div class="sell-lava-game-host" aria-label="Lava Dash Run game"></div>' : ''}</div></section>`;
  if (kind === 'account') { syncAccountVeniceControl(); mountVeniceSailingGame(); }
  if (kind === 'listing') mountSellLavaGame();
  queueMicrotask(() => { modal.className = ''; document.body.classList.remove('chat-open', 'account-open'); });
  requestAnimationFrame(() => { if (kind === 'chat') mountJungleChatGame(); window.scrollTo({ top: 0, behavior: 'smooth' }); const thread = stream.querySelector('.collector-thread'); if (thread) thread.scrollTop = thread.scrollHeight; stream.querySelector('.collector-message-form textarea')?.focus({ preventScroll: true }); });
}
function openModal(title, copy, form) {
  const sectionKind = title === 'Messages' || title.startsWith('Chat · @') ? 'chat' : copy === 'Manage your collector profile and marketplace activity.' ? 'account' : '';
  if (sectionKind && workspaceIntent !== sectionKind) return;
  if (sectionKind) return openAppSection(sectionKind, title, copy, form);
  modal.className = '';
  document.body.classList.remove('purchase-open', 'comments-open');
  modalContent.innerHTML = `<h2 class="modal-title">${title}</h2><p class="modal-copy">${copy}</p>${form || ''}`;
  if (!modal.open) modal.showModal();
  syncBrowseModeUi();
  if (form?.includes('listing-form')) {
    const listingForm = modalContent.querySelector('.listing-form');
    if (!listingForm?.querySelector('[name="sellerCity"]')) listingForm.querySelector('.listing-form-grid')?.insertAdjacentHTML('afterend', `<section class="listing-location-panel"><p class="listing-step">02 · LOCATION & HANDOFF</p><div class="listing-location-grid"><label>Seller city + state/region<input required name="sellerCity" maxlength="80" autocomplete="address-level2" placeholder="e.g. Portland, OR"></label><label>ZIP code<input required name="sellerZip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" placeholder="97205"></label><label>Pickup radius (miles)<input required name="pickupRadiusMiles" type="number" min="0" max="500" step="1" value="25"></label><label>UPS packaging cost<input name="shippingPackagingCost" type="number" min="0" max="1000" step="0.01" value="0"></label></div><fieldset class="listing-fulfillment-field"><legend>Fulfillment</legend><div><label><input required type="radio" name="fulfillment" value="pickup_delivery" checked> Pickup & delivery</label><label><input type="radio" name="fulfillment" value="pickup"> Pickup only</label></div><small>Set the documented UPS box, padding, and handling cost. Buyers see this amount before ordering.</small></fieldset><fieldset class="listing-fulfillment-field listing-auction-field"><legend>Where to list it</legend><div><label><input required type="radio" name="listingMode" value="marketplace" checked> Marketplace</label><label><input type="radio" name="listingMode" value="auction_only"> Auction only</label><label><input type="radio" name="listingMode" value="marketplace_auction"> Both</label></div><section class="auction-listing-details" hidden><label>Starting bid<input name="auctionStartPrice" type="number" min="0" step="0.01" placeholder="0.00"></label><label>Auction length<select name="auctionDurationHours"><option value="24">1 day</option><option value="72" selected>3 days</option><option value="168">7 days</option></select></label></section></fieldset><input type="hidden" name="locationLat"><input type="hidden" name="locationLng"><button type="button" class="location-capture" data-capture-location>Add approximate location for distance</button><span class="location-capture-note">Optional. It improves distance and pickup estimates; your exact location is never shown.</span></section>`);
    modalContent.querySelectorAll('.listing-step').forEach(step => { if (step.textContent.includes('ADD MEDIA')) step.textContent = '03 · ADD MEDIA'; if (step.textContent.includes('TELL THE STORY')) step.textContent = '04 · TELL THE STORY'; });
    const required = modalContent.querySelector('.listing-publish-bar span');
    if (required) required.textContent = 'Required: title, category, condition, price, city, ZIP, fulfillment, description, and one photo.';
    restoreListingDraft(listingForm);
  }
}
function openAuthPanel(mode = 'signup') { const login = mode === 'login'; const introduction = login ? 'Welcome back. Sign in to continue collecting, selling, and trading.' : 'Start your collector profile to list finds, trade safely, and join the community.'; const emailFields = `${login ? '' : '<label class="auth-field"><span>Collector name</span><input required name="username" maxlength="32" autocomplete="username" placeholder="Choose your public name"></label>'}<label class="auth-field"><span>Email address</span><input required name="email" type="email" autocomplete="email" placeholder="you@example.com"></label><label class="auth-field password-field"><span>Password</span><input required name="password" type="password" minlength="8" placeholder="At least 8 characters" autocomplete="${login ? 'current-password' : 'new-password'}"><button type="button" data-password-toggle aria-label="Show password" aria-pressed="false">◉</button></label>`; openModal(login ? 'Sign in' : 'Create your account', introduction, `<section class="auth-shell"><a class="google-auth-button" href="/auth/google"><span aria-hidden="true">G</span><b>Continue with Google</b><small>Fast, secure sign-in</small></a><div class="auth-divider"><span>or continue with email</span></div><form class="modal-form auth-form" data-mode="${mode}">${emailFields}<button class="auth-submit">${login ? 'Sign in securely' : 'Create collector account'}</button></form><p class="auth-privacy">By continuing, you agree to the User Agreement and Privacy Policy.</p><button type="button" class="auth-switch" data-auth-switch="${login ? 'signup' : 'login'}">${login ? 'New to CollectorMarketplace? Create an account' : 'Already have an account? Sign in'}</button></section>`); }
async function openShippingProfile() {
  if (!session) return openAuthPanel('login');
  const profile = await api('/account/shipping-profile');
  openModal('Private shipping settings', 'Save a delivery address privately to your account. It is never shown on your public profile and only pre-fills checkout for you.', `<form class="modal-form shipping-profile-form"><label>Full name<input required name="name" maxlength="120" autocomplete="shipping name" value="${safe(profile.name || '')}" placeholder="Full name"></label><label>Street address<input required name="street1" maxlength="160" autocomplete="shipping street-address" value="${safe(profile.street1 || '')}" placeholder="Street and number"></label><label>Address line 2 <i>Optional</i><input name="street2" maxlength="120" autocomplete="shipping address-line2" value="${safe(profile.street2 || '')}" placeholder="Apartment, suite, etc."></label><div class="shipping-profile-city"><label>City<input required name="city" maxlength="80" autocomplete="shipping address-level2" value="${safe(profile.city || '')}"></label><label>State<input required name="state" maxlength="2" pattern="[A-Za-z]{2}" autocomplete="shipping address-level1" value="${safe(profile.state || '')}" placeholder="CA"></label><label>ZIP code<input required name="zip" maxlength="10" pattern="[0-9]{5}(-[0-9]{4})?" inputmode="numeric" autocomplete="shipping postal-code" value="${safe(profile.zip || '')}" placeholder="94103"></label></div><small>This information is private. You can change it for any individual order before paying.</small><button>Save private shipping settings</button></form>`);
}
const hasActiveCuratorMembership = profile => {
  const expiresAt = profile?.curatorMembershipExpiresAt;
  return (profile?.curator === true || profile?.membership === 'curator') && (!expiresAt || new Date(expiresAt).valueOf() > Date.now());
};
const accountTitleBadge = profile => {
  if (profile?.developerPass === true) return '<span class="account-title-badge developer-pass">DEV PASS</span>';
  if (hasActiveCuratorMembership(profile)) return '<span class="account-title-badge">VIP CURATOR</span>';
  return '';
};
function profileWorkspace(profile, { own = false, following = false, connections = null, suggestions = [] } = {}) { const activeListings = profile.activeListings || []; const profileTags = profile.profileTags || []; const listingsMarkup = activeListings.length ? activeListings.map(item => `<button type="button" class="profile-listing-card" data-detail="${safe(item.id)}"><img src="${safe(item.image || item.images?.[0] || '')}" alt="${safe(item.title)}"><b>${safe(item.title)}</b><span>${money(item.price)}</span><small>${safe(formatListingDate(item.createdAt))}</small></button>`).join('') : '<p class="profile-empty">This collector has no active listings right now.</p>'; const people = rows => rows?.length ? rows.map(person => `<button type="button" class="connection-row" data-profile="${person.id}">${accountAvatar(person, 'connection-avatar')}<span><b>@${safe(person.username)}</b><small>${Number(person.reputation || 0)} reputation</small></span></button>`).join('') : '<p class="profile-empty">No collectors here yet.</p>'; const suggested = suggestions.length ? suggestions.map(person => `<article class="suggested-account">${accountAvatar(person, 'connection-avatar')}<div><strong>@${safe(person.username)}</strong><small>${Number(person.activeListingCount || 0)} active posts · ${Number(person.reputation || 0)} reputation</small></div><button type="button" data-account-follow="${person.id}">Follow</button></article>`).join('') : '<p class="profile-empty">No new collectors to suggest right now.</p>'; const accountTools = own ? `<section class="profile-account-tools"><section><h4>Following <small>${connections.following.length}</small></h4>${people(connections.following)}</section><section><h4>Friends <small>${connections.friends.length}</small></h4>${people(connections.friends)}</section><section><h4>Discover collectors</h4>${suggested}</section></section>` : ''; return `<section class="profile-workspace"><header class="profile-hero">${accountAvatar(profile, 'account-avatar')}<div><p class="profile-kicker">COLLECTOR PROFILE</p><div class="profile-title-row"><h3>@${safe(profile.username)}</h3>${accountTitleBadge(profile)}</div><span>${safe(profile.bio || 'A collector building their marketplace presence.')}</span></div>${own ? '<button type="button" data-account-edit>Edit profile</button>' : session ? `<button type="button" data-follow="${profile.id}">${following ? 'Following' : 'Follow'}</button>` : ''}</header><aside class="profile-summary"><h4>Collector overview</h4><div class="profile-metrics"><span><b>${activeListings.length}</b>Active posts</span><span><b>${profile.tradeHistory?.length || 0}</b>Completed trades</span><span><b>${Number(profile.reputation || 0)}</b>Reputation</span><span><b>${own ? 'You' : following ? '✓' : '—'}</b>Connection</span></div><h4>Discovery tags</h4><div class="profile-tag-list">${profileTags.length ? profileTags.map(tag => `<button type="button" data-tag="${safe(tag)}">#${safe(tag)}</button>`).join('') : '<span class="profile-empty">No profile tags yet.</span>'}</div></aside><section class="profile-listings"><h4>Active listings <small>${activeListings.length}</small></h4><div class="profile-listing-grid">${listingsMarkup}</div></section>${accountTools}<footer class="profile-footer">${own ? '<button type="button" class="entity-primary" data-shipping-profile>Private shipping settings</button><button type="button" class="entity-primary" data-delivery-center>Delivery center</button><button type="button" class="entity-primary" data-chat>Open messages</button><button type="button" class="entity-primary" data-signout>Sign out</button>' : `<button type="button" class="entity-primary" data-community="accounts" data-community-id="${profile.id}" data-community-label="@${safe(profile.username)}">Open discussion</button>${session ? `<button type="button" class="entity-primary" data-collector-chat="${profile.id}">Message collector</button>` : ''}`}</footer></section>`; }
const managedListingCard = item => { const archived = item.status === 'archived'; const rate = collectorFeeRate(session?.user); const fee = Number(item.price || 0) * rate; const controls = archived ? `<button type="button" data-listing-edit="${safe(item.id)}">Edit</button><button type="button" data-listing-archive="${safe(item.id)}" data-listing-next-status="active">Restore</button><button type="button" class="listing-delete" data-listing-delete="${safe(item.id)}">Delete</button>` : `<button type="button" data-listing-archive="${safe(item.id)}" data-listing-next-status="archived" data-listing-edit-after="true">Save for later & edit</button><button type="button" class="listing-delete" data-listing-delete="${safe(item.id)}">Delete</button>`; return `<article class="managed-listing-card ${archived ? 'is-archived' : ''}"><img src="${safe(item.images?.[0] || item.image || '')}" alt="${safe(item.title)}"><div><small>${archived ? 'ARCHIVED · hidden from marketplace' : 'ACTIVE · visible in marketplace'}</small><b>${safe(item.title)}</b><span>${money(item.price)} · ${safe(item.condition || 'Condition not specified')}</span><em class="seller-fee-line">Your seller fee · ${rate * 100}% (${money(fee)})</em></div><footer>${controls}</footer></article>`; };
const listingManagementMarkup = rows => { const active = rows.filter(item => item.status === 'active'); const archived = rows.filter(item => item.status === 'archived'); const rate = collectorFeeRate(session?.user); const activeValue = active.reduce((total, item) => total + Number(item.price || 0), 0); const rateLabel = rate === 0 ? 'Developer Pass · 0%' : rate === .01 ? 'VIP Curator · 1%' : 'Standard seller fee · 4%'; return `<section class="listing-management"><header><div><p>LISTING MANAGEMENT</p><h4>Manage your marketplace posts</h4></div><button type="button" data-sell>List an item</button></header><section class="seller-fee-summary"><div><b>${rateLabel}</b><span>Applied only when an item sells.</span></div><strong>${money(activeValue * rate)} <small>on ${money(activeValue)} active value</small></strong></section><section><h5>Active <small>${active.length}</small></h5><div class="managed-listing-grid">${active.length ? active.map(managedListingCard).join('') : '<p class="profile-empty">No active listings yet.</p>'}</div></section><section><h5>Archived <small>${archived.length}</small></h5><div class="managed-listing-grid">${archived.length ? archived.map(managedListingCard).join('') : '<p class="profile-empty">Archived listings stay here until you restore or delete them.</p>'}</div></section></section>`; };
async function openListingEditor(listingId) { const item = await api(`/listing/${listingId}`); if (!session?.user || item.ownerId !== session.user.id) throw new Error('You can only edit your own listings.'); const conditions = (tagGroups.Conditions || []).map(condition => `<option value="${safe(condition)}" ${condition === item.condition ? 'selected' : ''}>${safe(condition)}</option>`).join(''); const tags = (item.tags || []).filter(tag => !String(tag).startsWith('US City/Town: ')).join(', '); openModal(`Edit · ${safe(item.title)}`, 'Changes are saved to this listing. Archive it from your account when you want it hidden from the public marketplace.', `<form class="modal-form listing-editor-form" data-listing-editor="${safe(item.id)}"><label>Title<input required name="title" maxlength="120" value="${safe(item.title)}"></label><label>Category<input required name="category" maxlength="80" value="${safe(item.category)}"></label><label>Condition<select required name="condition">${conditions}</select></label><label>Price (USD)<input required name="price" type="number" min="0" step="0.01" value="${safe(item.price)}"></label><label>UPS packaging cost<input name="upsPackagingCost" type="number" min="0" max="1000" step="0.01" value="${safe(item.upsPackagingCost || 0)}"></label><label>Tags <small>Comma-separated</small><input name="tags" maxlength="420" value="${safe(tags)}"></label><label>Image links <small>One per line</small><textarea name="images" maxlength="12000">${safe((item.images || []).join('\n'))}</textarea></label><label>Description<textarea required name="description" maxlength="2000">${safe(item.description)}</textarea></label><label class="check"><input name="tradeOffer" type="checkbox" ${item.tradeOffer ? 'checked' : ''}> Open to trade offers</label><button type="submit">Save listing changes</button></form>`); modal.classList.add('listing-dialog'); }
async function openAccountPanel() { if (!session?.user) return openAuthPanel(); const routeId = beginWorkspaceRoute(); const userId = session.user.id; const [profile, connections, suggestions, managedListings] = await Promise.all([api(`/user/${userId}`).catch(() => ({ ...session.user, activeListings: listings.filter(item => item.ownerId === userId), tradeHistory: [] })), api(`/user/${userId}/connections`).catch(() => ({ friends: [], following: [] })), api('/users/suggestions').catch(() => []), api(`/user/${userId}/listings`).catch(() => listings.filter(item => item.ownerId === userId))]); if (routeId !== workspaceRouteId) return; session = { ...session, user: { ...session.user, lobbySong: profile.lobbySong || '' } }; saveSession(session); openModal(`@${safe(profile.username)}`, 'Manage your collector profile and marketplace activity.', profileWorkspace(profile, { own: true, connections, suggestions }) + listingManagementMarkup(managedListings)); if (modal.open) { modal.classList.add('profile-dialog'); document.body.classList.add('account-open'); mountLobbySong(profile); } }
const renderAccountWorkspace = openAccountPanel;
openAccountPanel = (...args) => { beginWorkspaceRoute('account'); return renderAccountWorkspace(...args); };
async function openCuratorMembership() {
  if (!session?.user) return openAuthPanel('login');
  const routeId = beginWorkspaceRoute('membership');
  const details = await api('/membership/vip-curator');
  if (routeId !== workspaceRouteId) return;
  if (details.developerPass) return openAppSection('membership', 'VIP Curator', 'Your Developer Pass already includes the VIP marketplace fee benefit.', '<section class="vip-membership-page"><div class="vip-membership-status"><b>DEV PASS ACTIVE</b><span>You already receive a 0% marketplace fee benefit for life.</span></div><button type="button" class="entity-primary" data-account>Open your account</button></section>');
  const active = details.active;
  const expiry = details.expiresAt ? new Date(details.expiresAt).toLocaleDateString() : '';
  const checkout = active ? `<section class="vip-membership-status"><b>VIP CURATOR ACTIVE</b><span>Your current membership is active through ${safe(expiry)}. Buy another month to extend it.</span></section>` : '<section class="vip-membership-status"><b>READY TO JOIN</b><span>Your VIP title and 1% marketplace fee activate after PayPal confirms payment.</span></section>';
  openAppSection('membership', 'VIP Curator', 'Unlock the VIP Curator title and reduced marketplace fee for one 30-day membership period.', `<section class="vip-membership-page"><section class="vip-membership-card"><p>VIP CURATOR</p><h2>$150 <small>/ 30 days</small></h2><ul><li>VIP CURATOR title on your public account</li><li>1% marketplace fee on your own side of purchases and trades</li><li>Extend your membership any time</li></ul>${checkout}<div class="vip-paypal-button-container" aria-live="polite"></div><small>One secure PayPal payment activates 30 days. It does not renew automatically.</small></section></section>`);
  renderPayPalButtonForVipCurator(stream.querySelector('.vip-paypal-button-container'));
}
const renderProfileWorkspace = openProfile;
openProfile = (...args) => { beginWorkspaceRoute('account'); return renderProfileWorkspace(...args); };
async function readLobbySong(file) {
  if (!(file instanceof File) || !file.size) return '';
  if (!['audio/mpeg', 'audio/mp3'].includes(file.type) && !/\.mp3$/i.test(file.name)) throw new Error('Use an MP3 for your lobby song.');
  if (file.size > 4 * 1024 * 1024) throw new Error('Keep your lobby song under 4 MB.');
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(new Error('Could not read that MP3.')); reader.readAsDataURL(file); });
}
function mountLobbySong(profile, root = modalContent) {
  const song = String(profile?.lobbySong || ''); const hero = root?.querySelector('.profile-hero');
  if (!song || !hero || root.querySelector('.profile-lobby-song')) return;
  hero.insertAdjacentHTML('afterend', `<section class="profile-lobby-song"><div><small>LOBBY SONG</small><b>@${safe(profile.username)}'s profile music</b><span>Plays when this collector profile opens.</span></div><button type="button" data-lobby-song-toggle aria-pressed="false">▶ Play song</button><audio preload="metadata" data-lobby-song src="${safe(song)}"></audio></section>`);
  const audio = root.querySelector('[data-lobby-song]'); const button = root.querySelector('[data-lobby-song-toggle]');
  if (!audio || !button) return;
  const sync = () => { const playing = !audio.paused; button.textContent = playing ? '❚❚ Pause song' : '▶ Play song'; button.setAttribute('aria-pressed', String(playing)); };
  audio.addEventListener('play', sync); audio.addEventListener('pause', sync); audio.play().catch(sync);
}
async function openProfile(id) { if (!id) return; if (session?.user?.id === id) return openAccountPanel(); const routeId = beginWorkspaceRoute(); const profile = await api(`/user/${id}`); if (routeId !== workspaceRouteId) return; const following = Boolean(session?.user?.following?.includes(id)); openAppSection('account', `@${safe(profile.username)}`, `${safe(profile.bio || 'Collector profile')} · Reputation ${profile.reputation || 0}`, profileWorkspace(profile, { following })); mountLobbySong(profile, stream); }
async function openCommunity(type, entityId, label = 'Community') { const data = await api(`/community/${encodeURIComponent(type)}/${encodeURIComponent(entityId)}`); const renderReplies = post => (post.replies || []).length ? `<div class="community-replies">${post.replies.map(reply => `<p><b>@${safe(reply.author?.username || 'collector')}</b><span>${safe(reply.body)}</span></p>`).join('')}</div>` : ''; const threads = data.posts.length ? data.posts.map(post => `<article class="community-thread"><header><b>@${safe(post.author?.username || 'collector')}</b><time>${safe(formatListingDate(post.createdAt))}</time></header><h3>${safe(post.title)}</h3><p>${safe(post.body)}</p>${renderReplies(post)}${session ? `<form class="modal-form community-reply-form" data-community-type="${safe(type)}" data-community-id="${safe(entityId)}" data-community-post="${safe(post.id)}"><textarea required name="body" maxlength="2000" placeholder="Reply to this thread"></textarea><button>Reply</button></form>` : ''}</article>`).join('') : '<p class="modal-copy">No discussion threads yet. Start the conversation.</p>'; const composer = session ? `<form class="modal-form community-post-form" data-community-type="${safe(type)}" data-community-id="${safe(entityId)}"><input required name="title" maxlength="140" placeholder="Start a discussion"><textarea required name="body" maxlength="2000" placeholder="Share a question, find, or conversation starter"></textarea><button type="submit">Post discussion</button></form>` : '<p class="modal-copy">Sign in to start a thread or reply.</p>'; openModal(`${safe(label)} discussion`, 'Community conversations are public to collectors. Keep personal payment and delivery details inside private chats.', `<section class="community-workspace"><header><span>${safe(type)}</span><h3>${safe(data.entity.name || label)}</h3></header>${composer}<section class="community-thread-list">${threads}</section></section>`); modal.classList.add('chat-dialog', 'community-dialog'); document.body.classList.add('chat-open'); }
async function openDirectoryPage(type, entityId) { if (type === 'accounts') return openProfile(entityId); const source = type === 'brands' ? brands : type === 'couriers' ? couriers : type === 'chatrooms' ? chatrooms : collectives; const entity = source.find(item => item.id === entityId); if (!entity) throw new Error('This directory page is unavailable.'); const name = entity.name; const tags = entity.tags || []; const stats = type === 'couriers' ? `${entity.category || 'Courier'} · ${entity.description || ''}` : `${Number(entity.members || 0).toLocaleString()} members${entity.postCount !== undefined ? ` · ${entity.postCount} matching posts` : ''}`; const discussion = type === 'couriers' ? '' : `<button type="button" class="entity-primary" data-community="${safe(type)}" data-community-id="${safe(entity.id)}" data-community-label="${safe(name)}">Open discussion</button>`; const voice = type === 'chatrooms' ? `<button type="button" class="entity-primary" data-chatroom="${safe(entity.id)}" data-chatroom-label="${safe(name)}">Join live voice room</button>` : ''; openModal(name, safe(entity.description || 'Collector marketplace directory page.'), `<section class="entity-workspace"><header><span>${safe(type.slice(0, -1))}</span><h3>${safe(name)}</h3><p>${safe(stats)}</p></header><section class="entity-tags"><h3>Discovery tags</h3>${tags.length ? tags.map(tag => `<button type="button" data-tag="${safe(tag)}">#${safe(tag)}</button>`).join('') : '<p>No tags have been added yet.</p>'}</section><footer>${discussion}${voice}</footer></section>`); modal.classList.add('chat-dialog', 'entity-dialog'); document.body.classList.add('chat-open'); }
function imageUrls(value) { return value.split(/[\n,]+/).map(url => url.trim()).filter(url => /^https?:\/\//i.test(url)); }
function renderImagePreview(images = [], videos = []) { const preview = document.querySelector('#listing-image-preview'); if (!preview) return; const photoCount = images.length; const videoCount = videos.length; preview.dataset.mediaCount = `${photoCount} / 5 photo${photoCount === 1 ? '' : 's'}${videoCount ? ` · ${videoCount} video` : ''}`; const photoStatus = document.querySelector('[data-photo-count]'); if (photoStatus) photoStatus.textContent = `${photoCount} / 5 photos added`; const photos = images.map((url, index) => `<figure class="preview-card"><img src="${safe(url)}" alt="Listing image preview ${index + 1}"><figcaption>Photo ${index + 1}${url.startsWith('data:') ? ' · uploaded' : ' · link'}</figcaption></figure>`).join(''); const clips = videos.map((url, index) => `<figure class="preview-card preview-video"><video src="${safe(url)}" controls preload="metadata"></video><figcaption>Video ${index + 1} · uploaded</figcaption></figure>`).join(''); preview.innerHTML = photos || clips ? photos + clips : '<div class="preview-empty"><b>Add listing media</b><span>Upload up to 5 photos and one short video, or paste image links.</span></div>'; }
async function optimizeListingImage(file) { if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`); if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB.`); const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); }); const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error(`Could not prepare ${file.name}.`)); element.src = source; }); const scale = Math.min(1, 1600 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', .82); }
async function cropListingImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name || 'Pasted item'} is not an image.`);
  if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name || 'Pasted image'} is larger than 8 MB.`);
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read that image.')); reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error('Could not prepare that image.')); element.src = source; });
  return new Promise(resolve => {
    const overlay = document.createElement('section'); overlay.className = 'listing-cropper'; overlay.innerHTML = `<div class="listing-cropper-panel"><header><div><p>EDIT PHOTO</p><h3>Crop & size</h3></div><button type="button" data-crop-cancel>Cancel</button></header><canvas width="900" height="1125" aria-label="Image crop preview"></canvas><div class="listing-crop-controls"><label>Zoom<input type="range" min="1" max="3" step="0.01" value="1" data-crop-zoom></label><p>Drag the image to position it. Your photo will be saved in a collector-friendly 4:5 frame.</p></div><footer><button type="button" data-crop-skip>Use original</button><button type="button" data-crop-apply>Use this crop</button></footer></div>`; document.body.append(overlay);
    const canvas = overlay.querySelector('canvas'); const context = canvas.getContext('2d'); const zoomInput = overlay.querySelector('[data-crop-zoom]'); let zoom = 1; let offsetX = null; let offsetY = null; let dragging = false; let last = null;
    const draw = () => { const base = Math.max(canvas.width / image.width, canvas.height / image.height); const scale = base * zoom; const width = image.width * scale; const height = image.height * scale; const minX = Math.min(0, canvas.width - width); const minY = Math.min(0, canvas.height - height); if (offsetX === null) offsetX = minX / 2; if (offsetY === null) offsetY = minY / 2; offsetX = Math.min(0, Math.max(minX, offsetX)); offsetY = Math.min(0, Math.max(minY, offsetY)); context.fillStyle = '#08090a'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, offsetX, offsetY, width, height); };
    const original = () => { overlay.remove(); resolve(optimizeListingImage(file)); };
    const finish = () => { draw(); overlay.remove(); resolve(canvas.toDataURL('image/jpeg', .88)); };
    zoomInput.addEventListener('input', () => { zoom = Number(zoomInput.value); draw(); });
    canvas.addEventListener('pointerdown', event => { dragging = true; last = event; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => { if (!dragging || !last) return; const rect = canvas.getBoundingClientRect(); offsetX += (event.clientX - last.clientX) * canvas.width / rect.width; offsetY += (event.clientY - last.clientY) * canvas.height / rect.height; last = event; draw(); });
    canvas.addEventListener('pointerup', () => { dragging = false; last = null; });
    overlay.querySelector('[data-crop-apply]').addEventListener('click', finish); overlay.querySelector('[data-crop-skip]').addEventListener('click', original); overlay.querySelector('[data-crop-cancel]').addEventListener('click', () => { overlay.remove(); resolve(null); });
    draw();
  });
}
async function prepareListingFiles(files, append = false) { const selected = [...files]; const linked = imageUrls(document.querySelector('[name="imageUrls"]')?.value || ''); const slots = Math.max(0, 5 - linked.length - (append ? uploadedListingImages.length : 0)); if (!slots) throw new Error('A listing can have up to 5 photos.'); const cropped = []; for (const file of selected.slice(0, slots)) { const image = await cropListingImage(file); if (image) cropped.push(image); } uploadedListingImages = append ? [...uploadedListingImages, ...cropped] : cropped; renderImagePreview([...uploadedListingImages, ...linked], uploadedListingVideos); }
async function prepareListingVideo(files) { const [file] = [...files]; if (!file) { uploadedListingVideos = []; syncListingPreview(); return; } if (files.length > 1) throw new Error('Choose one short video per listing.'); if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) throw new Error('Use an MP4, WEBM, or MOV video.'); if (file.size > 4 * 1024 * 1024) throw new Error('Keep listing videos under 4 MB.'); const video = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); }); uploadedListingVideos = [video]; syncListingPreview(); }
function syncListingPreview() { const linked = imageUrls(document.querySelector('[name="imageUrls"]')?.value || ''); renderImagePreview([...uploadedListingImages, ...linked].slice(0, 5), uploadedListingVideos); }
function openListingForm() { if (!session) return openAuthPanel('login'); uploadedListingImages = []; uploadedListingVideos = []; openModal('Create a listing', 'Build a complete collector-ready listing. Add photos, a short video, and the details buyers need.', '<form class="modal-form listing-form"><datalist id="listing-categories"><option>Sports Cards</option><option>Memorabilia</option><option>Books</option><option>Comics</option><option>Vintage</option><option>Art</option></datalist><section class="listing-editor-grid"><div class="listing-details"><p class="listing-step">01 · LISTING DETAILS</p><section class="listing-form-grid"><label class="title-field">Listing title<input required name="title" maxlength="120" placeholder="e.g. 1964 Topps Mickey Mantle"></label><label>Category<input required name="category" list="listing-categories" placeholder="Choose a category"></label><label>Price (USD)<input required name="price" type="number" min="0" step="0.01" placeholder="0.00"></label></section><p class="listing-step">02 · ADD MEDIA</p><section class="listing-media-inputs"><label class="listing-upload-field"><span>Photos <i>Up to 5 · JPG, PNG, WEBP</i></span><input name="imageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label class="listing-upload-field"><span>Short video <i>1 MP4, WEBM, or MOV · 4 MB max</i></span><input name="videoFiles" type="file" accept="video/mp4,video/webm,video/quicktime"></label><label class="listing-image-field">Image links <i>Optional · one link per line</i><textarea name="imageUrls" placeholder="https://example.com/front.jpg\nhttps://example.com/back.jpg"></textarea></label></section><p class="listing-step">03 · TELL THE STORY</p><label class="description-field">Description<textarea required name="description" maxlength="2000" placeholder="Describe condition, defects, provenance, and anything collectors should know."></textarea></label><label class="check listing-trade-option"><input name="tradeOffer" type="checkbox"> Open to trade offers</label></div><aside class="listing-media-panel"><div><p class="listing-step">MEDIA PREVIEW</p><h3>Your listing gallery</h3><p>Photos and video will appear exactly as collectors see them.</p></div><div id="listing-image-preview" class="listing-image-preview"><div class="preview-empty"><b>Add listing media</b><span>Upload up to 5 photos and one short video, or paste image links.</span></div></div></aside></section><footer class="listing-publish-bar"><span>Required: title, category, price, description, and at least one photo.</span><button>Publish listing</button></footer></form>'); modal.classList.add('listing-dialog'); }
const listingTagOptions = () => [...new Set(categoryOptions)].sort((left, right) => left.localeCompare(right)).map(tag => `<option value="${safe(tag)}">`).join('');
const parseListingTags = (value, category, condition) => [...new Set([String(category || '').trim(), String(condition || '').trim(), ...String(value || '').split(/[\n,]+/).map(tag => tag.trim().replace(/^#/, '')).filter(Boolean)])].filter(Boolean).slice(0, 8);
function openListingForm() { if (!session) return openAuthPanel('login'); uploadedListingImages = []; uploadedListingVideos = []; const options = listingTagOptions(); const conditions = tagGroups.Conditions.map(condition => `<option value="${safe(condition)}">${safe(condition)}</option>`).join(''); openModal('Create a listing', 'Build a complete collector-ready listing. Add photos, a short video, and the details buyers need.', `<form class="modal-form listing-form"><datalist id="listing-categories">${options}</datalist><datalist id="listing-tags">${options}</datalist><section class="listing-editor-grid"><div class="listing-details"><p class="listing-step">01 · LISTING DETAILS</p><section class="listing-form-grid"><label class="title-field">Listing title<input required name="title" maxlength="120" placeholder="e.g. 1964 Topps Mickey Mantle"></label><label>Category<input required name="category" list="listing-categories" placeholder="Choose a category"></label><label>Condition<select required name="condition"><option value="" selected disabled>Choose condition</option>${conditions}</select></label><label>Price (USD)<input required name="price" type="number" min="0" step="0.01" placeholder="0.00"></label><label class="listing-tag-field">Tags <i>Up to 6 extra · separate with commas</i><input name="tags" list="listing-tags" maxlength="420" placeholder="e.g. Sports Cards, Vintage, Limited Edition"></label></section><p class="listing-step">02 · ADD MEDIA</p><section class="listing-media-inputs"><label class="listing-upload-field"><span>Photos <i>Up to 5 · JPG, PNG, WEBP</i></span><input name="imageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label class="listing-upload-field"><span>Short video <i>1 MP4, WEBM, or MOV · 4 MB max</i></span><input name="videoFiles" type="file" accept="video/mp4,video/webm,video/quicktime"></label><label class="listing-image-field">Image links <i>Optional · one link per line</i><textarea name="imageUrls" placeholder="https://example.com/front.jpg\nhttps://example.com/back.jpg"></textarea></label></section><p class="listing-step">03 · TELL THE STORY</p><label class="description-field">Description<textarea required name="description" maxlength="2000" placeholder="Describe defects, provenance, and anything collectors should know."></textarea></label><label class="check listing-trade-option"><input name="tradeOffer" type="checkbox"> Open to trade offers</label></div><aside class="listing-media-panel"><div><p class="listing-step">MEDIA PREVIEW</p><h3>Your listing gallery</h3><p>Photos and video will appear exactly as collectors see them.</p></div><div id="listing-image-preview" class="listing-image-preview"><div class="preview-empty"><b>Add listing media</b><span>Upload up to 5 photos and one short video, or paste image links.</span></div></div></aside></section><footer class="listing-publish-bar"><span>Required: title, category, condition, price, description, and at least one photo.</span><button>Publish listing</button></footer></form>`); modal.classList.add('listing-dialog'); }
let commentSortMode = 'hot';
const commentAge = date => { const seconds = Math.max(1, Math.floor((Date.now() - new Date(date || Date.now()).valueOf()) / 1000)); if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`; if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`; return new Date(date).toLocaleDateString(); };
const commentSortValue = comment => { const score = Number(comment.score || 0); const ageHours = Math.max(1, (Date.now() - new Date(comment.createdAt || Date.now()).valueOf()) / 3600000); return commentSortMode === 'new' ? -new Date(comment.createdAt || 0).valueOf() : commentSortMode === 'top' ? -score : -(score / Math.pow(ageHours + 2, 0.8)); };
const richCommentText = value => safe(value).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
const commentEmojiRanges = [[0x1F300, 0x1F5FF], [0x1F600, 0x1F64F], [0x1F680, 0x1F6FF], [0x1F700, 0x1F77F], [0x1F780, 0x1F7FF], [0x1F800, 0x1F8FF], [0x1F900, 0x1F9FF], [0x1FA00, 0x1FAFF], [0x2600, 0x27BF]];
const allCommentEmoji = [...new Set(commentEmojiRanges.flatMap(([start, end]) => Array.from({ length: end - start + 1 }, (_, index) => String.fromCodePoint(start + index))))];
const quickCommentEmoji = ['😀','😂','😍','🔥','👏','🎉','❤️','👍','👀','🤝','💯','😮','😢','🤔','✨','🏆'];
const renderCommentEmojiPicker = filter => { const term = String(filter || '').trim(); const emoji = term ? allCommentEmoji.filter(symbol => symbol.includes(term)).slice(0, 800) : allCommentEmoji; return `<div class="comment-emoji-picker"><header><input type="search" data-comment-emoji-search placeholder="Find an emoji" aria-label="Find an emoji"><button type="button" data-comment-close-emoji aria-label="Close emoji picker">×</button></header><div class="comment-emoji-grid">${emoji.map(symbol => `<button type="button" data-comment-emoji="${symbol}" aria-label="Add ${symbol}" title="${symbol}">${symbol}</button>`).join('')}</div></div>`; };
let commentRecorder = null;
const stopCommentRecording = () => { if (commentRecorder?.state === 'recording') commentRecorder.stop(); };
async function toggleCommentRecording(button) {
  if (commentRecorder?.state === 'recording') { stopCommentRecording(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Voice notes need microphone access in a modern browser.');
  const form = button.closest('.comment-form'); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported?.(type)); const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); const chunks = []; const status = form.querySelector('[data-comment-recording-status]');
  commentRecorder = recorder; button.classList.add('is-recording'); button.setAttribute('aria-pressed', 'true'); button.innerHTML = '<span>■</span> Stop recording'; if (status) status.textContent = 'Recording…';
  recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
  recorder.addEventListener('stop', () => { stream.getTracks().forEach(track => track.stop()); button.classList.remove('is-recording'); button.setAttribute('aria-pressed', 'false'); button.innerHTML = '<span>●</span> Voice note'; if (status) status.textContent = ''; const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); if (blob.size > 4 * 1024 * 1024) { if (status) status.textContent = 'Voice note is too large. Please record a shorter note.'; return; } const reader = new FileReader(); reader.addEventListener('load', () => { const input = form.querySelector('[name="audioUrl"]'); const preview = form.querySelector('[data-comment-audio-preview]'); if (input) input.value = String(reader.result || ''); if (preview) { preview.hidden = false; preview.innerHTML = `<audio controls src="${safe(String(reader.result || ''))}"></audio><button type="button" data-comment-remove-audio aria-label="Remove voice note">Remove</button>`; } }); reader.readAsDataURL(blob); commentRecorder = null; });
  recorder.start();
}
function renderCommentThread(comments, listingId, parentId = null, depth = 0) { return comments.filter(comment => (comment.parentId || null) === parentId).sort((left, right) => commentSortValue(left) - commentSortValue(right)).map(comment => { const own = comment.userId === session?.user?.id; const name = comment.user?.username || 'collector'; const avatar = name.slice(0, 1).toUpperCase(); const replies = renderCommentThread(comments, listingId, comment.id, depth + 1); return `<article class="post-comment ${depth ? 'is-reply' : ''}" data-comment-id="${comment.id}"><header><button type="button" class="comment-avatar" data-profile="${safe(comment.user?.id || comment.userId || '')}" aria-label="Open @${safe(name)}">${safe(avatar)}</button><div><button type="button" class="comment-author" data-profile="${safe(comment.user?.id || comment.userId || '')}">@${safe(name)}</button><time title="${safe(new Date(comment.createdAt || Date.now()).toLocaleString())}">${safe(commentAge(comment.createdAt))}</time></div>${own ? `<button type="button" class="comment-delete" data-comment-delete="${comment.id}" data-comment-listing="${listingId}">Delete</button>` : ''}</header>${comment.body ? `<p>${richCommentText(comment.body)}</p>` : ''}${comment.audioUrl ? `<section class="comment-audio"><span>Voice note</span><audio controls preload="metadata" src="${safe(comment.audioUrl)}"></audio></section>` : ''}${comment.mediaUrl ? `<a class="comment-image" href="${safe(comment.mediaUrl)}" target="_blank" rel="noopener noreferrer"><img src="${safe(comment.mediaUrl)}" alt="Image shared by @${safe(name)}" loading="lazy"></a>` : ''}<footer class="comment-actions"><span class="comment-votes"><button type="button" class="comment-vote ${comment.myVote === 1 ? 'selected' : ''}" data-comment-vote="1" data-comment="${comment.id}" data-comment-listing="${listingId}" aria-label="Upvote comment">▲</button><output>${Number(comment.score || 0)}</output><button type="button" class="comment-vote ${comment.myVote === -1 ? 'selected' : ''}" data-comment-vote="-1" data-comment="${comment.id}" data-comment-listing="${listingId}" aria-label="Downvote comment">▼</button></span><button type="button" class="comment-reply" data-comment-reply="${comment.id}" data-comment-listing="${listingId}">Reply</button></footer>${replies ? `<section class="comment-replies">${replies}</section>` : ''}</article>`; }).join(''); }
const openListingModal = openListingForm;
function listingTagValues(form) { return String(form?.querySelector('[name="tags"]')?.value || '').split(/[\n,]+/).map(value => value.trim().replace(/^#/, '')).filter(Boolean).filter((value, index, values) => values.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index).slice(0, 6); }
function renderListingTagChips(form) { const host = form?.querySelector('[data-listing-tag-chips]'); if (!host) return; const values = listingTagValues(form); host.innerHTML = values.map(value => `<span class="listing-tag-chip">#${safe(value)}<button type="button" data-listing-tag-remove="${safe(value)}" aria-label="Remove ${safe(value)}">×</button></span>`).join('') || '<span class="listing-tag-empty">Add tags to help collectors find this item.</span>'; const count = form.querySelector('[data-listing-tag-count]'); if (count) count.textContent = `${values.length} / 6 extra tags`;
}
function commitListingTagEntry(form, value = '') { const entry = form?.querySelector('[data-listing-tag-entry]'); const additions = String(value || entry?.value || '').split(/[\n,]+/).map(item => item.trim().replace(/^#/, '')).filter(Boolean); if (!additions.length) return; const input = form.querySelector('[name="tags"]'); if (!input) return; input.value = [...listingTagValues(form), ...additions].filter((item, index, values) => values.findIndex(value => value.toLowerCase() === item.toLowerCase()) === index).slice(0, 6).join(', '); if (entry) entry.value = ''; renderListingTagChips(form); saveListingDraft(form); }
function enhanceListingComposer() { const form = document.querySelector('.app-section-page .listing-form'); if (!form || form.dataset.composerReady) return; form.dataset.composerReady = 'true'; const tagInput = form.querySelector('[name="tags"]'); const photoField = form.querySelector('[name="imageFiles"]')?.closest('.listing-upload-field'); if (tagInput) { tagInput.classList.add('listing-tags-source'); tagInput.insertAdjacentHTML('afterend', `<section class="listing-tag-composer"><div class="listing-tag-composer-head"><b>Discovery tags</b><small data-listing-tag-count>0 / 6 extra tags</small></div><div class="listing-tag-chips" data-listing-tag-chips></div><input data-listing-tag-entry list="listing-tags" maxlength="70" placeholder="Type a tag, then press Enter"> <small>Press Enter or a comma after each tag.</small></section>`); renderListingTagChips(form); }
  if (photoField && !photoField.querySelector('[data-photo-count]')) photoField.insertAdjacentHTML('beforeend', '<small class="listing-photo-count" data-photo-count>0 / 5 photos added</small>');
  renderImagePreview([...uploadedListingImages, ...imageUrls(form.querySelector('[name="imageUrls"]')?.value || '')].slice(0, 5), uploadedListingVideos);
}
openListingForm = () => {
  if (!session) return openAuthPanel('login');
  beginWorkspaceRoute('listing');
  // Build the listing form once in the dialog, then move that completed markup
  // into the full-page workspace. Keeping the dialog visible while building
  // avoids a race where the browse surface can win the render.
  openListingModal();
  const form = modalContent.querySelector('.listing-form');
  if (!form) return openModal('Create a listing', 'The listing form could not be prepared. Please try again.');
  const markup = modalContent.innerHTML;
  restoringWorkspaceHistory = true;
  if (modal.open) modal.close();
  openAppSection('listing', 'Create a listing', 'Build a complete collector-ready listing with media, delivery details, and a saved draft.', markup);
  document.body.classList.add('listing-page');
  requestAnimationFrame(() => { restoringWorkspaceHistory = false; enhanceListingComposer(); });
};
async function openComments(item, replyTo = '') { let comments = []; try { comments = await api(`/comments/${item.id}`); } catch { comments = stateFor(item.id).comments.map(body => ({ body, user: { username: 'collector' }, parentId: null })); } const thread = comments.length ? renderCommentThread(comments, item.id) : '<section class="comment-empty"><b>Start the conversation</b><span>Ask about condition, provenance, or shipping.</span></section>'; const replyTarget = comments.find(comment => comment.id === replyTo); const replyLabel = replyTarget ? `<div class="comment-replying">Replying to <b>@${safe(replyTarget.user?.username || 'collector')}</b><button type="button" data-comment-cancel-reply data-comment-listing="${item.id}">Cancel</button></div>` : ''; const sort = `<nav class="comment-sort" aria-label="Sort comments">${[['hot', 'Hot'], ['new', 'Newest'], ['top', 'Top']].map(([value, label]) => `<button type="button" data-comment-sort="${value}" data-comment-listing="${item.id}" class="${commentSortMode === value ? 'active' : ''}">${label}</button>`).join('')}</nav>`; const quickEmoji = quickCommentEmoji.map(symbol => `<button type="button" data-comment-emoji="${symbol}" aria-label="Add ${symbol}" title="${symbol}">${symbol}</button>`).join(''); openModal(`Comments · ${item.title}`, `${comments.length} comment${comments.length === 1 ? '' : 's'} · Join the collector conversation.`, `<section class="comment-workspace"><header class="comment-workspace-head"><div><h3>${safe(item.title)}</h3></div><aside><span>COMMENTS</span>${sort}</aside></header>${replyLabel}<section class="comment-thread-list">${thread}</section><form class="modal-form comment-form" data-post="${item.id}" data-parent="${replyTo}"><div class="comment-composer-head"><b>${replyTo ? 'Write a reply' : 'Add a comment'}</b><output data-comment-count>0 / 1000</output></div><textarea name="body" maxlength="1000" data-comment-composer placeholder="${replyTo ? 'Reply with something useful…' : 'Share a question, detail, or collector insight…'}"></textarea><div class="comment-composer-tools"><div class="comment-quick-emoji" aria-label="Quick emoji">${quickEmoji}<button type="button" class="comment-more-emoji" data-comment-open-emoji aria-label="More emojis" title="More emojis">＋</button></div><button type="button" class="comment-record" data-comment-record aria-pressed="false"><span>●</span> Voice note</button><span data-comment-recording-status aria-live="polite"></span><label class="comment-media-field">Image link <i>Optional</i><input name="mediaUrl" type="url" inputmode="url" maxlength="2000" placeholder="https://example.com/photo.jpg"></label></div><input type="hidden" name="audioUrl"><div class="comment-audio-preview" data-comment-audio-preview hidden></div><div class="comment-emoji-host" hidden></div><footer><small>Links become clickable. Image links and voice notes display in the comment.</small><button type="submit">${replyTo ? 'Post reply' : 'Post comment'}</button></footer></form></section>`); modal.classList.add('comment-dialog'); document.body.classList.add('comments-open'); requestAnimationFrame(() => modal.querySelector('[data-comment-composer]')?.focus()); }
async function openChatCenter() { if (!session) return openAuthPanel('login'); try { const [trades, currentDeliveries, conversations, suggestions] = await Promise.all([api('/trades'), api('/deliveries'), api('/conversations'), api('/users/suggestions')]); deliveries = currentDeliveries; const collectorRows = conversations.map(conversation => { const other = conversation.otherUser || {}; const lastMessage = conversation.messages.at(-1); return `<button type="button" class="chat-conversation-row" data-conversation="${conversation.id}"><span class="chat-avatar">${safe((other.username || 'C').slice(0, 1).toUpperCase())}</span><span><strong>@${safe(other.username || 'collector')}</strong><small>${safe(lastMessage?.body || 'Start a conversation')}</small></span><i>Open</i></button>`; }).join(''); const suggestedRows = suggestions.map(user => `<article class="suggestion-card"><span class="chat-avatar">${safe((user.username || 'C').slice(0, 1).toUpperCase())}</span><span><strong>@${safe(user.username || 'collector')}</strong><small>${Number(user.activeListingCount || 0)} active listing${Number(user.activeListingCount || 0) === 1 ? '' : 's'} · ${Number(user.reputation || 0)} reputation</small></span><div class="suggestion-actions"><button type="button" data-collector-chat="${user.id}">Message</button><button type="button" data-chat-follow="${user.id}">Follow</button></div></article>`).join(''); const tradeRows = trades.map(trade => `<button type="button" class="delivery-row" data-trade-chat="${trade.id}"><strong>Trade · ${safe(trade.listing?.title || 'Collector listing')}</strong><span>${safe(trade.status)} · @${safe(trade.otherUser?.username || 'collector')}</span></button>`).join(''); const deliveryRows = currentDeliveries.map(delivery => `<button type="button" class="delivery-row" data-delivery="${delivery.id}"><strong>Delivery · ${safe(delivery.listing?.title || 'Collector order')}</strong><span>${safe(delivery.status.replaceAll('_', ' '))}</span></button>`).join(''); openModal('Messages', 'Talk with collectors, manage trade conversations, and find new people to follow.', `<section class="social-chat"><section class="chat-sidebar"><div class="chat-section-heading"><h3>Messages</h3><span>${conversations.length}</span></div><div class="conversation-list">${collectorRows || '<p class="modal-copy">Your direct messages will appear here.</p>'}</div><div class="chat-section-heading"><h3>Suggested collectors</h3><span>New</span></div><div class="suggestion-list">${suggestedRows || '<p class="modal-copy">You are already connected with every collector we can suggest.</p>'}</div></section><section class="chat-secondary"><h3>Trade & delivery</h3><div class="chat-resource-section"><h4>Trades</h4>${tradeRows || '<p class="modal-copy">No trade conversations yet.</p>'}</div><div class="chat-resource-section"><h4>Deliveries</h4>${deliveryRows || '<p class="modal-copy">No delivery conversations yet.</p>'}</div></section></section>`); modal.classList.add('chat-dialog'); document.body.classList.add('chat-open'); } catch (error) { openModal('Messages', error.message); } }
async function openCollectorChat(recipientId) { if (!session) return openAuthPanel('login'); const conversation = await api('/conversations', { method: 'POST', body: JSON.stringify({ recipientId }) }); await openConversation(conversation.id); }
async function openConversation(id) { const conversation = await api(`/conversation/${id}`); const messages = conversation.messages.length ? conversation.messages.map(message => message.type === 'trade_request' && message.tradeId ? `<article class="chat-trade-request ${message.senderId === session.user.id ? 'is-own-message' : ''}"><small>TRADE REQUEST</small><b>@${safe(message.senderId === session.user.id ? session.user.username : conversation.otherUser?.username || 'collector')} proposed a trade</b><span>${safe(message.body || 'Review the items, cash adjustment, delivery details, and fees.')}</span><button type="button" data-trade-chat="${safe(message.tradeId)}">Open trade →</button></article>` : `<p class="post-comment ${message.senderId === session.user.id ? 'is-own-message' : ''}"><b>@${safe(message.senderId === session.user.id ? session.user.username : conversation.otherUser?.username || 'collector')}</b><span>${safe(message.body)}</span></p>`).join('') : '<p class="modal-copy">No messages yet. Say hello.</p>'; openModal(`Chat · @${safe(conversation.otherUser?.username || 'collector')}`, 'Private collector conversation.', `<section class="conversation-workspace"><header class="conversation-header"><button type="button" data-chat>← All messages</button><span class="chat-avatar">${safe((conversation.otherUser?.username || 'C').slice(0, 1).toUpperCase())}</span><strong>@${safe(conversation.otherUser?.username || 'collector')}</strong><button type="button" class="start-chat-trade" data-start-trade="${safe(conversation.otherUser?.id || '')}" data-start-trade-conversation="${safe(conversation.id)}">Request trade</button><button type="button" class="voice-start" data-voice-room="conversation:${conversation.id}" data-voice-label="Voice with @${safe(conversation.otherUser?.username || 'collector')}">Start voice</button></header><section class="delivery-thread collector-thread" aria-live="polite">${messages}</section><form class="modal-form collector-message-form" data-conversation="${conversation.id}"><textarea required name="body" maxlength="1000" placeholder="Write a message" aria-label="Message @${safe(conversation.otherUser?.username || 'collector')}"></textarea><button type="submit">Send</button></form></section>`); modal.classList.add('chat-dialog'); document.body.classList.add('chat-open'); requestAnimationFrame(() => { const thread = modal.querySelector('.collector-thread'); if (thread) thread.scrollTop = thread.scrollHeight; modal.querySelector('.collector-message-form textarea')?.focus(); }); }
const renderChatWorkspace = openChatCenter;
openChatCenter = (...args) => { beginWorkspaceRoute('chat'); return renderChatWorkspace(...args); };
const tradeItemRows = (items, name, checked = false, required = false) => items.map(item => `<label class="trade-item-option"><input type="checkbox" name="${name}" value="${safe(item.id)}" ${checked ? 'checked' : ''} ${required ? 'required' : ''}><img src="${safe(item.image || item.images?.[0] || '')}" alt=""><span><b>${safe(item.title)}</b><small>${money(item.price)}</small></span><i>+</i></label>`).join('');
const tradePaymentOptions = ['PayPal'];
const paypalProcessingRate = .0349;
const paypalProcessingFixed = .49;
const paypalProcessingFee = amount => Math.round((Math.max(0, Number(amount) || 0) * paypalProcessingRate + paypalProcessingFixed) * 100) / 100;
const collectorFeeRate = user => user?.developerPass === true ? 0 : hasActiveCuratorMembership(user) ? .01 : .04;
const tradeDeliveryFields = (plan = {}, heading = 'Your delivery and payment details') => `<section class="trade-delivery-fields"><h3>${safe(heading)}</h3><p>These details are shared only with the other collector after both sides lock in the trade.</p><label>Delivery option<select required name="deliveryProvider"><option value="" disabled ${plan.deliveryProvider ? '' : 'selected'}>Choose a delivery provider</option>${deliveryCarriers.map(provider => `<option value="${safe(provider)}" ${plan.deliveryProvider === provider ? 'selected' : ''}>${safe(provider)}</option>`).join('')}</select></label><div class="trade-cash-fields"><label>Estimated miles<input required name="deliveryMiles" type="number" min="0" step="0.1" value="${safe(plan.deliveryMiles ?? 0)}"></label><label>Packaging cost<input required name="packagingCost" type="number" min="0" step="0.01" value="${safe(plan.packagingCost ?? 0)}"></label></div><label>Delivery address<textarea required name="shippingAddress" maxlength="500" placeholder="Address for items you will receive">${safe(plan.shippingAddress || '')}</textarea></label><fieldset class="payment-methods"><legend>Payment method for any cash difference or delivery</legend><div>${tradePaymentOptions.map((method, index) => `<label class="payment-method"><input type="radio" name="paymentMethod" value="${safe(method)}" ${(plan.paymentMethod || tradePaymentOptions[0]) === method ? 'checked' : ''}><span><b>${safe(method)}</b></span></label>`).join('')}</div></fieldset></section>`;
const tradeSummary = trade => { const senderItems = trade.senderListings || []; const receiverItems = trade.receiverListings || (trade.listing ? [trade.listing] : []); const sentByYou = trade.senderId === session?.user?.id; const theyGive = sentByYou ? receiverItems : senderItems; const youGive = sentByYou ? senderItems : receiverItems; const legacyCash = Number(trade.cashAmount || 0); const senderCash = Number(trade.senderCashAmount ?? (trade.cashFrom === 'sender' ? legacyCash : 0)); const receiverCash = Number(trade.receiverCashAmount ?? (trade.cashFrom === 'receiver' ? legacyCash : 0)); const yourCash = sentByYou ? senderCash : receiverCash; const theirCash = sentByYou ? receiverCash : senderCash; const yourPaymentFee = Number(trade.paymentFees?.[sentByYou ? 'sender' : 'receiver'] || 0); const theirPaymentFee = Number(trade.paymentFees?.[sentByYou ? 'receiver' : 'sender'] || 0); const plans = trade.deliveryPlans || {}; const yourPlan = plans[sentByYou ? 'sender' : 'receiver']; const theirPlan = plans[sentByYou ? 'receiver' : 'sender']; const yourFee = trade.fees?.[sentByYou ? 'sender' : 'receiver']; const theirFee = trade.fees?.[sentByYou ? 'receiver' : 'sender']; const delivery = plan => plan ? `<span>${safe(plan.deliveryProvider)} · ${Number(plan.deliveryMiles || 0).toFixed(1)} mi · ${money(plan.courierPay || 0)} · ${safe(plan.paymentMethod)}</span>` : '<span>Details pending</span>'; const fees = yourFee ? `<section class="trade-fee-receipt"><div><b>Your marketplace fee · ${Number(yourFee.rate * 100)}%</b><span>${money(yourFee.amount)} on ${money(yourFee.value)} received value</span></div><div><b>Their marketplace fee · ${Number(theirFee.rate * 100)}%</b><span>${money(theirFee.amount)} on ${money(theirFee.value)} received value</span></div><small>Each collector pays only their own side. Curator members pay 1%; standard accounts pay 4%.</small></section>` : ''; return `<section class="trade-item-summary"><div><h3>They give</h3>${theyGive.map(item => `<span>${safe(item.title)} · ${money(item.price)}</span>`).join('')}</div><div><h3>You give</h3>${youGive.map(item => `<span>${safe(item.title)} · ${money(item.price)}</span>`).join('')}</div>${theirCash ? `<p class="trade-cash-adjustment">They add ${money(theirCash)} cash${theirPaymentFee ? ` + ${money(theirPaymentFee)} PayPal fee` : ''}</p>` : ''}${yourCash ? `<p class="trade-cash-adjustment">You add ${money(yourCash)} cash${yourPaymentFee ? ` + ${money(yourPaymentFee)} PayPal fee` : ''}</p>` : ''}<div><h3>Your delivery</h3>${delivery(yourPlan)}</div><div><h3>Their delivery</h3>${delivery(theirPlan)}</div></section>${fees}`; };
async function openTradeDeliveryConfirmation(id) { const trade = await api(`/trade/${id}`); const role = trade.senderId === session.user.id ? 'sender' : 'receiver'; const title = trade.receiverListings?.map(item => item.title).join(' + ') || trade.listing?.title || 'Collector trade'; openModal(`Confirm trade delivery · ${title}`, 'Review your delivery and payment details, then lock in your side of the trade.', `<form class="modal-form trade-delivery-form" data-trade="${trade.id}">${tradeDeliveryFields(trade.deliveryPlans?.[role], 'Your receiving details')}<button type="submit" class="transaction-submit">Save details & lock in</button></form>`); modal.classList.add('chat-dialog', 'trade-dialog'); document.body.classList.add('chat-open'); }
async function openTradeChat(id) { const trade = await api(`/trade/${id}`); const messages = trade.messages.length ? trade.messages.map(message => `<p class="post-comment ${message.senderId === session.user.id ? 'is-own-message' : ''}"><b>@${safe(message.senderId === session.user.id ? session.user.username : trade.otherUser?.username || 'collector')}</b><span>${safe(message.body)}</span></p>`).join('') : '<p class="modal-copy">No messages yet. Discuss the trade here.</p>'; const role = trade.senderId === session.user.id ? 'sender' : 'receiver'; const accepted = trade.acceptances || {}; const myAccepted = Boolean(accepted[role]); const otherAccepted = Boolean(accepted[role === 'sender' ? 'receiver' : 'sender']); const waiting = ['pending', 'awaiting_sender', 'awaiting_receiver'].includes(trade.status); const acceptanceBoard = waiting ? `<section class="trade-acceptance-board"><div class="${myAccepted ? 'is-locked' : ''}"><b>You</b><span>${myAccepted ? 'Locked in' : 'Reviewing'}</span></div><div class="${otherAccepted ? 'is-locked' : ''}"><b>@${safe(trade.otherUser?.username || 'collector')}</b><span>${otherAccepted ? 'Locked in' : 'Reviewing'}</span></div></section>` : ''; const acceptControls = waiting ? `${myAccepted ? '<span>Waiting for the other collector to lock in.</span>' : `<button type="button" data-trade-accept="${trade.id}">Review delivery & lock in</button>`}<button type="button" data-trade-status="declined" data-trade-id="${trade.id}">Decline trade</button>` : ''; const cashPayment = trade.cashPayment; const cashPaymentControls = trade.status === 'awaiting_cash_payment' ? (cashPayment?.payerId === session.user.id ? `<section class="trade-paypal-payment"><h3>Pay cash contribution</h3><p>Approve ${money(cashPayment.total)} in PayPal to start both delivery threads.</p><div class="trade-paypal-button-container" aria-live="polite"></div><small>The cash payment is processed by CollectorMarketplace’s PayPal merchant account; seller payout handling must be completed separately.</small></section>` : `<section class="trade-paypal-payment"><h3>Waiting for payment</h3><p>The other collector must approve their ${money(cashPayment?.total || 0)} PayPal cash contribution before delivery starts.</p></section>`) : ''; const completeControl = trade.status === 'accepted' ? `<button type="button" data-trade-status="completed" data-trade-id="${trade.id}">Mark trade completed</button>` : ''; const deliveryControls = trade.deliveries?.length ? `<section class="trade-delivery-links"><h3>Trade deliveries</h3>${trade.deliveries.map(delivery => `<button type="button" data-delivery="${delivery.id}"><b>${safe(delivery.deliveryProvider)}</b><span>${safe(delivery.status.replaceAll('_', ' '))}</span></button>`).join('')}</section>` : ''; const title = trade.receiverListings?.map(item => item.title).join(' + ') || trade.listing?.title || 'Collector trade'; openModal(`Trade · ${title}`, `Status: ${safe(trade.status.replaceAll('_', ' '))}`, `<section class="conversation-workspace trade-conversation-workspace"><header class="conversation-header"><button type="button" data-chat>← All messages</button><span class="trade-status">${safe(trade.status.replaceAll('_', ' '))}</span><strong>${safe(title)}</strong><button type="button" class="voice-start" data-voice-room="trade:${trade.id}" data-voice-label="Trade voice · ${safe(title)}">Start voice</button></header>${tradeSummary(trade)}${cashPaymentControls}${deliveryControls}${acceptanceBoard}<section class="delivery-thread collector-thread trade-thread" aria-live="polite">${messages}</section><footer class="trade-actions">${acceptControls}${completeControl || (waiting ? '' : deliveryControls ? '<span>Confirm every delivery to complete this trade.</span>' : '<span>Use this thread to coordinate the exchange.</span>')}</footer><form class="modal-form trade-message-form collector-message-form" data-trade="${trade.id}"><textarea required name="body" maxlength="500" placeholder="Message the other collector"></textarea><button type="submit">Send</button></form></section>`); modal.classList.add('chat-dialog', 'trade-dialog'); document.body.classList.add('chat-open'); renderPayPalButtonForTrade(trade); requestAnimationFrame(() => { const thread = modal.querySelector('.trade-thread'); if (thread) thread.scrollTop = thread.scrollHeight; modal.querySelector('.trade-message-form textarea')?.focus(); }); }
function openTradeOfferChat(item, conversationId = '') { const myItems = listings.filter(row => row.ownerId === session?.user?.id && row.status === 'active'); const theirItems = listings.filter(row => row.ownerId === item.ownerId && row.status === 'active'); openModal(`Build a trade · ${item.title}`, 'Pick items from both collections, add cash from one side if needed, and review the percentage fees before sending.', `<form class="modal-form trade-builder-form" data-listing="${item.id}" data-receiver="${item.ownerId}" data-conversation="${safe(conversationId)}"><section class="trade-builder-columns"><section><header><h3>Your trade deck</h3><output data-trade-count="sender">0 selected</output></header><p>Pick the items you want to give.</p><div class="trade-item-list">${myItems.length ? tradeItemRows(myItems, 'senderListingIds') : '<p class="modal-copy">You need an active listing before you can offer a trade.</p>'}</div></section><section><header><h3>@${safe(item.owner?.username || item.ownerName || 'collector')}'s collection</h3><output data-trade-count="receiver">1 selected</output></header><p>Pick the items you want to receive.</p><div class="trade-item-list">${tradeItemRows(theirItems, 'receiverListingIds', false)}</div></section></section><section class="trade-cash-fields"><label>Your cash to add<input name="senderCashAmount" type="number" min="0" max="1000000" step="0.01" value="0"></label><label>Their cash to add<input name="receiverCashAmount" type="number" min="0" max="1000000" step="0.01" value="0"></label><small>Only one side can add cash.</small></section><section class="trade-live-fees" aria-live="polite" data-trade-fees></section>${tradeDeliveryFields({}, 'Your receiving details')}<label>Offer note <i>Optional</i><textarea name="offerDetails" maxlength="1000" placeholder="Explain the condition, extras, or proposed exchange details."></textarea></label><label class="trade-fee-agreement"><input required type="checkbox" name="feeAgreement"> I reviewed the item values and agree to my displayed marketplace fee.</label><button type="submit" class="transaction-submit">${conversationId ? 'Send trade request in chat' : 'Review complete · send trade'}</button></form>`); modal.classList.add('chat-dialog', 'trade-dialog'); document.body.classList.add('chat-open'); const target = modal.querySelector(`[name="receiverListingIds"][value="${CSS.escape(item.id)}"]`); if (target) { target.checked = true; target.closest('.trade-item-option')?.classList.add('is-required'); } updateTradeSelectionCounts(); }
function startTradeWithCollector(userId, conversationId = '') { const item = listings.find(listing => listing.ownerId === userId && listing.status === 'active'); if (!item) return openModal('Trade unavailable', 'This collector does not have an active listing available to trade right now.'); openTradeOfferChat(item, conversationId); }
function updateTradeSelectionCounts() {
  const form = modal.querySelector('.trade-builder-form'); if (!form) return;
  const selectedValue = name => [...form.querySelectorAll(`[name="${name}"]:checked`)].reduce((total, input) => total + Number(listings.find(item => item.id === input.value)?.price || 0), 0);
  ['sender', 'receiver'].forEach(side => {
    const requiredTargetMissing = side === 'receiver' && !form.querySelector(`[name="receiverListingIds"][value="${form.dataset.listing}"]:checked`);
    const count = form.querySelectorAll(`[name="${side}ListingIds"]:checked`).length + (requiredTargetMissing ? 1 : 0);
    const value = selectedValue(`${side}ListingIds`) + (requiredTargetMissing ? Number(listings.find(item => item.id === form.dataset.listing)?.price || 0) : 0);
    const output = form.querySelector(`[data-trade-count="${side}"]`); if (output) output.textContent = `${count} selected · ${money(value)}`;
  });
  const senderCash = Number(form.elements.senderCashAmount.value || 0); const receiverCash = Number(form.elements.receiverCashAmount.value || 0);
  const yourReceivedValue = selectedValue('receiverListingIds') + receiverCash; const theirReceivedValue = selectedValue('senderListingIds') + senderCash;
  const yourRate = collectorFeeRate(session?.user); const otherAccount = accounts.find(account => account.id === form.dataset.receiver); const theirRate = collectorFeeRate(otherAccount);
  const fees = form.querySelector('[data-trade-fees]'); if (fees) fees.innerHTML = `<header><b>Marketplace fees</b><span>Calculated live</span></header><div><strong>You · ${yourRate * 100}%</strong><span>${money(yourReceivedValue * yourRate)}</span><small>on ${money(yourReceivedValue)} received value</small></div><div><strong>@${safe(otherAccount?.username || 'collector')} · ${theirRate * 100}%</strong><span>${money(theirReceivedValue * theirRate)}</span><small>on ${money(theirReceivedValue)} received value</small></div><p>Standard accounts pay 4% per side. Curator members pay 1% on their own side.</p>`;
}
function syncTradeCashInput(input) { if (!input || Number(input.value || 0) <= 0) return; const form = input.closest('.trade-builder-form'); const opposite = input.name === 'senderCashAmount' ? form?.elements.receiverCashAmount : form?.elements.senderCashAmount; if (opposite) opposite.value = '0'; }
async function loadDeliveries() { if (!session) { deliveries = []; return; } deliveries = await api('/deliveries'); }
async function openDeliveryCenter() { if (!session) return openAuthPanel('login'); try { await loadDeliveries(); const rows = deliveries.length ? deliveries.map(delivery => `<button type="button" class="delivery-row" data-delivery="${delivery.id}"><strong>${safe(delivery.listing?.title || 'Collector order')}</strong><span>${safe(delivery.status.replaceAll('_', ' '))}</span></button>`).join('') : '<p class="modal-copy">No deliveries yet. Purchases and sales will appear here.</p>'; openModal('Delivery center', 'Track dispatches, deliveries, messages, and issue reports.', `<section class="delivery-list">${rows}</section>`); } catch (error) { openModal('Delivery center', error.message); } }
async function openDelivery(id) {
  const delivery = await api(`/delivery/${id}`); const seller = delivery.sellerId === session?.user?.id;
  const provider = delivery.deliveryProvider || delivery.courier || 'Other courier';
  const trackingRequired = !['Local pickup', 'Local independent courier', 'Independent owner-operator'].includes(provider);
  const steps = ['awaiting_seller_dispatch', 'packed', 'picked_up', 'in_transit', 'completed'];
  const labels = { awaiting_seller_dispatch: 'Order placed', packed: 'Packed', picked_up: 'Picked up', in_transit: 'In transit', completed: 'Delivered', issue_reported: 'Issue reported', returned: 'Returned', return_requested: 'Return requested', return_approved: 'Return approved', return_declined: 'Return declined', return_shipped: 'Return shipped', return_received: 'Return received' };
  const currentStep = steps.indexOf(delivery.status);
  const timeline = steps.map((step, index) => `<li class="${index < currentStep ? 'done' : index === currentStep ? 'current' : ''}"><i>${index < currentStep ? '✓' : index + 1}</i><span>${labels[step]}</span></li>`).join('');
  const messages = delivery.messages.length ? delivery.messages.map(message => `<p class="post-comment"><b>@${safe(message.senderId === session.user.id ? session.user.username : seller ? delivery.buyer?.username : delivery.seller?.username || 'collector')}</b> ${safe(message.body)}</p>`).join('') : '<p class="modal-copy">No messages yet. Keep all delivery details in this thread.</p>';
  const next = { awaiting_seller_dispatch: 'packed', packed: 'picked_up', picked_up: 'in_transit' }[delivery.status];
  const referenceLabel = trackingRequired ? `Tracking number${next === 'packed' ? ' (optional)' : ''}` : 'Handoff reference (optional)';
  const sellerControls = seller && next ? `<form class="modal-form delivery-update-form" data-delivery="${delivery.id}"><h3>Seller action · ${labels[next]}</h3><input type="hidden" name="status" value="${next}"><label>Buyer-selected delivery option<input name="courier" readonly value="${safe(provider)}"></label><input name="trackingNumber" value="${safe(delivery.trackingNumber || '')}" placeholder="${referenceLabel}"><textarea name="note" maxlength="300" placeholder="Optional update for the buyer"></textarea><button>Mark as ${labels[next]}</button></form>` : seller ? '<p class="delivery-notice">No seller action is available for this delivery. Use the message thread for follow-up.</p>' : `<div class="delivery-buyer-actions">${delivery.status === 'in_transit' ? `<button type="button" class="auth-switch" data-delivery-confirm="${delivery.id}">Confirm delivery received</button>` : ''}${delivery.status !== 'completed' ? `<button type="button" class="auth-switch" data-delivery-issue="${delivery.id}">Report a delivery issue</button>` : ''}</div>`;
  const returnInfo = delivery.return || null;
  const returnStatus = returnInfo?.status || '';
  const returnPanel = !returnInfo && !seller && delivery.status === 'completed' ? `<form class="modal-form return-request-form" data-delivery="${delivery.id}"><h3>Request a return</h3><p>Explain the issue for the seller. They can approve or decline before you ship anything back.</p><textarea required name="reason" minlength="10" maxlength="1000" placeholder="Describe the condition, damage, or reason for the return"></textarea><button>Request return</button></form>` : returnInfo ? `<section class="return-workspace return-${safe(returnStatus)}"><header><span>Return status</span><b>${safe(returnStatus.replaceAll('_', ' '))}</b></header><p>${safe(returnInfo.reason)}</p>${returnInfo.decisionNote ? `<small>Seller note: ${safe(returnInfo.decisionNote)}</small>` : ''}${returnStatus === 'requested' && seller ? `<form class="modal-form return-decision-form" data-delivery="${delivery.id}"><textarea name="note" maxlength="1000" placeholder="Optional note for the buyer"></textarea><div><button name="decision" value="approved">Approve return</button><button name="decision" value="declined" class="return-decline">Decline return</button></div></form>` : ''}${returnStatus === 'approved' && !seller ? `<form class="modal-form return-tracking-form" data-delivery="${delivery.id}"><label>Return carrier<input name="carrier" value="${safe(returnInfo.carrier || provider)}" maxlength="80"></label><label>Return tracking number<input required name="trackingNumber" maxlength="120" placeholder="Enter return tracking"></label><button>Mark return shipped</button></form>` : ''}${returnStatus === 'shipped' ? `<small>Return tracking · ${safe(returnInfo.carrier || 'Carrier')} · ${safe(returnInfo.trackingNumber || 'Pending')}</small>${seller ? `<button type="button" class="auth-switch" data-return-received="${delivery.id}">Confirm return received</button>` : ''}` : ''}${returnStatus === 'received' ? '<small>The item was received by the seller. Any eligible refund must be completed through PayPal.</small>' : ''}${returnStatus === 'declined' ? '<small>The seller declined this request. Use the delivery messages to discuss the outcome.</small>' : ''}</section>` : '';
  const shippo = delivery.shippo || {}; const recipient = shippo.destination || delivery.recipientAddress || {}; const shippoControls = seller && !shippo.transactionId ? `<form class="modal-form shippo-rate-form" data-delivery="${delivery.id}"><h3>UPS label</h3><p>Request a live UPS quote first. The buyer's delivery address is filled in automatically; buying the label is a separate, chargeable step.</p><label>Sender name<input required name="originName" value="${safe(shippo.origin?.name || '')}"></label><label>Sender street<input required name="originStreet1" value="${safe(shippo.origin?.street1 || '')}"></label><label>Sender city / state / ZIP<input required name="originCity" placeholder="City" value="${safe(shippo.origin?.city || '')}"><input required name="originState" placeholder="State" value="${safe(shippo.origin?.state || '')}"><input required name="originZip" placeholder="ZIP" value="${safe(shippo.origin?.zip || '')}"></label><label>Recipient name<input required name="destinationName" readonly value="${safe(recipient.name || '')}"></label><label>Recipient street<input required name="destinationStreet1" readonly value="${safe(recipient.street1 || '')}"></label><label>Recipient city / state / ZIP<input required name="destinationCity" readonly placeholder="City" value="${safe(recipient.city || '')}"><input required name="destinationState" readonly placeholder="State" value="${safe(recipient.state || '')}"><input required name="destinationZip" readonly placeholder="ZIP" value="${safe(recipient.zip || '')}"></label><label>Package L × W × H (in)<input required name="length" type="number" min=".1" step=".1" value="${safe(shippo.parcel?.length || '')}"><input required name="width" type="number" min=".1" step=".1" value="${safe(shippo.parcel?.width || '')}"><input required name="height" type="number" min=".1" step=".1" value="${safe(shippo.parcel?.height || '')}"></label><label>Package weight (lb)<input required name="weight" type="number" min=".1" step=".1" value="${safe(shippo.parcel?.weight || '')}"></label><button type="submit">${shippo.rateId ? `Refresh live UPS quote · ${money(shippo.amount)}` : 'Get live UPS quote'}</button></form>${shippo.rateId ? `<button type="button" class="auth-switch" data-shippo-buy="${delivery.id}">Buy UPS label · ${money(shippo.amount)}</button>` : ''}` : shippo.transactionId ? `<section class="delivery-fee-summary"><h3>Shippo label</h3><span>${safe(shippo.provider)} · ${safe(shippo.service)}</span><span>Tracking · ${safe(delivery.trackingNumber || 'pending')}</span>${shippo.labelUrl ? `<a href="${safe(shippo.labelUrl)}" target="_blank" rel="noopener">Open shipping label</a>` : ''}</section>` : '';
  const history = (delivery.history || []).slice().reverse().map(entry => `<li><b>${safe(labels[entry.status] || entry.status)}</b><span>${safe(entry.note || '')}</span><time>${safe(formatListingDate(entry.createdAt))}</time></li>`).join('') || '<li><span>Delivery updates will appear here.</span></li>';
  const deliverySummary = `${safe(provider)} · ${safe(delivery.paymentMethod || 'Payment method pending')} · ${Number(delivery.deliveryMiles || 0).toFixed(1)} mi · ${money(delivery.courierPay || 0)} delivery estimate${delivery.trackingNumber ? ` · Tracking ${safe(delivery.trackingNumber)}` : trackingRequired ? ' · Tracking pending' : ' · Handoff confirmation required'}`;
  const purchaseFees = delivery.fees ? `<section class="delivery-fee-summary"><h3>Marketplace fees</h3><span>Buyer · ${Number(delivery.fees.buyer.rate * 100)}% · ${money(delivery.fees.buyer.amount)}</span><span>Seller · ${Number(delivery.fees.seller.rate * 100)}% · ${money(delivery.fees.seller.amount)}</span>${delivery.paypalFee !== undefined ? `${Number(delivery.minimumBuyerFee || 0) ? `<span>Minimum buyer fee (items under $10) · ${money(delivery.minimumBuyerFee)}</span>` : ''}<span>PayPal processing (3.49% + $0.49) · ${money(delivery.paypalFee)}</span><strong>Buyer total · ${money(Number(delivery.buyerSubtotal || 0) + Number(delivery.minimumBuyerFee || 0) + Number(delivery.paypalFee || 0))}</strong>` : ''}</section>` : '';
  openModal(`Delivery · ${delivery.listing?.title || 'Order'}`, `${seller ? `Buyer: @${safe(delivery.buyer?.username || 'collector')}` : `Seller: @${safe(delivery.seller?.username || 'collector')}`} · ${deliverySummary}`, `<section class="delivery-workspace"><ol class="delivery-timeline">${timeline}</ol><div class="delivery-address"><b>Delivery address</b><span>${safe(delivery.shippingAddress || '')}</span></div>${purchaseFees}<section class="delivery-history"><h3>Updates</h3><ul>${history}</ul></section>${shippoControls}${sellerControls}${returnPanel}<section class="delivery-thread"><h3>Message thread</h3>${messages}</section><form class="modal-form delivery-message-form" data-delivery="${delivery.id}"><textarea required name="body" maxlength="500" placeholder="Message ${seller ? 'buyer' : 'seller'}"></textarea><button>Send message</button></form></section>`);
}
function castVote(id, direction) { const state = stateFor(id); if (state.vote === direction) { state.score -= direction; state.vote = 0; } else { state.score += direction - state.vote; state.vote = direction; } savePostState(); renderFeed(); }
async function toggleFavorite(id) { if (!session) return openAuthPanel('login'); const result = await api(`/listing/${id}/favorite`, { method: 'POST', body: '{}' }); stateFor(id).favorite = result.favorited; savePostState(); renderFeed(); }
function money(value) { return `$${Number(value).toFixed(2)}`; }
function feeCalculator(item, type, shippingProfile = {}) {
  const trade = type === 'trade';
  const calculatedDistance = distanceFromViewer(item);
  const estimatedMiles = Number.isFinite(calculatedDistance) ? calculatedDistance.toFixed(1) : '0';
  const providerOptions = deliveryCarriers.map(provider => `<option value="${safe(provider)}" ${checkoutPreferences.deliveryProvider === provider ? 'selected' : ''}>${safe(provider)}</option>`).join('');
  const paymentMethods = [['PayPal', 'PayPal account']];
  const paymentChoices = `<fieldset class="payment-methods"><legend>Payment method <small>Choose how you want to pay</small></legend><div>${paymentMethods.map(([method, detail], index) => `<label class="payment-method"><input type="radio" name="paymentMethod" value="${method}" ${index === 0 ? 'checked' : ''}><span><b>${method}</b><small>${detail}</small></span></label>`).join('')}</div></fieldset>`;
  const fields = trade ? `<label>Your trade valuation<input id="buyer-value" type="number" min="0" value="${item.price}"></label><label>Other side’s valuation<input id="seller-value" type="number" min="0" value="${item.price}"></label><label>Offer note<input required id="offer-note" placeholder="Describe the item you are offering"></label>` : `<label>Item price<input id="buyer-value" type="number" min="0" value="${item.price}" readonly aria-readonly="true"></label><label class="purchase-delivery-option">Delivery option<select id="delivery-provider" required><option value="" selected disabled>Choose a delivery provider</option>${providerOptions}</select></label><label>Estimated delivery miles<input id="delivery-miles" type="number" min="0" step="0.1" value="${estimatedMiles}" ${Number.isFinite(calculatedDistance) ? 'readonly aria-readonly="true"' : ''}></label><small id="delivery-distance-note">Add a delivery address with ZIP code to calculate miles.</small><label>UPS packaging cost<input id="packaging" type="number" min="0" value="${safe(item.upsPackagingCost || 0)}" readonly aria-readonly="true"></label><output id="delivery-fee" class="delivery-fee-preview" aria-live="polite"></output><label>Estimated buyer tax<input id="tax" type="number" min="0" value="0"></label>`;
  const action = 'Send trade offer & open chat';
  const savedZip = safe(shippingProfile.zip || zipFromAddress(checkoutPreferences.address));
  const address = trade ? '' : `<section class="shipping-address-fields"><h3>Delivery address</h3><p>Used privately for the real UPS label after payment. It is shared only with the seller.</p><label>Recipient name<input required id="shipping-name" autocomplete="shipping name" maxlength="120" value="${safe(shippingProfile.name || '')}" placeholder="Full name"></label><label>Street address<input required id="shipping-street1" autocomplete="shipping street-address" maxlength="160" value="${safe(shippingProfile.street1 || '')}" placeholder="Street and number"></label><label>Address line 2 <i>Optional</i><input id="shipping-street2" autocomplete="shipping address-line2" maxlength="120" value="${safe(shippingProfile.street2 || '')}" placeholder="Apartment, suite, etc."></label><div><label>City<input required id="shipping-city" autocomplete="shipping address-level2" maxlength="80" value="${safe(shippingProfile.city || '')}"></label><label>State<input required id="shipping-state" autocomplete="shipping address-level1" maxlength="2" pattern="[A-Za-z]{2}" value="${safe(shippingProfile.state || '')}" placeholder="CA"></label><label>ZIP code<input required id="shipping-zip" autocomplete="shipping postal-code" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" maxlength="10" value="${savedZip}" placeholder="94103"></label></div></section>`;
  const memberships = '<label class="check"><input id="buyer-curator" type="checkbox"> Buyer has Curator membership ($150/month)</label><label class="check"><input id="seller-curator" type="checkbox"> Seller has Curator membership ($150/month)</label>';
  if (trade) return `<form class="fee-calculator" data-type="${type}" data-listing="${item.id}">${fields}${memberships}<div id="fee-summary" class="fee-summary"></div><p class="policy-note">Policy draft: delivery, fraud, and enforcement rules require legal review before launch.</p><button type="submit" class="transaction-submit">${action}</button></form>`;
  const agreement = '<label class="check purchase-agreement"><input required type="checkbox" id="purchase-agreement"> I confirm this order and delivery address.</label>';
  const itemImage = item.image || item.images?.[0] || '';
  const itemSummary = `<article class="purchase-item-summary"><img src="${safe(itemImage)}" alt=""><div><small>Purchasing from @${safe(item.owner?.username || 'collector')}</small><b>${safe(item.title)}</b><span>${safe(item.condition || item.category || 'Collector item')} · ${money(item.price)}</span></div></article>`;
  return `<form class="fee-calculator purchase-checkout" data-type="${type}" data-listing="${item.id}" data-seller="${safe(item.ownerId || '')}" data-seller-zip="${safe(item.sellerZip || '')}"><section class="purchase-fields"><header><span>1</span><div><b>Delivery details</b><small>Choose a provider, estimate the route, and confirm where this collector item should go.</small></div></header>${fields}${address}${paymentChoices}</section><aside class="purchase-review"><header><span>2</span><div><b>Order review</b><small>Review the item, fees, delivery estimate, and payment choice.</small></div></header>${itemSummary}<div id="fee-summary" class="fee-summary" aria-live="polite"></div>${agreement}<p class="policy-note">Pay securely with PayPal below. The checkout stays on CollectorMarketplace.net. Sandbox mode does not move real funds.</p><div class="paypal-button-container" aria-live="polite"></div></aside></form>`;
}
function updateFeeSummary() {
  const box = document.querySelector('.fee-calculator'); if (!box) return;
  const type = box.dataset.type; const buyerValue = Number(document.querySelector('#buyer-value')?.value || 0); const sellerValue = Number(document.querySelector('#seller-value')?.value || buyerValue); const seller = accounts.find(account => account.id === box.dataset.seller); const buyerRate = type === 'purchase' ? collectorFeeRate(session?.user) : document.querySelector('#buyer-curator')?.checked ? .01 : .04; const sellerRate = type === 'purchase' ? collectorFeeRate(seller) : document.querySelector('#seller-curator')?.checked ? .01 : .04; const tax = Number(document.querySelector('#tax')?.value || 0); const packaging = Number(document.querySelector('#packaging')?.value || 0); const miles = Number(document.querySelector('#delivery-miles')?.value || 0); const courier = Math.max(8, miles * .10) + packaging;
  const paymentMethod = document.querySelector('[name="paymentMethod"]:checked')?.value || 'Select a payment method'; const deliveryFee = document.querySelector('#delivery-fee'); if (deliveryFee) deliveryFee.textContent = `Calculated delivery fee · ${money(courier)} (${money(Math.max(8, miles * .10))} route minimum/rate + ${money(packaging)} packaging)`;
  const buyerMarketplaceFee = buyerValue * buyerRate; const buyerSubtotal = buyerValue + buyerMarketplaceFee + tax + courier; const minimumBuyerFee = buyerValue < 10 ? 10 : 0; const paypalFee = paypalProcessingFee(buyerSubtotal + minimumBuyerFee);
  document.querySelector('#fee-summary').innerHTML = type === 'trade' ? `<b>Trade valuation estimate</b><span>Buyer-side fee (${buyerRate * 100}%): ${money(buyerValue * buyerRate)}</span><span>Other-side fee (${sellerRate * 100}%): ${money(sellerValue * sellerRate)}</span><strong>Total valuation fees: ${money(buyerValue * buyerRate + sellerValue * sellerRate)}</strong>` : `<b>Purchase estimate</b><span>Payment method: ${safe(paymentMethod)}</span><span>Buyer marketplace fee (${buyerRate * 100}%): ${money(buyerMarketplaceFee)}</span><span>Seller marketplace fee (${sellerRate * 100}%): ${money(buyerValue * sellerRate)}</span><span>Calculated delivery fee: ${miles.toFixed(1)} mi · ${money(courier)}</span><span>Buyer tax: ${money(tax)} · Buyer shipping: ${money(courier)}</span>${minimumBuyerFee ? `<span>Minimum buyer fee (items under $10): ${money(minimumBuyerFee)}</span>` : ''}<span>PayPal processing (3.49% + $0.49): ${money(paypalFee)}</span><strong>Buyer due: ${money(buyerSubtotal + minimumBuyerFee + paypalFee)}</strong><strong>Seller fee: ${money(buyerValue * sellerRate)}</strong>`;
}
function setQuery(query) { activeQuery = query.trim(); search.value = activeQuery; document.querySelector('#clear-tags').hidden = !activeQuery; renderFeed(); }
const tagSlug = tag => String(tag).toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tagPath = tag => `/${tagSlug(tag)}/`;
const routeTags = () => {
  const parts = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '').toLowerCase().split('/').filter(Boolean);
  const [first, ...rest] = parts;
  const scope = searchScopes.includes(first) ? first : 'listings';
  const scopedParts = scope === 'listings' ? parts : rest;
  const [scopeFirst, ...scopeRest] = scopedParts;
  const isTagRoute = scopeFirst === 'all' || scopeFirst === 'any';
  const mode = isTagRoute ? scopeFirst : 'any';
  const routeSegments = (isTagRoute ? scopeRest : scopedParts).filter(segment => !/^posts\+\d+$/.test(segment));
  const slugs = routeSegments.join('/').split('+').filter(Boolean);
  const knownTags = [...new Set([...categoryOptions, ...Object.values(tagGroups).flat(), ...listings.flatMap(listingTags), ...couriers.flatMap(courier => courier.tags || []), ...chatrooms.flatMap(room => room.tags || [])])];
  const resolve = slug => knownTags.find(tag => tagSlug(tag) === slug) || '';
  const tagged = slugs.map(slug => ({ state: slug.startsWith('l-') ? 'locked' : slug.startsWith('v-') ? 'void' : 'active', tag: resolve(slug.replace(/^[lv]-/, '')) })).filter(row => row.tag);
  return { scope, mode, isTagRoute, active: tagged.filter(row => row.state === 'active').map(row => row.tag), locked: tagged.filter(row => row.state === 'locked').map(row => row.tag), voided: tagged.filter(row => row.state === 'void').map(row => row.tag) };
};
const currentTagPath = () => {
  const mode = tagMatchMode === 'all' ? 'all' : 'any';
  const tagsPath = [...activeTags.map(tagSlug), ...lockedTags.map(tag => `l-${tagSlug(tag)}`), ...voidTags.map(tag => `v-${tagSlug(tag)}`)].filter(Boolean).join('+');
  const hasTagState = Boolean(tagsPath);
  const resultCount = searchScope === 'listings' ? filtered().length : filteredDirectory().length;
  const postSuffix = hasTagState ? `posts+${resultCount}/` : '';
  const scopePrefix = searchScope === 'listings' ? '' : `${searchScope}/`;
  return `/${scopePrefix}${mode}/${tagsPath ? `${tagsPath}/` : ''}${postSuffix}`;
};
const syncTagRoute = (replace = false) => {
  const path = currentTagPath();
  if (location.pathname === path) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
};
// Keep tag URLs shareable without a full document navigation, which caused a
// visible flash every time collectors adjusted their filters.
const reloadTagRoute = () => { syncTagRoute(); renderTagMatchMode(); renderTags(); if (auctionTagView) refreshTaggedAuction(); else renderFeed(); };
const applyTagRoute = () => { const route = routeTags(); tagMatchMode = route.mode; activeTags = route.active.map(tag => tag.toLowerCase()); lockedTags = route.locked.map(tag => tag.toLowerCase()); voidTags = route.voided.map(tag => tag.toLowerCase()); setSearchScope(route.scope, false); saveLockedTags(); if (route.isTagRoute || route.scope !== 'listings' || [...route.active, ...route.locked, ...route.voided].length) syncTagRoute(true); renderTagMatchMode(); setDiscoveryMode(route.isTagRoute || [...route.active, ...route.locked, ...route.voided].length ? 'tags' : 'search'); renderTags(); renderFeed(); };
function toggleTag(tag, action = 'toggle') { const value = tag.toLowerCase(); const selected = activeTags.includes(value); if (action === 'add') { if (!selected) activeTags = [...activeTags, value]; else return; } else if (action === 'remove') { if (!selected) return; activeTags = activeTags.filter(current => current !== value); } else activeTags = selected ? activeTags.filter(current => current !== value) : [...activeTags, value]; reloadTagRoute(); }
function activateNav(name) { document.querySelectorAll('.bottom-nav button').forEach(button => button.classList.toggle('active', button.matches(`[data-${name}]`))); }
function auctionTime(lot) { if (lot.auctionEndless) return 'ENDLESS'; const left = Math.max(0, Math.floor((lot.endAt - Date.now()) / 1000)); const hours = String(Math.floor(left / 3600)).padStart(2, '0'); const minutes = String(Math.floor(left % 3600 / 60)).padStart(2, '0'); const seconds = String(left % 60).padStart(2, '0'); return `${hours}:${minutes}:${seconds}`; }
function updateAuctionClocks() { document.querySelectorAll('[data-auction-clock]').forEach(node => { const lot = auctions.find(row => row.id === node.dataset.auctionClock); if (lot) { node.textContent = auctionTime(lot); if (node.previousElementSibling && lot.auctionEndless) node.previousElementSibling.textContent = 'Open indefinitely'; node.closest('.auction-countdown')?.classList.toggle('is-urgent', !lot.auctionEndless && lot.endAt - Date.now() < 3600000); } }); }
function pauseAuctionFeed(milliseconds = 15000) { auctionFeedPausedUntil = Math.max(auctionFeedPausedUntil, Date.now() + milliseconds); }
function advanceAuctionFeed() {
  if (!document.body.classList.contains('auction-mode') || Date.now() < auctionFeedPausedUntil) return;
  // The live floor may refresh its status, but it must never replace the lot
  // a collector is viewing without an intentional catalogue selection.
  updateAuctionClocks();
}
function startAuctionFeed() { clearInterval(auctionFeedClock); auctionFeedClock = setInterval(advanceAuctionFeed, 8000); }
function renderAuctionHouse() {
  const lot = auctions.find(row => row.id === activeAuctionId) || auctions[0]; if (!lot) return;
  activeAuctionId = lot.id; const minimum = Number(lot.currentBid) + 5;
  const activity = auctionActivity.filter(row => row.lotId === lot.id).slice(0, 5);
  stream.innerHTML = `<section class="auction-house"><header class="auction-head"><div><p><i></i> Live bidding floor</p><h1>Auction House</h1></div><div class="auction-head-meta"><strong>${auctions.length}</strong><span>Lots open now</span></div></header><div class="auction-ticker"><span>LIVE</span><div>${auctions.map(item => `<button type="button" data-auction-select="${item.id}">${safe(item.title)} <b>${money(item.currentBid)}</b></button>`).join('')}</div></div><main class="auction-stage"><section class="auction-showcase"><div class="auction-art"><img src="${safe(lot.image)}" alt="${safe(lot.title)}"><span class="auction-lot-number">LOT ${String(auctions.indexOf(lot) + 1).padStart(2, '0')}</span><div class="auction-countdown"><small>Closing in</small><strong data-auction-clock="${lot.id}">${auctionTime(lot)}</strong></div></div><div class="auction-details"><p class="auction-category">${safe(lot.category)} · Live lot</p><h2>${safe(lot.title)}</h2><p class="auction-description">A featured collector lot, presented live. Review the current bid, join the room, and place your bid before the floor closes.</p><div class="auction-price"><span>Current bid</span><strong>${money(lot.currentBid)}</strong><small>${lot.bids} bids placed</small></div><form class="auction-bid-panel" data-auction-bid-form="${lot.id}"><label>Your maximum bid<input name="amount" required type="number" inputmode="decimal" min="${minimum}" step="1" value="${minimum}" aria-label="Your maximum bid"></label><div class="auction-quick-bids"><button type="button" data-bid-add="10">+ $10</button><button type="button" data-bid-add="25">+ $25</button><button type="button" data-bid-add="50">+ $50</button></div><button class="auction-bid" type="submit">Place live bid <span>→</span></button><small>By placing a bid, you agree to the auction terms.</small></form><button type="button" class="voice-start auction-voice" data-voice-room="auction:${lot.id}" data-voice-label="Auction voice · ${safe(lot.title)}">Join the live voice room</button></div></section><aside class="auction-live-panel"><header><span><i></i> Floor activity</span><small>Updates live</small></header><div class="auction-activity" aria-live="polite">${activity.length ? activity.map(row => `<article><b>${safe(row.initials)}</b><p><strong>${safe(row.name)}</strong> placed a bid <em>${money(row.amount)}</em><small>${safe(row.time)}</small></p></article>`).join('') : `<div class="auction-awaiting"><i>◇</i><strong>The floor is open</strong><span>New bids will appear here in real time.</span></div>`}</div><div class="auction-confidence"><span>Buyer protection</span><p>Verified accounts, binding bids, and protected checkout after the auction closes.</p></div></aside></main><section class="auction-lot-rail"><header><div><p>Tonight's catalogue</p><h2>Explore live lots</h2></div><span>Choose a lot to enter its bidding floor</span></header><div class="auction-grid">${auctions.map((item, index) => `<button type="button" class="auction-card ${item.id === lot.id ? 'is-active' : ''}" data-auction-select="${item.id}"><span class="auction-card-image"><img src="${safe(item.image)}" alt=""><i>LOT ${String(index + 1).padStart(2, '0')}</i></span><span class="auction-info"><small>${safe(item.category)}</small><strong>${safe(item.title)}</strong><span><b>${money(item.currentBid)}</b><em data-auction-clock="${item.id}">${auctionTime(item)}</em></span></span></button>`).join('')}</div></section></section>`;
  mountAuctionBlocks();
  syncAuctionWaterfallControl();
  updateAuctionClocks();
}
document.addEventListener('click', event => {
  if (!event.target.closest('[data-auction-waterfall-sound]') || !auctionWaterfallAudio) return;
  if (auctionWaterfallAudio.paused) startAuctionWaterfall();
  else { auctionWaterfallAudio.pause(); syncAuctionWaterfallControl(); }
});
document.addEventListener('click', event => {
  if (!event.target.closest('[data-account-venice-sound]') || !accountVeniceAudio) return;
  if (accountVeniceAudio.paused) startAccountVeniceAmbience();
  else stopAccountVeniceAmbience();
  syncAccountVeniceControl();
});
function showAuctionHouse() { if (observer) observer.disconnect(); clearInterval(auctionClock); sentinel.hidden = true; document.body.classList.remove('app-section-mode', 'app-section-chat', 'app-section-account'); document.body.classList.add('auction-mode'); startAuctionWaterfall(); syncBrowseModeUi(); if (!activeAuctionId) activeAuctionId = auctions[0]?.id; renderAuctionHouse(); auctionClock = setInterval(updateAuctionClocks, 1000); startAuctionFeed(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

document.addEventListener('click', event => {
  if (event.target.closest('.delivery-update-form, .delivery-message-form, .trade-message-form')) return;
  if (event.target.closest('[data-checkout-location]')) { openModal('Delivery ZIP code', 'Save a US ZIP code, or use your current approximate location, to show estimated buy totals. This is kept only in this browser.', `<form class="modal-form checkout-preferences-form" data-preference="location"><input required name="address" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" maxlength="10" placeholder="ZIP code" value="${safe(zipFromAddress(checkoutPreferences.address))}"><button type="button" class="auth-switch" data-checkout-current-location>Use current location for estimates</button><button>Save ZIP code</button></form>`); return; }
  if (event.target.closest('[data-checkout-current-location]')) { if (!navigator.geolocation) return openModal('Location unavailable', 'This browser cannot provide your current location. Enter an address with ZIP code instead.'); navigator.geolocation.getCurrentPosition(position => { checkoutPreferences.coordinates = { lat: Math.round(position.coords.latitude * 100) / 100, lng: Math.round(position.coords.longitude * 100) / 100 }; saveCheckoutPreferences(); renderCheckoutPreferenceButtons(); renderFeed(); modal.close(); }, () => openModal('Location permission needed', 'Allow location access in your browser, or enter an address with ZIP code instead.'), { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 }); return; }
  if (event.target.closest('[data-checkout-delivery]')) { openModal('Delivery option', 'Choose a delivery option for checkout. Nothing is selected until you choose it.', `<form class="modal-form checkout-preferences-form" data-preference="delivery"><fieldset class="payment-methods"><label class="payment-method"><input type="radio" name="deliveryProvider" value="UPS Priority" ${checkoutPreferences.deliveryProvider === 'UPS Priority' ? 'checked' : ''}><span><b>UPS Priority</b><small>Tracked carrier delivery</small></span></label></fieldset><button>Save delivery option</button></form>`); return; }
  if (event.target.closest('[data-checkout-estimate]')) { if (checkoutPreferences.estimateEnabled) { checkoutPreferences.estimateEnabled = false; saveCheckoutPreferences(); renderCheckoutPreferenceButtons(); renderFeed(); return; } if (!checkoutPreferences.deliveryProvider) return openModal('Choose delivery first', 'Select a delivery option before turning on buy estimates.'); if (!checkoutPreferences.coordinates) return openModal('Add a location first', 'Set a ZIP code or current location before turning on buy estimates.'); checkoutPreferences.estimateEnabled = true; saveCheckoutPreferences(); renderCheckoutPreferenceButtons(); renderFeed(); return; }
  if (event.target.closest('[data-checkout-payment]')) { openModal('Payment preference', 'The current marketplace payment option is PayPal.', '<form class="modal-form checkout-preferences-form" data-preference="payment"><input type="hidden" name="paymentMethod" value="PayPal"><p>PayPal is selected as your default payment method.</p><button>Save payment preference</button></form>'); return; }
  const shippoBuy = event.target.closest('[data-shippo-buy]'); if (shippoBuy) { if (!window.confirm('Buy this UPS label now? This charges your connected Shippo account.')) return; api(`/delivery/${shippoBuy.dataset.shippoBuy}/shippo/label`, { method: 'POST', body: '{}' }).then(() => openDelivery(shippoBuy.dataset.shippoBuy)).catch(error => openModal('Shippo label error', error.message)); return; }
  const tagMatch = event.target.closest('[data-tag-match]'); if (tagMatch) { tagMatchMode = tagMatch.dataset.tagMatch; reloadTagRoute(); return; }
  const community = event.target.closest('[data-community]'); if (community) { openCommunity(community.dataset.community, community.dataset.communityId, community.dataset.communityLabel).catch(showError); return; }
  const chatroom = event.target.closest('[data-chatroom]'); if (chatroom) { voiceChat.join(`chatroom:${chatroom.dataset.chatroom}`, chatroom.dataset.chatroomLabel || 'Collector chatroom').catch(showError); return; }
  const directoryPage = event.target.closest('[data-directory-page]'); if (directoryPage) { openDirectoryPage(directoryPage.dataset.directoryPage, directoryPage.dataset.directoryId).catch(showError); return; }
  const voiceStart = event.target.closest('[data-voice-room]'); if (voiceStart) { voiceChat.join(voiceStart.dataset.voiceRoom, voiceStart.dataset.voiceLabel).catch(showError); return; }
  if (event.target.closest('[data-voice-mute]')) { voiceChat.toggleMute(); return; }
  if (event.target.closest('[data-voice-video]')) { voiceChat.toggleVideo().catch(showError); return; }
  if (event.target.closest('[data-voice-leave]')) { voiceChat.leave(); return; }
  const auctionSelect = event.target.closest('[data-auction-select]'); if (auctionSelect) { pauseAuctionFeed(20000); activeAuctionId = auctionSelect.dataset.auctionSelect; renderFilteredAuctionHouse(); document.querySelector('.auction-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const bidAdd = event.target.closest('[data-bid-add]'); if (bidAdd) { const input = bidAdd.closest('form').querySelector('[name="amount"]'); input.value = Number(input.value || input.min) + Number(bidAdd.dataset.bidAdd); input.focus(); return; }
  const passwordToggle = event.target.closest('[data-password-toggle]'); if (passwordToggle) { const input = passwordToggle.closest('.password-field').querySelector('input'); const showing = input.type === 'text'; input.type = showing ? 'password' : 'text'; passwordToggle.textContent = showing ? '◉' : '◉̸'; passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password'); passwordToggle.setAttribute('aria-pressed', String(!showing)); input.focus(); return; }
  const listingEdit = event.target.closest('[data-listing-edit]'); if (listingEdit) { openListingEditor(listingEdit.dataset.listingEdit).catch(showError); return; }
  const listingArchive = event.target.closest('[data-listing-archive]'); if (listingArchive) { api(`/listing/${listingArchive.dataset.listingArchive}`, { method: 'PUT', body: JSON.stringify({ status: listingArchive.dataset.listingNextStatus }) }).then(async () => { await loadMarket(); if (listingArchive.dataset.listingEditAfter) await openListingEditor(listingArchive.dataset.listingArchive); else await openAccountPanel(); }).catch(showError); return; }
  const listingDelete = event.target.closest('[data-listing-delete]'); if (listingDelete) { if (!window.confirm('Delete this listing permanently? This cannot be undone.')) return; api(`/listing/${listingDelete.dataset.listingDelete}`, { method: 'DELETE' }).then(async () => { await loadMarket(); await openAccountPanel(); }).catch(showError); return; }
  if (event.target.closest('[data-browse-mode]')) { toggleBrowseMode(); return; }
  const scopeButton = event.target.closest('[data-search-scope]'); if (scopeButton) { setSearchScope(scopeButton.dataset.searchScope); return; }
  const tag = event.target.closest('[data-tag]'); const category = event.target.closest('[data-category]'); const trade = event.target.closest('[data-trade]'); const action = event.target.closest('[data-home],[data-market],[data-auction],[data-chat],[data-sell],[data-account],[data-curator],[data-policy]');
  const profile = event.target.closest('[data-profile]'); if (profile) openProfile(profile.dataset.profile).catch(showError);
  if (tag) { setDiscoveryMode('tags'); toggleTag(tag.dataset.tag, event.shiftKey ? 'add' : event.ctrlKey || event.metaKey ? 'remove' : 'toggle'); }
  if (category) { activeCategory = category.dataset.category; renderCategories(); renderFeed(); }
  if (trade) { const item = listings.find(row => row.id === trade.dataset.trade); if (!session) return openAuthPanel('login'); openTradeOfferChat(item); }
  const purchase = event.target.closest('[data-purchase]'); if (purchase) { const item = listings.find(row => row.id === purchase.dataset.purchase); if (!session) return openAuthPanel('login'); if (item?.ownerId === session.user.id) return openModal('Your own listing', 'You cannot buy your own listing. Use your account page to edit, archive, or manage it instead.'); api('/account/shipping-profile').catch(() => ({})).then(shippingProfile => { openModal(`Buy ${item.title}`, 'Choose UPS Priority, then enter the private address used for the real shipping label. PayPal stays inside this checkout after you review the order.', feeCalculator(item, 'purchase', shippingProfile)); modal.classList.add('purchase-dialog'); document.body.classList.add('purchase-open'); const checkout = modalContent.querySelector('.purchase-checkout'); updateFeeSummary(); const zip = checkout?.querySelector('#shipping-zip'); if (zip?.value) calculateCheckoutDeliveryFromAddress(zip); renderPayPalButtonForPurchase(checkout); }).catch(showError); }
  const commentVote = event.target.closest('[data-comment-vote]'); if (commentVote) { if (!session) return openAuthPanel('login'); const item = listings.find(row => row.id === commentVote.dataset.commentListing); api(`/comment/${commentVote.dataset.comment}/vote`, { method: 'POST', body: JSON.stringify({ direction: Number(commentVote.dataset.commentVote) }) }).then(() => openComments(item)).catch(showError); return; }
  const commentSort = event.target.closest('[data-comment-sort]'); if (commentSort) { commentSortMode = commentSort.dataset.commentSort; const item = listings.find(row => row.id === commentSort.dataset.commentListing); if (item) openComments(item).catch(showError); return; }
  const cancelCommentReply = event.target.closest('[data-comment-cancel-reply]'); if (cancelCommentReply) { const item = listings.find(row => row.id === cancelCommentReply.dataset.commentListing); if (item) openComments(item).catch(showError); return; }
  const openEmojiPicker = event.target.closest('[data-comment-open-emoji]'); if (openEmojiPicker) { const host = openEmojiPicker.closest('.comment-form')?.querySelector('.comment-emoji-host'); if (host) { host.hidden = false; host.innerHTML = renderCommentEmojiPicker(); host.querySelector('[data-comment-emoji-search]')?.focus(); } return; }
  const closeEmojiPicker = event.target.closest('[data-comment-close-emoji]'); if (closeEmojiPicker) { const host = closeEmojiPicker.closest('.comment-emoji-host'); if (host) { host.hidden = true; host.innerHTML = ''; } return; }
  const commentEmoji = event.target.closest('[data-comment-emoji]'); if (commentEmoji) { const composer = modal.querySelector('[data-comment-composer]'); if (composer) { const start = composer.selectionStart ?? composer.value.length; const end = composer.selectionEnd ?? start; composer.value = `${composer.value.slice(0, start)}${commentEmoji.dataset.commentEmoji}${composer.value.slice(end)}`; composer.selectionStart = composer.selectionEnd = start + commentEmoji.dataset.commentEmoji.length; composer.dispatchEvent(new Event('input', { bubbles: true })); composer.focus(); } return; }
  const commentRecord = event.target.closest('[data-comment-record]'); if (commentRecord) { toggleCommentRecording(commentRecord).catch(showError); return; }
  const removeCommentAudio = event.target.closest('[data-comment-remove-audio]'); if (removeCommentAudio) { const form = removeCommentAudio.closest('.comment-form'); const input = form?.querySelector('[name="audioUrl"]'); const preview = form?.querySelector('[data-comment-audio-preview]'); if (input) input.value = ''; if (preview) { preview.hidden = true; preview.innerHTML = ''; } return; }
  const deleteComment = event.target.closest('[data-comment-delete]'); if (deleteComment) { if (!window.confirm('Delete this comment? Replies will remain in the discussion.')) return; const item = listings.find(row => row.id === deleteComment.dataset.commentListing); api(`/comment/${deleteComment.dataset.commentDelete}`, { method: 'DELETE' }).then(async () => { await loadMarket(); if (item) openComments(item); }).catch(showError); return; }
  const vote = event.target.closest('[data-vote]'); if (vote) castVote(vote.dataset.post, vote.dataset.vote === 'up' ? 1 : -1);
  const favorite = event.target.closest('[data-favorite]'); if (favorite) toggleFavorite(favorite.dataset.favorite).catch(showError);
  const accountFollow = event.target.closest('[data-account-follow]'); if (accountFollow) api(`/user/${accountFollow.dataset.accountFollow}/follow`, { method: 'POST', body: '{}' }).then(result => { session.user.following = result.following ? [...new Set([...(session.user.following || []), accountFollow.dataset.accountFollow])] : (session.user.following || []).filter(id => id !== accountFollow.dataset.accountFollow); saveSession(session); openAccountPanel(); }).catch(showError);
  const chatFollow = event.target.closest('[data-chat-follow]'); if (chatFollow) api(`/user/${chatFollow.dataset.chatFollow}/follow`, { method: 'POST', body: '{}' }).then(result => { session.user.following = result.following ? [...new Set([...(session.user.following || []), chatFollow.dataset.chatFollow])] : (session.user.following || []).filter(id => id !== chatFollow.dataset.chatFollow); saveSession(session); openChatCenter(); }).catch(showError);
  const follow = event.target.closest('[data-follow]'); if (follow) api(`/user/${follow.dataset.follow}/follow`, { method: 'POST', body: '{}' }).then(result => { session.user.following = result.following ? [...new Set([...(session.user.following || []), follow.dataset.follow])] : (session.user.following || []).filter(id => id !== follow.dataset.follow); saveSession(session); openProfile(follow.dataset.follow); }).catch(showError);
  const comments = event.target.closest('[data-comments]'); if (comments) { const item = listings.find(row => row.id === comments.dataset.comments); openComments(item); }
  const reply = event.target.closest('[data-comment-reply]'); if (reply) { const item = listings.find(row => row.id === reply.dataset.commentListing); openComments(item, reply.dataset.commentReply); }
  if (event.target.closest('[data-account-edit]')) { const user = session?.user; if (!user) return openAuthPanel(); openModal('Edit profile', 'Update your public collector identity, discovery tags, and optional lobby song. Only profile visitors can play your song.', `<form class="modal-form profile-form"><input required name="username" placeholder="Username" value="${safe(user.username)}"><input name="bio" placeholder="Short bio" value="${safe(user.bio || '')}"><textarea name="profileTags" maxlength="1000" placeholder="Discovery tags, separated by commas or new lines">${safe((user.profileTags || []).join(', '))}</textarea><small>Up to 20 tags. Example: vintage, watches, art deco</small><input name="avatarUrl" type="url" placeholder="Profile image URL (optional)" value="${/^https?:\/\//i.test(user.avatar || '') ? safe(user.avatar) : ''}"><label class="profile-upload">Upload profile image<input name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp"></label><section class="lobby-song-editor"><b>Lobby song <small>Optional · MP3 under 4 MB</small></b><input type="hidden" name="lobbySong" value="${safe(user.lobbySong || '')}"><label class="profile-upload">Choose an MP3<input name="lobbySongFile" type="file" accept="audio/mpeg,audio/mp3,.mp3"></label><small data-lobby-song-status>${user.lobbySong ? 'Lobby song ready' : 'You can also paste an MP3 into this form.'}</small><button type="button" data-lobby-song-remove>Remove song</button></section><button>Save profile</button></form>`); }
  if (event.target.closest('[data-shipping-profile]')) openShippingProfile().catch(showError);
  const authSwitch = event.target.closest('[data-auth-switch]'); if (authSwitch) openAuthPanel(authSwitch.dataset.authSwitch);
  if (event.target.closest('[data-signout]')) { voiceChat.leave(); saveSession(null); document.querySelector('[data-home]')?.click(); }
  if (event.target.closest('[data-delivery-center]')) openDeliveryCenter();
  const deliveryButton = event.target.closest('[data-delivery]'); if (deliveryButton) openDelivery(deliveryButton.dataset.delivery);
  const tradeChat = event.target.closest('[data-trade-chat]'); if (tradeChat) openTradeChat(tradeChat.dataset.tradeChat);
  const tradeAccept = event.target.closest('[data-trade-accept]'); if (tradeAccept) openTradeDeliveryConfirmation(tradeAccept.dataset.tradeAccept).catch(showError);
  const conversation = event.target.closest('[data-conversation]'); if (conversation) openConversation(conversation.dataset.conversation).catch(showError);
  const collectorChat = event.target.closest('[data-collector-chat]'); if (collectorChat) openCollectorChat(collectorChat.dataset.collectorChat).catch(showError);
  const startTrade = event.target.closest('[data-start-trade]'); if (startTrade) startTradeWithCollector(startTrade.dataset.startTrade, startTrade.dataset.startTradeConversation);
  const tradeStatus = event.target.closest('[data-trade-status]'); if (tradeStatus) api(`/trade/${tradeStatus.dataset.tradeId}`, { method: 'PUT', body: JSON.stringify({ status: tradeStatus.dataset.tradeStatus }) }).then(() => openTradeChat(tradeStatus.dataset.tradeId)).catch(error => openModal('Trade error', error.message));
  const confirmDelivery = event.target.closest('[data-delivery-confirm]'); if (confirmDelivery) api(`/delivery/${confirmDelivery.dataset.delivery}/confirm`, { method: 'POST', body: '{}' }).then(() => openDeliveryCenter()).catch(error => openModal('Delivery error', error.message));
  const issueDelivery = event.target.closest('[data-delivery-issue]'); if (issueDelivery) api(`/delivery/${issueDelivery.dataset.delivery}`, { method: 'PUT', body: JSON.stringify({ status: 'issue_reported' }) }).then(() => openDelivery(issueDelivery.dataset.delivery)).catch(error => openModal('Delivery error', error.message));
  const returnReceived = event.target.closest('[data-return-received]'); if (returnReceived) api(`/delivery/${returnReceived.dataset.returnReceived}/return-received`, { method: 'POST', body: '{}' }).then(() => openDelivery(returnReceived.dataset.returnReceived)).catch(error => openModal('Return error', error.message));
  if (action?.matches('[data-sell]')) { setWorkspaceHash('list-item'); activateNav('sell'); openListingForm(); }
  if (action?.matches('[data-chat]')) { setWorkspaceHash('chat'); activateNav('chat'); openChatCenter(); }
  if (action?.matches('[data-account]')) { if (session) startAccountVeniceAmbience(); setWorkspaceHash('account'); activateNav('account'); openAccountPanel(); }
  if (action?.matches('[data-curator]')) { setWorkspaceHash('vip-curator'); openCuratorMembership().catch(showError); }
  if (action?.matches('[data-policy]')) { setWorkspaceHash('fees'); openModal('Marketplace fees', 'Standard purchase fees are 4% per side. Curator members pay 1% on their own side for $150/month. Buyers pay taxes and delivery; courier pay is the greater of $8 or $0.10 per mile, plus packaging. Transaction and delivery terms are policy drafts pending legal review.'); }
  if (action?.matches('[data-auction]')) { setWorkspaceHash('auction-house'); activateNav('auction'); showAuctionHouse(); }
  if (event.target.closest('.like')) { const like = event.target.closest('.like'); like.textContent = like.textContent === '♡' ? '♥' : '♡'; like.classList.toggle('liked'); }
  if (action?.matches('[data-market],[data-home]')) { setWorkspaceHash('browse'); stopAuctionWaterfall(); stopAccountVeniceAmbience(); stopSellLavaAmbience(); stopSellLavaGame(); stopVeniceSailingGame(); document.body.classList.remove('auction-mode', 'app-section-mode', 'app-section-chat', 'app-section-account', 'app-section-listing'); clearInterval(auctionClock); clearInterval(auctionFeedClock); activateNav(action.matches('[data-market]') ? 'market' : 'home'); sentinel.hidden = false; activeCategory = 'All'; setQuery(''); setDiscoveryMode(activeTags.length || lockedTags.length || voidTags.length ? 'tags' : 'search'); renderTags(); renderCategories(); renderFeed(); if (observer) observer.observe(sentinel); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (event.target.matches('.close')) modal.close();
});
search.addEventListener('input', event => { setDiscoveryMode('search'); clearTimeout(searchRenderTimer); const value = event.target.value; searchRenderTimer = setTimeout(() => setQuery(value), 140); });
tagSearch.addEventListener('input', event => { clearTimeout(searchRenderTimer); const value = event.target.value; searchRenderTimer = setTimeout(() => { renderTags(value); renderFeed(); }, 140); });
const requestViewerLocation = () => {
  if (!navigator.geolocation) { listingSort.value = 'recent'; sortMode = 'recent'; listingSort.title = 'Closest to you needs browser location support.'; return; }
  listingSort.disabled = true;
  listingSort.title = 'Requesting your approximate location…';
  navigator.geolocation.getCurrentPosition(position => {
    viewerLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    listingSort.disabled = false;
    listingSort.title = 'Using your approximate device location for this browsing session.';
    const button = document.querySelector('[data-viewer-location]'); if (button) { button.textContent = '⌖ Location active'; button.setAttribute('aria-pressed', 'true'); }
    renderFeed();
  }, () => {
    sortMode = 'recent'; listingSort.value = 'recent'; listingSort.disabled = false;
    listingSort.title = 'Location permission was not granted, so closest sorting is unavailable.';
    renderFeed();
  }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
};
listingSort.addEventListener('change', event => { sortMode = event.target.value; if (sortMode === 'closest' && !viewerLocation) return requestViewerLocation(); renderFeed(); });
navigator.permissions?.query({ name: 'geolocation' }).then(result => { if (result.state === 'granted' && !viewerLocation) requestViewerLocation(); }).catch(() => {});
priceMin.addEventListener('input', () => renderFeed());
priceMax.addEventListener('input', () => renderFeed());
tagSearch.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); const requested = event.target.value.match(/#?[a-z0-9-]+/gi) || []; const available = [...new Set(listings.flatMap(listingTags))]; const matches = requested.map(value => value.replace('#', '').toLowerCase()).filter(value => available.some(tag => tag.toLowerCase() === value)); const nextTags = [...new Set([...activeTags, ...matches])]; const added = nextTags.length > activeTags.length; activeTags = nextTags; if (added) { reloadTagRoute(); return; } syncTagRoute(); event.target.value = ''; renderTags(); renderFeed(); } });
document.querySelector('#clear-tags').addEventListener('click', () => setQuery(''));
document.querySelector('#remove-tags').addEventListener('click', () => {
  activeTags = [];
  lockedTags = [];
  voidTags = [];
  tagSearch.value = '';
  saveLockedTags();
  reloadTagRoute();
});
document.addEventListener('click', event => {
  const viewerButton = event.target.closest('[data-viewer-location]');
  if (viewerButton) { event.preventDefault(); requestViewerLocation(); return; }
  const capture = event.target.closest('[data-capture-location]');
  if (!capture) return;
  event.preventDefault();
  if (!navigator.geolocation) { capture.textContent = 'Location is unavailable in this browser'; return; }
  capture.disabled = true; capture.textContent = 'Saving approximate location…';
  navigator.geolocation.getCurrentPosition(position => {
    const form = capture.closest('.listing-form');
    const round = value => Math.round(value * 100) / 100;
    const latitude = form?.querySelector('[name="locationLat"]');
    const longitude = form?.querySelector('[name="locationLng"]');
    if (latitude) latitude.value = String(round(position.coords.latitude));
    if (longitude) longitude.value = String(round(position.coords.longitude));
    capture.textContent = 'Approximate location saved';
  }, () => { capture.disabled = false; capture.textContent = 'Location permission was not granted'; }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
});
function setDiscoveryMode(mode) { const discovery = search.closest('.discovery'); const isSearch = mode === 'search'; discovery.classList.toggle('mode-search', isSearch); discovery.classList.toggle('mode-tags', !isSearch); document.querySelector('#search-tab').classList.toggle('is-active', isSearch); document.querySelector('#tags-tab').classList.toggle('is-active', !isSearch); document.querySelector('#search-tab').setAttribute('aria-selected', String(isSearch)); document.querySelector('#tags-tab').setAttribute('aria-selected', String(!isSearch)); }
document.querySelector('#search-tab').addEventListener('click', () => { setWorkspaceHash('search'); setDiscoveryMode('search'); search.focus(); });
document.querySelector('#tags-tab').addEventListener('click', () => { setWorkspaceHash('tags'); setDiscoveryMode('tags'); tagSearch.focus(); });
modal.addEventListener('click', event => { if (event.target === modal && !modal.classList.contains('listing-dialog')) modal.close(); });
modal.addEventListener('cancel', event => { if (modal.classList.contains('listing-dialog')) event.preventDefault(); });
modal.addEventListener('close', () => {
  stopCommentRecording();
  document.body.classList.remove('chat-open', 'account-open', 'purchase-open', 'comments-open');
  syncBrowseModeUi();
  const workspace = location.hash.slice(1).toLowerCase();
  if (restoringWorkspaceHistory || !modalWorkspaceHashes.has(workspace)) return;
  if (history.state?.returnHash) history.back();
  else {
    history.replaceState({}, '', `${location.pathname}${location.search}#browse`);
    if (listings.length) applyHashLocation();
  }
});
document.addEventListener('keydown', event => { const composer = event.target.closest('.collector-message-form textarea'); if (composer && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); composer.form.requestSubmit(); } });
document.addEventListener('submit', async event => { const form = event.target; const appSection = form.closest('.app-section-page'); if (form.closest('#modal') || appSection) { event.preventDefault(); const showError = error => { const host = appSection?.querySelector('.app-section-content') || modalContent; host.querySelector('.form-submit-error')?.remove(); host.insertAdjacentHTML('afterbegin', `<p class="modal-copy form-submit-error" role="alert">${safe(error.message)}</p>`); };
  try {
    const checkoutPreferencesForm = form.closest('.checkout-preferences-form'); if (checkoutPreferencesForm) { const fields = new FormData(checkoutPreferencesForm); if (checkoutPreferencesForm.dataset.preference === 'location') { checkoutPreferences.address = String(fields.get('address') || '').trim(); await refreshCheckoutEstimates(); } else if (checkoutPreferencesForm.dataset.preference === 'delivery') { const deliveryProvider = String(fields.get('deliveryProvider') || '').trim(); if (!deliveryProvider) throw new Error('Choose a delivery option before saving.'); checkoutPreferences.deliveryProvider = deliveryProvider; checkoutPreferences.deliveryPreferenceChosen = true; checkoutPreferences.estimateEnabled = false; } else checkoutPreferences.paymentMethod = String(fields.get('paymentMethod') || 'PayPal'); saveCheckoutPreferences(); renderCheckoutPreferenceButtons(); modal.close(); return; }
    const shippingProfileForm = form.closest('.shipping-profile-form'); if (shippingProfileForm) { const fields = new FormData(shippingProfileForm); await api('/account/shipping-profile', { method: 'PUT', body: JSON.stringify({ name: String(fields.get('name') || '').trim(), street1: String(fields.get('street1') || '').trim(), street2: String(fields.get('street2') || '').trim(), city: String(fields.get('city') || '').trim(), state: String(fields.get('state') || '').trim().toUpperCase(), zip: String(fields.get('zip') || '').trim(), country: 'US' }) }); modal.close(); return; }
    const authForm = form.closest('.auth-form'); if (authForm) { const fields = new FormData(authForm); const mode = authForm.dataset.mode; const body = mode === 'login' ? { email: fields.get('email'), password: fields.get('password') } : { username: fields.get('username'), email: fields.get('email'), password: fields.get('password') }; const result = await api(mode === 'login' ? '/login' : '/signup', { method: 'POST', body: JSON.stringify(body) }); saveSession(result); await loadDeliveries(); openAccountPanel(); return; }
    const profileForm = form.closest('.profile-form'); if (profileForm) { const fields = new FormData(profileForm); const file = fields.get('avatarFile'); const songFile = fields.get('lobbySongFile'); let avatar = String(fields.get('avatarUrl') || '').trim(); let lobbySong = String(fields.get('lobbySong') || ''); if (file instanceof File && file.size) { if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) throw new Error('Use a JPG, PNG, or WEBP profile image under 2 MB.'); avatar = await optimizeListingImage(file); } if (songFile instanceof File && songFile.size) lobbySong = await readLobbySong(songFile); if (avatar && !/^(https?:\/\/|data:image\/)/i.test(avatar)) throw new Error('Use a valid profile image URL.'); const profileTags = String(fields.get('profileTags') || '').split(/[\n,]+/).map(tag => tag.replace(/^#/, '').trim()).filter(Boolean); const user = await api(`/user/${session.user.id}`, { method: 'PUT', body: JSON.stringify({ username: fields.get('username'), bio: fields.get('bio'), avatar, profileTags, lobbySong }) }); saveSession({ ...session, user }); accounts = accounts.map(account => account.id === user.id ? { ...account, ...user } : account); openAccountPanel(); return; }
    const listingEditor = form.closest('.listing-editor-form'); if (listingEditor) { const fields = new FormData(listingEditor); const tags = String(fields.get('tags') || '').split(/[\n,]+/).map(tag => tag.replace(/^#/, '').trim()).filter(Boolean); const images = String(fields.get('images') || '').split(/[\n,]+/).map(value => value.trim()).filter(value => /^(https?:\/\/|data:image\/)/i.test(value)).slice(0, 5); if (!images.length) throw new Error('Keep at least one valid listing image.'); const updated = await api(`/listing/${listingEditor.dataset.listingEditor}`, { method: 'PUT', body: JSON.stringify({ title: fields.get('title'), category: fields.get('category'), condition: fields.get('condition'), price: Number(fields.get('price') || 0), tags, images, description: fields.get('description'), upsPackagingCost: Number(fields.get('upsPackagingCost') || 0), tradeOffer: fields.get('tradeOffer') === 'on' }) }); await loadMarket(); await openAccountPanel(); return updated; }
    const communityPost = form.closest('.community-post-form'); if (communityPost) { if (!session) return openAuthPanel('login'); const fields = new FormData(communityPost); await api(`/community/${communityPost.dataset.communityType}/${communityPost.dataset.communityId}`, { method: 'POST', body: JSON.stringify({ title: fields.get('title'), body: fields.get('body') }) }); await openCommunity(communityPost.dataset.communityType, communityPost.dataset.communityId); return; }
    const communityReply = form.closest('.community-reply-form'); if (communityReply) { if (!session) return openAuthPanel('login'); const fields = new FormData(communityReply); await api(`/community/${communityReply.dataset.communityType}/${communityReply.dataset.communityId}/${communityReply.dataset.communityPost}/replies`, { method: 'POST', body: JSON.stringify({ body: fields.get('body') }) }); await openCommunity(communityReply.dataset.communityType, communityReply.dataset.communityId); return; }
    const listingForm = form.closest('.listing-form'); if (listingForm) { commitListingTagEntry(listingForm); const fields = new FormData(listingForm); const images = [...uploadedListingImages, ...imageUrls(fields.get('imageUrls') || '')].slice(0, 5); const condition = String(fields.get('condition') || '').trim(); const tags = parseListingTags(fields.get('tags'), fields.get('category'), condition); const latitude = String(fields.get('locationLat') || '').trim(); const longitude = String(fields.get('locationLng') || '').trim(); if (!images.length) throw new Error('Add at least one listing photo or image link.'); if (tags.length > 8) throw new Error('Use up to 8 tags, including the category and condition.'); const button = listingForm.querySelector('button[type="submit"], button:not([type])'); button.disabled = true; button.textContent = 'Publishing…'; const created = await api('/listing', { method: 'POST', body: JSON.stringify({ title: fields.get('title'), description: fields.get('description'), category: fields.get('category'), condition, tags, sellerCity: fields.get('sellerCity'), sellerZip: fields.get('sellerZip'), pickupRadiusMiles: fields.get('pickupRadiusMiles'), shippingPackagingCost: fields.get('shippingPackagingCost'), locationCoordinates: latitude && longitude ? { lat: latitude, lng: longitude } : null, fulfillment: fields.get('fulfillment'), listingMode: fields.get('listingMode'), auctionStartPrice: fields.get('auctionStartPrice'), auctionDurationHours: fields.get('auctionDurationHours'), price: fields.get('price'), tradeOffer: fields.get('tradeOffer') === 'on', images, videos: uploadedListingVideos }) }); if (created.listingMode !== 'marketplace') auctions = [...auctions, { ...created, image: created.images?.[0] || '', currentBid: Number(created.auctionStartPrice || 0), bids: 0, endAt: new Date(created.auctionEndAt).valueOf() }]; listingDraft = {}; localStorage.removeItem('collector-marketplace-listing-draft'); await loadMarket(); modal.close(); return; }
    const commentForm = form.closest('.comment-form'); if (commentForm) { const item = listings.find(row => row.id === commentForm.dataset.post); const fields = new FormData(commentForm); const comment = commentForm.querySelector('textarea').value.trim(); const mediaUrl = String(fields.get('mediaUrl') || '').trim(); const audioUrl = String(fields.get('audioUrl') || '').trim(); if (!session) return openAuthPanel('login'); if (!comment && !audioUrl) throw new Error('Write a comment or record a voice note before posting.'); await api('/comment', { method: 'POST', body: JSON.stringify({ listingId: item.id, body: comment, mediaUrl, audioUrl, parentId: commentForm.dataset.parent || undefined }) }); await loadMarket(); const refreshed = listings.find(row => row.id === item.id) || item; await openComments(refreshed); return; }
    const shippoRate = form.closest('.shippo-rate-form'); if (shippoRate) { const fields = new FormData(shippoRate); const address = prefix => ({ name: fields.get(`${prefix}Name`), street1: fields.get(`${prefix}Street1`), city: fields.get(`${prefix}City`), state: fields.get(`${prefix}State`), zip: fields.get(`${prefix}Zip`), country: 'US' }); const button = shippoRate.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Getting live UPS rate…'; await api(`/delivery/${shippoRate.dataset.delivery}/shippo/rate`, { method: 'POST', body: JSON.stringify({ origin: address('origin'), destination: address('destination'), parcel: { length: fields.get('length'), width: fields.get('width'), height: fields.get('height'), weight: fields.get('weight') } }) }); await openDelivery(shippoRate.dataset.delivery); return; }
    const returnRequest = form.closest('.return-request-form'); if (returnRequest) { const fields = new FormData(returnRequest); await api(`/delivery/${returnRequest.dataset.delivery}/return-request`, { method: 'POST', body: JSON.stringify({ reason: fields.get('reason') }) }); await openDelivery(returnRequest.dataset.delivery); return; }
    const returnDecision = form.closest('.return-decision-form'); if (returnDecision) { const fields = new FormData(returnDecision); const decision = event.submitter?.value; if (!['approved', 'declined'].includes(decision)) throw new Error('Choose whether to approve or decline the return.'); await api(`/delivery/${returnDecision.dataset.delivery}/return`, { method: 'PUT', body: JSON.stringify({ decision, note: fields.get('note') }) }); await openDelivery(returnDecision.dataset.delivery); return; }
    const returnTracking = form.closest('.return-tracking-form'); if (returnTracking) { const fields = new FormData(returnTracking); await api(`/delivery/${returnTracking.dataset.delivery}/return-tracking`, { method: 'POST', body: JSON.stringify({ carrier: fields.get('carrier'), trackingNumber: fields.get('trackingNumber') }) }); await openDelivery(returnTracking.dataset.delivery); return; }
    const deliveryUpdate = form.closest('.delivery-update-form'); if (deliveryUpdate) { const fields = new FormData(deliveryUpdate); await api(`/delivery/${deliveryUpdate.dataset.delivery}`, { method: 'PUT', body: JSON.stringify({ status: fields.get('status'), courier: fields.get('courier'), trackingNumber: fields.get('trackingNumber'), note: fields.get('note') }) }); await openDelivery(deliveryUpdate.dataset.delivery); return; }
    const deliveryMessage = form.closest('.delivery-message-form'); if (deliveryMessage) { const fields = new FormData(deliveryMessage); await api(`/delivery/${deliveryMessage.dataset.delivery}/messages`, { method: 'POST', body: JSON.stringify({ body: fields.get('body') }) }); await openDelivery(deliveryMessage.dataset.delivery); return; }
    const tradeMessage = form.closest('.trade-message-form'); if (tradeMessage) { const fields = new FormData(tradeMessage); await api(`/trade/${tradeMessage.dataset.trade}`, { method: 'PUT', body: JSON.stringify({ message: fields.get('body') }) }); await openTradeChat(tradeMessage.dataset.trade); return; }
    const collectorMessage = form.closest('.collector-message-form'); if (collectorMessage) { const fields = new FormData(collectorMessage); const body = String(fields.get('body') || '').trim(); if (!body) return; const button = collectorMessage.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Sending…'; await api(`/conversation/${collectorMessage.dataset.conversation}/messages`, { method: 'POST', body: JSON.stringify({ body }) }); await openConversation(collectorMessage.dataset.conversation); return; }
    const tradeBuilder = form.matches('.trade-builder-form'); if (tradeBuilder) { if (!session) return openAuthPanel('login'); const fields = new FormData(form); const selected = name => [...fields.getAll(name)].filter(Boolean); const senderListingIds = selected('senderListingIds'); const receiverListingIds = [...new Set([...selected('receiverListingIds'), form.dataset.listing])]; const senderCashAmount = Number(fields.get('senderCashAmount') || 0); const receiverCashAmount = Number(fields.get('receiverCashAmount') || 0); if (!senderListingIds.length) throw new Error('Choose at least one of your listings to offer.'); if (!receiverListingIds.length) throw new Error('Choose at least one listing to receive.'); if (![senderCashAmount, receiverCashAmount].every(amount => Number.isFinite(amount) && amount >= 0)) throw new Error('Use valid cash amounts.'); if (senderCashAmount > 0 && receiverCashAmount > 0) throw new Error('Cash can only be added by one side of a trade.'); const submit = form.querySelector('.transaction-submit'); submit.disabled = true; submit.textContent = 'Sending trade…'; const trade = await api('/trade', { method: 'POST', body: JSON.stringify({ listingId: form.dataset.listing, receiverId: form.dataset.receiver, conversationId: form.dataset.conversation || undefined, senderListingIds, receiverListingIds, senderCashAmount, receiverCashAmount, offerDetails: String(fields.get('offerDetails') || ''), shippingAddress: String(fields.get('shippingAddress') || ''), deliveryProvider: String(fields.get('deliveryProvider') || ''), deliveryMiles: fields.get('deliveryMiles'), packagingCost: fields.get('packagingCost'), paymentMethod: String(fields.get('paymentMethod') || '') }) }); if (form.dataset.conversation) await openConversation(form.dataset.conversation); else await openTradeChat(trade.id); return; }
    const tradeDelivery = form.matches('.trade-delivery-form'); if (tradeDelivery) { const fields = new FormData(form); await api(`/trade/${form.dataset.trade}`, { method: 'PUT', body: JSON.stringify({ status: 'accepted', deliveryPlan: { shippingAddress: String(fields.get('shippingAddress') || ''), deliveryProvider: String(fields.get('deliveryProvider') || ''), deliveryMiles: fields.get('deliveryMiles'), packagingCost: fields.get('packagingCost'), paymentMethod: String(fields.get('paymentMethod') || '') } }) }); await openTradeChat(form.dataset.trade); return; }
    const trade = form.matches('.fee-calculator[data-type="trade"]'); const purchase = form.matches('.fee-calculator[data-type="purchase"]'); if (purchase) return renderPayPalButtonForPurchase(form); modalContent.innerHTML = trade ? '<h2 class="modal-title">Trade offer sent.</h2><p class="modal-copy">Your offer is pending with the collector. A trade chat is now open for delivery details and follow-up.</p>' : '<h2 class="modal-title">Saved.</h2><p class="modal-copy">Your update was saved.</p>';
  } catch (error) { const listingForm = form.closest('.listing-form'); if (listingForm) { saveListingDraft(listingForm); const button = listingForm.querySelector('button[type="submit"], button:not([type])'); if (button) { button.disabled = false; button.textContent = 'Publish listing'; } listingForm.querySelector('.listing-submit-error')?.remove(); listingForm.querySelector('.listing-publish-bar')?.insertAdjacentHTML('beforebegin', `<p class="listing-submit-error" role="alert">${safe(error.message)}</p>`); } else showError(error); }
} });
document.addEventListener('submit', event => { const form = event.target.closest('[data-auction-bid-form]'); if (!form) return; event.preventDefault(); if (!session) return openAuthPanel('login'); const lot = auctions.find(row => row.id === form.dataset.auctionBidForm); const amount = Number(new FormData(form).get('amount')); if (!lot || amount < Number(lot.currentBid) + 5) { form.querySelector('input').setCustomValidity(`Enter at least ${money(Number(lot?.currentBid || 0) + 5)}.`); form.reportValidity(); return; } form.querySelector('input').setCustomValidity(''); lot.currentBid = amount; lot.bids = Number(lot.bids) + 1; auctionActivity.unshift({ lotId: lot.id, initials: String(session.user.username).slice(0, 2).toUpperCase(), name: `@${session.user.username}`, amount, time: 'Just now' }); renderFilteredAuctionHouse(); const panel = document.querySelector('.auction-price'); panel?.classList.add('bid-confirmed'); setTimeout(() => panel?.classList.remove('bid-confirmed'), 1200); });
document.addEventListener('input', event => { if (event.target.closest('.listing-form')) saveListingDraft(event.target.closest('.listing-form')); if (event.target.closest('.fee-calculator')) updateFeeSummary(); if (event.target.matches('#shipping-zip')) { clearTimeout(checkoutAddressTimer); checkoutAddressTimer = setTimeout(() => calculateCheckoutDeliveryFromAddress(event.target), 500); } if (event.target.closest('.trade-builder-form')) { if (event.target.matches('[name="senderCashAmount"], [name="receiverCashAmount"]')) syncTradeCashInput(event.target); updateTradeSelectionCounts(); } if (event.target.matches('[name="imageUrls"]')) syncListingPreview(); if (event.target.matches('[data-comment-composer]')) { const count = event.target.closest('.comment-form')?.querySelector('[data-comment-count]'); if (count) count.textContent = `${event.target.value.length} / 1000`; } if (event.target.matches('[data-comment-emoji-search]')) { const host = event.target.closest('.comment-emoji-host'); if (host) { host.innerHTML = renderCommentEmojiPicker(event.target.value); host.querySelector('[data-comment-emoji-search]')?.focus(); } } });
document.addEventListener('change', event => { if (event.target.closest('.listing-form')) saveListingDraft(event.target.closest('.listing-form')); if (event.target.closest('.trade-builder-form')) updateTradeSelectionCounts(); });
document.addEventListener('focusin', event => { if (event.target.matches('input[name="courier"]')) enableCarrierPicker(event.target); });
document.addEventListener('change', async event => { if (!event.target.matches('[name="imageFiles"], [name="videoFiles"]')) return; try { if (event.target.name === 'imageFiles') await prepareListingFiles(event.target.files); else await prepareListingVideo(event.target.files); } catch (error) { event.target.value = ''; if (event.target.name === 'imageFiles') uploadedListingImages = []; else uploadedListingVideos = []; syncListingPreview(); showError(error); } });
document.addEventListener('keydown', event => { if (!event.target.matches('[data-listing-tag-entry]')) return; if (event.key !== 'Enter' && event.key !== ',') return; event.preventDefault(); commitListingTagEntry(event.target.closest('.listing-form')); });
document.addEventListener('blur', event => { if (event.target.matches('[data-listing-tag-entry]')) commitListingTagEntry(event.target.closest('.listing-form')); }, true);
document.addEventListener('click', event => { const remove = event.target.closest('[data-listing-tag-remove]'); if (!remove) return; const form = remove.closest('.listing-form'); const input = form?.querySelector('[name="tags"]'); if (!input) return; const value = String(remove.dataset.listingTagRemove || '').toLowerCase(); input.value = listingTagValues(form).filter(tag => tag.toLowerCase() !== value).join(', '); renderListingTagChips(form); saveListingDraft(form); });
document.addEventListener('click', event => { const toggle = event.target.closest('[data-lobby-song-toggle]'); if (toggle) { const audio = toggle.closest('.profile-lobby-song')?.querySelector('[data-lobby-song]'); if (!audio) return; (audio.paused ? audio.play() : Promise.resolve(audio.pause())).catch(showError); return; } const remove = event.target.closest('[data-lobby-song-remove]'); if (remove) { const form = remove.closest('.profile-form'); const input = form?.querySelector('[name="lobbySong"]'); const status = form?.querySelector('[data-lobby-song-status]'); if (input) input.value = ''; if (status) status.textContent = 'Lobby song will be removed when you save.'; return; } });
document.addEventListener('paste', async event => { const form = event.target.closest?.('.listing-form'); if (!form) return; const images = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/')); if (!images.length) return; event.preventDefault(); try { await prepareListingFiles(images, true); } catch (error) { showError(error); } });
document.addEventListener('paste', async event => { const form = event.target.closest?.('.profile-form'); if (!form) return; const song = [...(event.clipboardData?.files || [])].find(file => file.type === 'audio/mpeg' || file.type === 'audio/mp3' || /\.mp3$/i.test(file.name)); if (!song) return; event.preventDefault(); try { const input = form.querySelector('[name="lobbySong"]'); const status = form.querySelector('[data-lobby-song-status]'); if (input) input.value = await readLobbySong(song); if (status) status.textContent = `${song.name || 'MP3'} ready to save.`; } catch (error) { showError(error); } });
document.addEventListener('click', async event => { const link = event.target.closest('[data-copy-url]'); if (!link) return; event.preventDefault(); const url = link.dataset.copyUrl; try { await navigator.clipboard.writeText(url); const original = link.textContent; link.textContent = 'URL copied'; link.setAttribute('aria-label', 'URL copied to clipboard'); setTimeout(() => { link.textContent = original; link.setAttribute('aria-label', 'Copy CollectorMarketplace.net URL'); }, 1400); } catch { link.title = `Copy this URL: ${url}`; } });
window.addEventListener('pagehide', () => { voiceChat.leave(); stopAuctionWaterfall(); });

const auctionLotTags = lot => [lot.category, ...(Array.isArray(lot.tags) ? lot.tags : [])].filter(Boolean).map(tag => tag.toLowerCase());
const filteredAuctions = () => auctions.filter(lot => {
  const lotTags = auctionLotTags(lot);
  const typedTags = searchedTagTerms();
  const matches = terms => !terms.length || (tagMatchMode === 'all' ? terms.every(term => lotTags.some(tag => tag.includes(term))) : terms.some(term => lotTags.some(tag => tag.includes(term))));
  const searchable = `${lot.title} ${lot.description || ''} ${lotTags.join(' ')}`.toLowerCase();
  return (activeCategory === 'All' || lot.category === activeCategory || lotTags.includes(activeCategory.toLowerCase())) && searchable.includes(activeQuery.toLowerCase()) && matches(activeTags) && matches(typedTags) && lockedTags.every(tag => lotTags.some(lotTag => lotTag.includes(tag))) && !voidTags.some(tag => lotTags.some(lotTag => lotTag.includes(tag)));
});
const renderTaggedAuctionHouse = () => {
  if (observer) observer.disconnect();
  sentinel.hidden = true;
  const lots = filteredAuctions();
  stream.innerHTML = `<section class="auction-house"><header class="auction-head"><div><p>Live bidding</p><h1>Auction House</h1></div><p>${lots.length} matching lot${lots.length === 1 ? '' : 's'} open now</p></header>${lots.length ? `<div class="auction-grid">${lots.map(lot => `<article class="auction-card"><img src="${safe(lot.image)}" alt="${safe(lot.title)}"><div class="auction-info"><h2>${safe(lot.title)}</h2><p>${safe(lot.category)}</p><div class="auction-stats"><div>Current bid<strong>${money(lot.currentBid)}</strong></div><div>Ends in<strong>${safe(lot.ends)}</strong></div><div>${lot.bids} bids</div></div><button class="auction-bid" data-bid="${lot.id}">Place bid</button></div></article>`).join('')}</div>` : '<p class="load-state">No active auction lots match those tags. Try removing a tag or choose ANY matching.</p>'}</section>`;
  mountAuctionBlocks();
  syncAuctionWaterfallControl();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
let auctionTagView = false;
const renderFilteredAuctionHouse = () => {
  const visibleLots = filteredAuctions();
  if (!visibleLots.length) { stream.innerHTML = '<section class="auction-house"><header class="auction-head"><div><p>Live bidding floor</p><h1>Auction House</h1></div></header><p class="load-state">No active auction lots match those tags. Try removing a tag or choose ANY matching.</p></section>'; return; }
  const allLots = auctions;
  auctions = visibleLots;
  if (!visibleLots.some(lot => lot.id === activeAuctionId)) activeAuctionId = visibleLots[0].id;
  renderAuctionHouse();
  auctions = allLots;
};
showAuctionHouse = () => { auctionTagView = true; if (observer) observer.disconnect(); clearInterval(auctionClock); sentinel.hidden = true; document.body.classList.remove('app-section-mode', 'app-section-chat', 'app-section-account'); document.body.classList.add('auction-mode'); startAuctionWaterfall(); syncBrowseModeUi(); renderFilteredAuctionHouse(); auctionClock = setInterval(updateAuctionClocks, 1000); startAuctionFeed(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
const renderAuctionWorkspace = showAuctionHouse;
showAuctionHouse = () => {
  beginWorkspaceRoute('auction');
  document.body.classList.remove('app-section-listing', 'app-section-membership', 'listing-page');
  return renderAuctionWorkspace();
};
const refreshTaggedAuction = () => { if (auctionTagView) renderFilteredAuctionHouse(); };
document.addEventListener('click', event => {
  if (event.target.closest('[data-home], [data-market]')) auctionTagView = false;
  if (event.target.closest('[data-tag], [data-category], [data-tag-match]')) queueMicrotask(refreshTaggedAuction);
});
document.addEventListener('pointerover', event => { if (event.target.closest('.auction-house')) pauseAuctionFeed(12000); });
document.addEventListener('focusin', event => { if (event.target.closest('.auction-house')) pauseAuctionFeed(20000); });
stream.addEventListener('wheel', event => { if (browseMode !== 'conveyor' || !document.body.classList.contains('browse-conveyor') || document.body.classList.contains('app-section-mode') || document.body.classList.contains('auction-mode')) return; event.preventDefault(); stream.scrollLeft += event.deltaY || event.deltaX; }, { passive: false });
tagSearch.addEventListener('input', () => setTimeout(refreshTaggedAuction, 160));
tagSearch.addEventListener('keydown', event => { if (event.key === 'Enter') setTimeout(refreshTaggedAuction, 0); });

async function loadMarket() {
  const listingData = await fetch('/listings').then(response => { if (!response.ok) throw new Error('Listings API unavailable'); return response.json(); });
  listings = listingData.filter(listing => listing.listingMode !== 'auction_only').map(asFeedListing).sort((a, b) => a.id === 'mantle' ? -1 : b.id === 'mantle' ? 1 : 0);
  renderTags();
  renderCategories();
  // Data refreshes can happen from checkout, account tools, and page games.
  // Never replace an active full-page workspace with the browsing feed.
  if (!document.body.classList.contains('app-section-mode') && !document.body.classList.contains('auction-mode') && !modal.open) renderFeed();
}
async function handlePayPalCheckoutResult() {
  const params = new URLSearchParams(location.search); const result = params.get('paypal'); const deliveryId = params.get('delivery');
  if (!result) return;
  history.replaceState({}, '', `${location.pathname}${location.hash}`);
  if (result === 'sandbox-success' && deliveryId && session) { await loadDeliveries(); await loadMarket(); await openDelivery(deliveryId); return; }
  if (result === 'sandbox-cancelled') return openModal('PayPal Sandbox checkout cancelled', 'No Sandbox payment was captured, and the listing is available again.');
  openModal('PayPal Sandbox checkout needs attention', 'The checkout could not be completed. No payment was captured. Please return to the listing and try again.');
}
async function handleGoogleLoginResult() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('google_token');
  if (!token) {
    if (location.hash === '#google-auth-error') { history.replaceState({}, '', `${location.pathname}${location.search}`); openModal('Google sign-in could not continue', 'Please try again. If this keeps happening, ask the site owner to verify the Google OAuth settings.'); }
    return;
  }
  params.delete('google_token');
  params.delete('google_login');
  history.replaceState({}, '', `${location.pathname}${location.search}${params.toString() ? `#${params}` : ''}`);
  const response = await fetch(`/user/${encodeURIComponent(token)}`);
  if (!response.ok) return openModal('Google sign-in could not continue', 'Your Google account was verified, but the marketplace session could not be created. Please try again.');
  const user = await response.json();
  saveSession({ token, user });
  await loadDeliveries();
  openAccountPanel();
}
Promise.all([loadMarket(), Promise.all([fetch('data/auctions.json').then(response => response.json()), fetch('/auctions').then(response => response.ok ? response.json() : [])]), fetch('/users').then(response => response.ok ? response.json() : []), fetch('/collectives').then(response => response.ok ? response.json() : []), fetch('/brands').then(response => response.ok ? response.json() : []), fetch('/couriers').then(response => response.ok ? response.json() : []), fetch('/chatrooms').then(response => response.ok ? response.json() : [])]).then(async ([, [featuredLots, userLots], accountDirectory, collectiveDirectory, brandDirectory, courierDirectory, chatroomDirectory]) => { accounts = accountDirectory; collectives = collectiveDirectory; brands = brandDirectory; couriers = courierDirectory; chatrooms = chatroomDirectory; auctions = [...featuredLots, ...userLots].map(lot => { const [hours = 0, minutes = 0, seconds = 0] = String(lot.ends || '').split(':').map(Number); const configuredEnd = lot.endAt ? new Date(lot.endAt).valueOf() : 0; return { ...lot, endAt: lot.auctionEndless ? Infinity : Number.isFinite(configuredEnd) && configuredEnd > Date.now() ? configuredEnd : Date.now() + ((hours * 3600 + minutes * 60 + seconds) * 1000) }; }); applyTagRoute(); applyHashLocation(); observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && page * 4 < filtered().length) { page++; renderFeed(false); } }, { rootMargin: '250px' }); observer.observe(sentinel); await handlePayPalCheckoutResult(); await handleGoogleLoginResult(); }).catch(() => { stream.innerHTML = '<p class="load-state">The marketplace feed could not load. Please refresh the page.</p>'; });
window.addEventListener('popstate', () => {
  restoringWorkspaceHistory = true;
  if (modal.open) modal.close();
  restoringWorkspaceHistory = false;
  if (!listings.length) return;
  applyTagRoute();
  applyHashLocation();
});
