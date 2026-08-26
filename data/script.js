async function loadItem() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id'));

  const res = await fetch('data/listings.json');
  const items = await res.json();

  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('item-name').textContent = item.name;
  document.getElementById('item-img').src = `images/${item.image}`;
  document.getElementById('item-info').innerHTML = `
    <p><strong>Category:</strong> ${item.category}</p>
    <p><strong>Condition:</strong> ${item.condition}</p>
    <p><strong>Price:</strong> $${item.price}</p>
    <p><strong>Description:</strong> ${item.description}</p>
  `;
}

loadItem();
