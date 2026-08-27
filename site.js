const stream = document.querySelector('#listing-stream');
const search = document.querySelector('#search');
const categories = document.querySelector('#categories');
const sentinel = document.querySelector('#sentinel');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
let listings = [], activeCategory = 'All', activeQuery = '', page = 1, observer;

const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const filtered = () => listings.filter(item => (activeCategory === 'All' || item.category === activeCategory) && `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(activeQuery.toLowerCase()));
const card = item => `<article class="listing"><header class="collector-head"><b>J</b><div><strong>@JohnDoe <em>CURATOR</em></strong><small>★★★★★ <i>(312)</i></small></div><time>2h ago ···</time></header><div class="listing-main"><button class="media" data-detail="${item.id}"><img src="${safe(item.image)}" alt="${safe(item.title)}"><span class="grade">${safe(item.category)}</span></button><section class="listing-copy"><h2>${safe(item.title)}</h2><div class="meta">JAMES CO. SHIPPING COMPANY</div><p><b>@JohnDoe ★★★★★ (5.0)</b><br>This is my favorite card ever!<br>Please buy more...</p><footer><button class="price" data-purchase="${item.id}">BUY ${item.price}$</button><button class="trade" data-trade="${item.id}">TRADE</button><button class="like" aria-label="Like ${safe(item.title)}">♡</button></footer></section></div></article>`;

function renderCategories() { const types = ['All', ...new Set(listings.map(item => item.category))]; categories.innerHTML = types.map(type => `<button class="${type === activeCategory ? 'active' : ''}" data-category="${safe(type)}">${safe(type)}</button>`).join(''); }
function renderFeed(reset = true) { const rows = filtered(); if (reset) page = 1; stream.innerHTML = rows.slice(0, page * 4).map(card).join('') || '<p class="load-state">No collector finds match that search.</p>'; document.querySelector('#result-count').textContent = `${rows.length} listed`; sentinel.textContent = page * 4 < rows.length ? 'Scroll for more finds ↓' : 'You are all caught up.'; }
function openModal(title, copy, form) { modalContent.innerHTML = `<h2 class="modal-title">${title}</h2><p class="modal-copy">${copy}</p>${form || ''}`; modal.showModal(); }
function money(value) { return `$${Number(value).toFixed(2)}`; }
function feeCalculator(item, type) {
  const trade = type === 'trade';
  const fields = trade ? `<label>Your trade valuation<input id="buyer-value" type="number" min="0" value="${item.price}"></label><label>Other side’s valuation<input id="seller-value" type="number" min="0" value="${item.price}"></label>` : `<label>Item price<input id="buyer-value" type="number" min="0" value="${item.price}"></label><label>Estimated buyer tax<input id="tax" type="number" min="0" value="0"></label><label>Courier packaging cost<input id="packaging" type="number" min="0" value="0"></label>`;
  return `<div class="fee-calculator" data-type="${type}">${fields}<label class="check"><input id="buyer-curator" type="checkbox"> Buyer has Curator membership ($150/month)</label><label class="check"><input id="seller-curator" type="checkbox"> Seller has Curator membership ($150/month)</label><div id="fee-summary" class="fee-summary"></div><p class="policy-note">Policy draft: payments and transaction fees apply only to completed purchases. Buyers pay taxes and shipping. Courier delivery pay is the greater of $15 or 0.5% of the valuation, plus documented packaging costs. Delivery, fraud, and enforcement rules require legal review before launch.</p></div>`;
}
function updateFeeSummary() {
  const box = document.querySelector('.fee-calculator'); if (!box) return;
  const type = box.dataset.type; const buyerValue = Number(document.querySelector('#buyer-value')?.value || 0); const sellerValue = Number(document.querySelector('#seller-value')?.value || buyerValue); const buyerRate = document.querySelector('#buyer-curator').checked ? .01 : .04; const sellerRate = document.querySelector('#seller-curator').checked ? .01 : .04; const tax = Number(document.querySelector('#tax')?.value || 0); const packaging = Number(document.querySelector('#packaging')?.value || 0); const courier = Math.max(15, buyerValue * .005) + packaging;
  document.querySelector('#fee-summary').innerHTML = type === 'trade' ? `<b>Trade valuation estimate</b><span>Buyer-side fee (${buyerRate * 100}%): ${money(buyerValue * buyerRate)}</span><span>Other-side fee (${sellerRate * 100}%): ${money(sellerValue * sellerRate)}</span><strong>Total valuation fees: ${money(buyerValue * buyerRate + sellerValue * sellerRate)}</strong>` : `<b>Purchase estimate</b><span>Buyer marketplace fee (${buyerRate * 100}%): ${money(buyerValue * buyerRate)}</span><span>Seller marketplace fee (${sellerRate * 100}%): ${money(buyerValue * sellerRate)}</span><span>Buyer tax: ${money(tax)} · Buyer shipping/courier: ${money(courier)}</span><strong>Buyer due: ${money(buyerValue + buyerValue * buyerRate + tax + courier)}</strong><strong>Seller fee: ${money(buyerValue * sellerRate)}</strong>`;
}
function setQuery(query) { activeQuery = query; search.value = query; document.querySelector('#clear-tags').hidden = !query; document.querySelectorAll('[data-query]').forEach(button => button.classList.toggle('active', button.dataset.query === query)); renderFeed(); }
function activateNav(name) { document.querySelectorAll('.bottom-nav button').forEach(button => button.classList.toggle('active', button.matches(`[data-${name}]`))); }

document.addEventListener('click', event => {
  const tag = event.target.closest('[data-query]'); const category = event.target.closest('[data-category]'); const detail = event.target.closest('[data-detail]'); const trade = event.target.closest('[data-trade]'); const action = event.target.closest('[data-home],[data-market],[data-chat],[data-sell]');
  if (tag) setQuery(tag.dataset.query);
  if (category) { activeCategory = category.dataset.category; renderCategories(); renderFeed(); }
  if (detail) { const item = listings.find(row => row.id === detail.dataset.detail); openModal(item.title, item.description, `<div class="modal-form"><button data-trade="${item.id}">Make a trade offer</button></div>`); }
  if (trade) { const item = listings.find(row => row.id === trade.dataset.trade); openModal(`Trade for ${item.title}`, 'Each side is shown its own valuation fee. Curator pricing applies only to the member’s side.', feeCalculator(item, 'trade')); updateFeeSummary(); }
  const purchase = event.target.closest('[data-purchase]'); if (purchase) { const item = listings.find(row => row.id === purchase.dataset.purchase); openModal(`Buy ${item.title}`, 'Both buyer and seller pay their own marketplace fee. Your purchase will open delivery chat for follow-up and confirmation.', feeCalculator(item, 'purchase')); updateFeeSummary(); }
  if (action?.matches('[data-sell]')) { activateNav('sell'); openModal('List an item', 'Create your collector profile to publish listings and accept trade offers.', '<form class="modal-form"><input required placeholder="Your email"><button>Join the marketplace</button></form>'); }
  if (action?.matches('[data-chat]')) { activateNav('chat'); openModal('Collector chat', 'Your conversations and trade updates will appear here once you join the marketplace.'); }
  if (event.target.closest('.like')) { const like = event.target.closest('.like'); like.textContent = like.textContent === '♡' ? '♥' : '♡'; like.classList.toggle('liked'); }
  if (action?.matches('[data-market],[data-home]')) { activateNav(action.matches('[data-market]') ? 'market' : 'home'); activeCategory = 'All'; setQuery(''); renderCategories(); renderFeed(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (event.target.matches('.close')) modal.close();
});
search.addEventListener('input', event => setQuery(event.target.value));
document.querySelector('#clear-tags').addEventListener('click', () => setQuery(''));
document.querySelector('#search-tab').addEventListener('click', () => { search.closest('.discovery').scrollIntoView({ behavior: 'smooth', block: 'center' }); search.focus(); });
document.querySelector('#tags-tab').addEventListener('click', () => document.querySelector('#tags').scrollIntoView({ behavior: 'smooth', block: 'center' }));
modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
document.addEventListener('submit', event => { if (event.target.closest('#modal')) { event.preventDefault(); modalContent.innerHTML = '<h2 class="modal-title">You’re on the list.</h2><p class="modal-copy">Thanks for your interest. Collector Marketplace will be ready for your listing or trade details soon.</p>'; } });
document.addEventListener('input', event => { if (event.target.closest('.fee-calculator')) updateFeeSummary(); });

fetch('data/listings.json').then(response => response.json()).then(data => { listings = data.sort((a, b) => a.id === 'mantle' ? -1 : b.id === 'mantle' ? 1 : 0); renderCategories(); renderFeed(); observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && page * 4 < filtered().length) { page++; renderFeed(false); } }, { rootMargin: '250px' }); observer.observe(sentinel); }).catch(() => { stream.innerHTML = '<p class="load-state">The marketplace feed could not load. Please refresh the page.</p>'; });
