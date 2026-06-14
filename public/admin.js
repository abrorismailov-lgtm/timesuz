// admin.js — логика бошқарув панели: кириш, постларни кўрсатиш, правкаларни сақлаш.
const $ = (s) => document.querySelector(s);
let PASSWORD = '';
let posts = [];
let ovr = { hidden: [], pinned: [], edits: {} };

const CATS = ['Асосий', 'Сиёсат', 'Иқтисод', 'Технологиялар', 'Маданият', 'Спорт'];

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

async function api(pathname, opts = {}) {
  const headers = Object.assign({ 'x-admin-password': PASSWORD }, opts.headers || {});
  if (opts.body) headers['Content-Type'] = 'application/json';
  const r = await fetch(pathname, { ...opts, headers });
  if (r.status === 401) throw new Error('401');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// --- кириш ---
$('#loginBtn').onclick = doLogin;
$('#pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  PASSWORD = $('#pass').value.trim();
  if (!PASSWORD) return;
  $('#loginStatus').textContent = 'Текширилмоқда…';
  $('#loginStatus').className = 'status';
  try {
    await api('/api/admin/login', { method: 'POST' });
    try { sessionStorage.setItem('times-admin-pass', PASSWORD); } catch (e) {}
    $('#loginView').style.display = 'none';
    $('#adminView').style.display = 'block';
    await loadPosts();
  } catch (e) {
    $('#loginStatus').className = 'status err';
    $('#loginStatus').textContent = e.message === '401' ? 'Нотўғри парол' : 'Хатолик: ' + e.message;
  }
}

// автокириш агар парол сақланган бўлса
(function tryStored() {
  let p = '';
  try { p = sessionStorage.getItem('times-admin-pass') || ''; } catch (e) {}
  if (p) { $('#pass').value = p; doLogin(); }
})();

// --- постларни юклаш ---
$('#reloadBtn').onclick = loadPosts;

async function loadPosts() {
  $('#countLine').textContent = 'Юкланмоқда…';
  const data = await api('/api/admin/posts');
  posts = data.posts || [];
  ovr = Object.assign({ hidden: [], pinned: [], edits: {} }, data.overrides || {});
  ovr.hidden = ovr.hidden || [];
  ovr.pinned = ovr.pinned || [];
  ovr.edits = ovr.edits || {};
  render();
}

function render() {
  const hidden = new Set(ovr.hidden);
  const pinned = new Set(ovr.pinned);
  $('#countLine').textContent =
    `Жами ${posts.length} та пост · яширилган ${ovr.hidden.length} · қадаланган ${ovr.pinned.length} · таҳрирланган ${Object.keys(ovr.edits).length}`;

  $('#list').innerHTML = posts.map((p) => {
    const e = ovr.edits[p.id] || {};
    const isHidden = hidden.has(p.id);
    const isPinned = pinned.has(p.id);
    const hasEdit = !!(e.title || e.text || e.category);
    const thumb = p.image
      ? `<div class="thumb" style="background-image:url('${p.image}')"></div>`
      : `<div class="thumb"></div>`;
    const badges =
      (isHidden ? '<span class="badge h">яширилган</span>' : '') +
      (isPinned ? '<span class="badge p">қадаланган</span>' : '') +
      (hasEdit ? '<span class="badge e">таҳрирланган</span>' : '');
    const catOptions = CATS.map(
      (c) => `<option value="${c}"${(e.category || p.category) === c ? ' selected' : ''}>${c}</option>`
    ).join('');

    return `<div class="post ${isHidden ? 'hidden-post' : ''}" data-id="${esc(p.id)}">
      <div class="post-head">
        ${thumb}
        <div class="post-main">
          <div class="post-title">${esc(e.title || p.title)}${badges}</div>
          <div class="post-meta">
            <span class="pill cat">${esc(e.category || p.category)}</span>
            <span>${esc(p.date ? new Date(p.date).toLocaleString('ru-RU') : '')}</span>
            ${p.views ? `<span>👁 ${esc(p.views)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="toggles">
        <label><input type="checkbox" class="cb-hide" ${isHidden ? 'checked' : ''}> Сайтда яшириш</label>
        <label><input type="checkbox" class="cb-pin" ${isPinned ? 'checked' : ''}> Юқорига қадаш</label>
        <button class="btn ghost sm toggle-edit" type="button">Таҳрирлаш</button>
      </div>
      <div class="edit-area">
        <div class="row2">
          <div>
            <label class="field">Сарлавҳа (бўш қолдирсангиз — асл)</label>
            <input type="text" class="ed-title" value="${esc(e.title || '')}" placeholder="${esc(p.title)}">
          </div>
          <div>
            <label class="field">Категория</label>
            <select class="ed-cat">${catOptions}</select>
          </div>
        </div>
        <label class="field">Матн (бўш қолдирсангиз — асл)</label>
        <textarea class="ed-text" placeholder="${esc((p.text || '').slice(0, 120))}…">${esc(e.text || '')}</textarea>
      </div>
    </div>`;
  }).join('');

  // навесим обработчики
  $('#list').querySelectorAll('.post').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('.cb-hide').onchange = (ev) => toggleSet(ovr.hidden, id, ev.target.checked);
    el.querySelector('.cb-pin').onchange = (ev) => toggleSet(ovr.pinned, id, ev.target.checked);
    el.querySelector('.toggle-edit').onclick = () =>
      el.querySelector('.edit-area').classList.toggle('open');
    const collect = () => {
      const t = el.querySelector('.ed-title').value.trim();
      const x = el.querySelector('.ed-text').value.trim();
      const c = el.querySelector('.ed-cat').value;
      const origCat = (posts.find((p) => p.id === id) || {}).category;
      const obj = {};
      if (t) obj.title = t;
      if (x) obj.text = x;
      if (c && c !== origCat) obj.category = c;
      if (Object.keys(obj).length) ovr.edits[id] = obj;
      else delete ovr.edits[id];
    };
    el.querySelector('.ed-title').oninput = collect;
    el.querySelector('.ed-text').oninput = collect;
    el.querySelector('.ed-cat').onchange = collect;
  });
}

function toggleSet(arr, id, on) {
  const i = arr.indexOf(id);
  if (on && i === -1) arr.push(id);
  if (!on && i !== -1) arr.splice(i, 1);
}

// --- сақлаш ---
$('#saveBtn').onclick = async () => {
  $('#saveStatus').className = 'status';
  $('#saveStatus').textContent = 'Сақланмоқда…';
  try {
    await api('/api/admin/overrides', { method: 'POST', body: JSON.stringify(ovr) });
    $('#saveStatus').className = 'status ok';
    $('#saveStatus').textContent = '✓ Сақланди. Сайт дарҳол янгиланади.';
    render();
    setTimeout(() => ($('#saveStatus').textContent = ''), 4000);
  } catch (e) {
    $('#saveStatus').className = 'status err';
    $('#saveStatus').textContent = 'Сақлашда хатолик: ' + e.message;
  }
};
