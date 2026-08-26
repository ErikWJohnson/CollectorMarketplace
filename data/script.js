async function loadListings() {
  const res = await fetch('data/listings.json');
  const items = await res.json();

  const container = document.querySelector('.item-grid');
  if (!container) return;

  container.innerHTML = items.map(item => `
    <div class="item-card">
      <img src="${item.image}" alt="${item.name}">
      <h4>${item.name}</h4>
      <p>$${item.price}</p>
    </div>
  `).join('');
}

loadListings();
