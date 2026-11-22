const map = L.map('real-map', { zoomControl: false }).setView([14.8378, 120.2842], 15);
const markers = L.layerGroup().addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
let places = [];
let selected = null;
const $ = selector => document.querySelector(selector);
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function stateName(value) {
  if (value === 'Available') return ['Available', 'state-available'];
  if (value === 'Unavailable') return ['Unavailable', 'state-unavailable'];
  if (value === 'Not Applicable') return ['Not Applicable', 'state-na'];
  return ['Not Verified', 'state-unverified'];
}

function showAccess(place) {
  const panel = $('#accessibility-list');
  const card = $('#destination-detail');
  if (!place) {
    panel.classList.add('access-empty');
    panel.textContent = 'Select a destination marker to view its reported accessibility features.';
    card.classList.add('is-empty');
    $('#destination-image').hidden = true;
    return;
  }
  panel.classList.remove('access-empty');
  card.classList.remove('is-empty');
  const features = place.features || {};
  const rows = [
    ['Elevator', features.Elevator || 'Not Applicable'],
    ['Restroom', features['Accessible restroom'] || features.Restroom || 'Unverified'],
    ['Handrails', features.Handrails || 'Unverified'],
    ['Parking', features.Parking || 'Unverified'],
    ['Priority Seating', features['Priority Seating'] || 'Unverified'],
    ['Wheelchair Ramp', features.Ramp || 'Unverified'],
    ['High-Contrast Signage', features['High-Contrast Signage'] || 'Unverified'],
    ['Braille/Tactile Indicators', features['Braille/Tactile Indicators'] || 'Unverified']
  ];
  panel.innerHTML = rows.map(([name, value]) => {
    const [label, className] = stateName(value);
    return `<div class="access-row"><strong class="access-state ${className}">${safe(label)}</strong><span class="access-name">${safe(name)}</span></div>`;
  }).join('');
  $('#place-name').textContent = place.name || 'Destination';
  $('#place-kind').textContent = place.category || 'Establishment';
  $('#place-address').textContent = place.area || 'Olongapo City, Zambales';
  $('#place-hours').textContent = place.hours || 'Hours not verified';
  $('#place-description').textContent = place.description || place.notes || '';
  const photos = [
    [/rizal triangle|rizal park/i, '/assets/rizal-detail.png'],
    [/marikit/i, '/assets/marikit-park.png'],
    [/sm city/i, '/assets/sm-city-card.png']
  ];
  const photo = place.image ? [null, place.image] : photos.find(([pattern]) => pattern.test(place.name || ''));
  $('.destination-placeholder span').textContent = photo ? '' : 'No photo is available for this destination yet.';
  $('#destination-image').hidden = !photo;
  if (photo) {
    $('#destination-image').src = photo[1];
    $('#destination-image').alt = `Photo of ${place.name}`;
  }
}

function render() {
  const query = $('#search').value.trim().toLowerCase();
  const category = $('#category').value;
  const terms = {
    healthcare: /health|hospital|clinic|medical/i,
    schools: /school|university|college|education/i,
    hotels: /hotel|lodging|inn/i,
    shopping: /mall|shop|market|retail/i,
    restaurants: /food|drink|restaurant|cafe|café|dining/i,
    government: /government|public service|city hall|office/i,
    others: /leisure|park|other|recreation/i
  };
  const shown = places.filter(place => (!query || `${place.name} ${place.area} ${place.category}`.toLowerCase().includes(query)) && (category === 'all' || terms[category]?.test(`${place.name} ${place.category} ${place.area}`)));
  markers.clearLayers();
  shown.forEach(place => L.marker([Number(place.lat), Number(place.lng)]).addTo(markers).on('click', () => { selected = place; showAccess(place); renderCards(shown); }).bindPopup(safe(place.name)));
  renderCards(shown);
  if (selected && !shown.some(place => place.id === selected.id)) { selected = null; showAccess(null); }
}

function renderCards(items) {
  const holder = $('#location-cards');
  if (!holder) return;
  holder.innerHTML = items.length ? items.map(place => {
    const knownPhoto = /rizal triangle|rizal park/i.test(place.name) ? '/assets/rizal-detail.png' : /marikit/i.test(place.name) ? '/assets/marikit-park.png' : /sm city/i.test(place.name) ? '/assets/sm-city-card.png' : '';
    const photo = place.image || knownPhoto;
    const available = Object.values(place.features || {}).filter(value => value === 'Available').length;
    return `<button type="button" class="location-card ${selected?.id === place.id ? 'selected' : ''}" data-place-id="${safe(place.id)}"><span class="location-card-photo">${photo ? `<img src="${safe(photo)}" alt="">` : '<span class="location-photo-placeholder" aria-hidden="true">⌖</span>'}</span><span class="location-card-body"><strong>${safe(place.name)}</strong><span class="location-card-meta">${safe(place.category)} · ${safe(place.area)}</span><span class="location-card-hours">${safe(place.hours || 'Hours not verified')}</span><span class="location-card-desc">${safe(place.description || place.notes || '')}</span><span class="location-card-count">${available} features reported available</span></span></button>`;
  }).join('') : '<p class="cards-empty">No destinations match the current search or category.</p>';
  holder.querySelectorAll('[data-place-id]').forEach(card => card.addEventListener('click', () => {
    const place = items.find(item => String(item.id) === card.dataset.placeId);
    if (!place) return;
    selected = place;
    showAccess(place);
    map.setView([Number(place.lat), Number(place.lng)], 17);
    renderCards(items);
  }));
}

$('#search-form').addEventListener('submit', event => { event.preventDefault(); render(); });
$('#search').addEventListener('input', render);
$('#category').addEventListener('change', render);
$('#zoom-in').onclick = () => map.zoomIn();
$('#zoom-out').onclick = () => map.zoomOut();
const queryCategory = new URLSearchParams(location.search).get('category');
if (queryCategory) $('#category').value = ({ Health: 'healthcare', Shopping: 'shopping', Food: 'restaurants', Public: 'government', Hotels: 'hotels', Education: 'schools' })[queryCategory] || queryCategory.toLowerCase();

if (localStorage.getItem('openpath-theme') === 'dark') document.documentElement.dataset.theme = 'dark';
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#theme-label').textContent = dark ? 'Light Mode' : 'Dark Mode';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#253747' : '#fff9f2';
}
syncTheme();
$('#theme-toggle').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  localStorage.setItem('openpath-theme', dark ? 'dark' : 'light');
  syncTheme();
};
showAccess(null);
fetch('/api/places', { cache: 'no-store' }).then(response => response.json()).then(data => {
  places = data.filter(place => Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng)));
  const placeId = new URLSearchParams(location.search).get('place');
  selected = places.find(place => String(place.id) === placeId) || null;
  if (selected) {
    showAccess(selected);
    map.setView([Number(selected.lat), Number(selected.lng)], 17);
  }
  render();
  requestAnimationFrame(() => map.invalidateSize({ pan: false }));
}).catch(() => {});
new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(document.querySelector('.map-shell'));
