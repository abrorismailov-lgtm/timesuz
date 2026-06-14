// server.js — статика + API /api/news + админ-API. Парсинг канала + ручные правки (overrides).
const express = require('express');
const path = require('path');
const fs = require('fs');
const { scrape } = require('./scraper');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const REFRESH_MS = (process.env.REFRESH_MIN ? Number(process.env.REFRESH_MIN) : 5) * 60 * 1000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-123';

const CACHE_FILE = path.join(__dirname, 'news.json');
const OVR_FILE = path.join(__dirname, 'overrides.json');

let cache = { channel: '', updatedAt: null, count: 0, posts: [] };
// overrides: { hidden:[id...], pinned:[id...], edits:{ id:{title,text,category} } }
let overrides = { hidden: [], pinned: [], edits: {} };

function loadJSON(file, fallback) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.warn(`[load] ${file}:`, e.message); }
  return fallback;
}
cache = loadJSON(CACHE_FILE, cache);
overrides = loadJSON(OVR_FILE, overrides);
console.log(`[start] постов в кэше: ${cache.count || 0}, правок: ${Object.keys(overrides.edits || {}).length}`);

function saveOverrides() {
  fs.writeFileSync(OVR_FILE, JSON.stringify(overrides, null, 2));
}

// Накладывает ручные правки на сырые посты канала
function applyOverrides(raw) {
  const hidden = new Set(overrides.hidden || []);
  const pinned = new Set(overrides.pinned || []);
  const edits = overrides.edits || {};
  let posts = (raw.posts || [])
    .filter((p) => !hidden.has(p.id))
    .map((p) => {
      const e = edits[p.id];
      if (!e) return p;
      return {
        ...p,
        title: e.title != null && e.title !== '' ? e.title : p.title,
        text: e.text != null && e.text !== '' ? e.text : p.text,
        excerpt: e.text != null && e.text !== '' ? e.text.slice(0, 200) : p.excerpt,
        category: e.category != null && e.category !== '' ? e.category : p.category,
        edited: true,
      };
    });
  // закреплённые — наверх, сохраняя порядок остального
  posts.sort((a, b) => (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0));
  posts = posts.map((p) => ({ ...p, pinned: pinned.has(p.id) }));
  return { ...raw, count: posts.length, posts };
}

async function refresh() {
  try {
    const data = await scrape();
    if (!data.posts.length) {
      console.warn('[refresh] получено 0 постов, оставляю архив без изменений');
      return;
    }
    // АРХИВ: сливаем свежие посты со старыми по id, ничего не теряя
    const byId = new Map((cache.posts || []).map((p) => [p.id, p]));
    let added = 0;
    for (const p of data.posts) {
      if (!byId.has(p.id)) added++;
      byId.set(p.id, p); // новый добавится, существующий обновится свежей версией
    }
    let merged = [...byId.values()];
    // сортировка: новые сверху (по дате; без даты — в конец)
    merged.sort((a, b) => {
      const ta = a.date ? Date.parse(a.date) : 0;
      const tb = b.date ? Date.parse(b.date) : 0;
      return tb - ta;
    });
    cache = {
      channel: data.channel,
      updatedAt: data.updatedAt,
      count: merged.length,
      posts: merged,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`[refresh] архив: всего ${merged.length} постов (+${added} новых) в ${data.updatedAt}`);
  } catch (e) {
    console.error('[refresh] ошибка:', e.message);
  }
}

// --- авторизация админа ---
function checkAuth(req, res, next) {
  const pass = req.get('x-admin-password') || req.query.password;
  if (pass && pass === ADMIN_PASSWORD) return next();
  res.status(401).json({ ok: false, error: 'Неверный пароль' });
}

app.use(express.static(path.join(__dirname, '..', 'public')));

// /admin без .html тоже работает
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// публичная лента — с наложенными правками
app.get('/api/news', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(applyOverrides(cache));
});

// --- админ API ---
// проверка пароля
app.post('/api/admin/login', checkAuth, (req, res) => res.json({ ok: true }));

// сырые посты канала + текущие правки (для админки)
app.get('/api/admin/posts', checkAuth, (req, res) => {
  res.json({ ok: true, posts: cache.posts || [], overrides });
});

// сохранить правки: { hidden, pinned, edits }
app.post('/api/admin/overrides', checkAuth, (req, res) => {
  const b = req.body || {};
  overrides = {
    hidden: Array.isArray(b.hidden) ? b.hidden : overrides.hidden,
    pinned: Array.isArray(b.pinned) ? b.pinned : overrides.pinned,
    edits: b.edits && typeof b.edits === 'object' ? b.edits : overrides.edits,
  };
  saveOverrides();
  res.json({ ok: true, overrides });
});

app.get('/api/refresh', async (req, res) => {
  await refresh();
  res.json({ ok: true, count: cache.count, updatedAt: cache.updatedAt });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`TIMES news server → http://localhost:${PORT}`);
  refresh();
  setInterval(refresh, REFRESH_MS);
});
