// app.js — загрузка ленты, фильтры, поиск, модалка, тема, автообновление.
const PAGE = 9;
let allPosts = [];
let filtered = [];
let shown = 0;
let activeCat = 'Барчаси';
let query = '';

const $ = (s) => document.querySelector(s);
const feed = $('#feed');
const heroEl = $('#hero');

const ICONS = {
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>',
  x: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), s = Math.floor((now - d) / 1000);
  if (s < 60) return 'ҳозиргина';
  const m = Math.floor(s / 60); if (m < 60) return `${m} дақиқа олдин`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} соат олдин`;
  const days = Math.floor(h / 24); if (days < 7) return `${days} кун олдин`;
  const months = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function metaHTML(p) {
  let h = `<span>${ICONS.clock}${timeAgo(p.date)}</span>`;
  if (p.views) h += `<span>${ICONS.eye}${esc(p.views)}</span>`;
  return `<div class="meta">${h}</div>`;
}

function renderHero(p) {
  if (!p) { heroEl.innerHTML = ''; return; }
  const img = p.image
    ? `<div class="hero-img" style="background-image:url('${p.image}')"></div>`
    : `<div class="hero-img"></div>`;
  heroEl.innerHTML = `<div class="hero-card" data-id="${p.id}">
    ${img}
    <div class="hero-body">
      <span class="cat">${esc(p.category)}</span>
      <h1>${esc(p.title)}</h1>
      <p>${esc(p.excerpt)}</p>
      ${metaHTML(p)}
    </div>
  </div>`;
  heroEl.querySelector('.hero-card').onclick = () => openModal(p.id);
}

function cardHTML(p) {
  const img = p.image
    ? `<div class="card-img" style="background-image:url('${p.image}')"></div>`
    : `<div class="card-img empty">${ICONS.photo}</div>`;
  const pin = p.pinned ? `<span class="pin-badge">📌 Қадаланган</span>` : '';
  return `<article class="card${p.pinned ? ' is-pinned' : ''}" data-id="${p.id}">
    ${img}
    <div class="card-body">
      <span class="cat">${esc(p.category)}${pin}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
      ${metaHTML(p)}
    </div>
  </article>`;
}

function renderFeed(reset) {
  if (reset) { feed.innerHTML = ''; shown = 0; }
  const slice = filtered.slice(shown, shown + PAGE);
  feed.insertAdjacentHTML('beforeend', slice.map(cardHTML).join(''));
  shown += slice.length;
  feed.querySelectorAll('.card').forEach((c) => {
    if (!c._b) { c._b = 1; c.onclick = () => openModal(c.dataset.id); }
  });
  $('#loadMore').hidden = shown >= filtered.length;
  if (!filtered.length) feed.innerHTML = `<p class="status">Ҳеч нарса топилмади.</p>`;
}

function applyFilter() {
  let list = allPosts;
  if (activeCat !== 'Барчаси') list = list.filter((p) => p.category === activeCat);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((p) => (p.text || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q));
  }
  // hero фақат филтрсиз
  if (activeCat === 'Барчаси' && !query && list.length) {
    renderHero(list[0]);
    filtered = list.slice(1);
  } else {
    renderHero(null);
    filtered = list;
  }
  renderFeed(true);
}

function buildNav() {
  const cats = ['Барчаси', ...new Set(allPosts.map((p) => p.category))];
  const nav = $('#nav');
  nav.innerHTML = cats.map((c) => `<button data-cat="${c}"${c === 'Барчаси' ? ' class="active"' : ''}>${c}</button>`).join('');
  nav.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      nav.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      activeCat = b.dataset.cat;
      applyFilter();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
}

function openModal(id) {
  const p = allPosts.find((x) => String(x.id) === String(id));
  if (!p) return;
  const img = p.image ? `<div class="modal-img" style="background-image:url('${p.image}')"></div>` : '';
  const link = p.url ? `<a class="modal-link" href="${p.url}" target="_blank" rel="noopener">Telegram'да очиш ${ICONS.ext}</a>` : '';
  $('#modalCard').innerHTML = `
    <button class="modal-close" id="mc">${ICONS.x}</button>
    ${img}
    <div class="modal-content">
      <span class="cat">${esc(p.category)}</span>
      <h1>${esc(p.title)}</h1>
      ${metaHTML(p)}
      <div class="modal-text">${esc(p.text)}</div>
      ${link}
    </div>`;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#mc').onclick = closeModal;
}
function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }
$('#modalBackdrop').onclick = closeModal;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// поиск
$('#searchBtn').onclick = () => {
  const bar = $('#searchBar');
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) $('#searchInput').focus();
};
let st;
$('#searchInput').oninput = (e) => {
  clearTimeout(st);
  st = setTimeout(() => { query = e.target.value.trim(); applyFilter(); }, 250);
};

// тема
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('times-theme', t); } catch (e) {}
}
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
};
(function initTheme() {
  let t = 'light';
  try { t = localStorage.getItem('times-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'); } catch (e) {}
  setTheme(t);
})();

$('#loadMore').onclick = () => renderFeed(false);
$('#year').textContent = new Date().getFullYear();

function showSkeletons() {
  feed.innerHTML = Array.from({ length: 6 }).map(() =>
    `<div class="skeleton shimmer"><div class="sk-img"></div><div class="sk-line"></div><div class="sk-line short"></div></div>`
  ).join('');
}

async function load() {
  showSkeletons();
  try {
    const r = await fetch('/api/news', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    allPosts = data.posts || [];
    if (!allPosts.length) {
      $('#status').textContent = 'Лента ҳозирча бўш — маълумотлар юкланмоқда. Бир дақиқадан сўнг саҳифани янгиланг.';
      feed.innerHTML = '';
      return;
    }
    $('#status').textContent = '';
    $('#updated').textContent = data.updatedAt ? 'Янгиланди: ' + timeAgo(data.updatedAt) : '';
    buildNav();
    applyFilter();
  } catch (e) {
    $('#status').className = 'status error';
    $('#status').textContent = 'Янгиликларни юклаб бўлмади: ' + e.message;
    feed.innerHTML = '';
  }
}

load();
setInterval(load, 5 * 60 * 1000); // автообновление каждые 5 минут
