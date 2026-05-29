// server.js — отдаёт статику + API /api/news. Кэширует посты, обновляет по таймеру.
const express = require('express');
const path = require('path');
const fs = require('fs');
const { scrape } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;
const REFRESH_MS = (process.env.REFRESH_MIN ? Number(process.env.REFRESH_MIN) : 5) * 60 * 1000;
const CACHE_FILE = path.join(__dirname, 'news.json');

let cache = { channel: '', updatedAt: null, count: 0, posts: [] };

// загрузить кэш с диска при старте (чтобы сайт не был пустым)
try {
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[cache] загружено ${cache.count} постов с диска`);
  }
} catch (e) {
  console.warn('[cache] не удалось прочитать кэш:', e.message);
}

async function refresh() {
  try {
    const data = await scrape();
    if (data.posts.length) {
      cache = data;
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
      console.log(`[refresh] обновлено: ${data.count} постов в ${data.updatedAt}`);
    } else {
      console.warn('[refresh] получено 0 постов, оставляю старый кэш');
    }
  } catch (e) {
    console.error('[refresh] ошибка:', e.message);
  }
}

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/news', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(cache);
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
