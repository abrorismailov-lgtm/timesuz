// scraper.js — тянет публичные посты из t.me/s/<channel> и нормализует их в JSON.
// Работает без официального Telegram API: парсит публичную HTML-страницу превью канала.

const https = require('https');
const { JSDOM } = require('jsdom');

const CHANNEL = process.env.TG_CHANNEL || 'times_officialuz';
const URL = `https://t.me/s/${CHANNEL}`;

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          'Accept-Language': 'ru,en;q=0.9',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchHTML(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

// Простая категоризация по ключевым словам
function detectCategory(text) {
  const t = (text || '').toLowerCase();
  // Категория ленинг номи ўзбекча (кирилл), калит сўзлар русча — контент русча бўлгани учун
  const rules = [
    ['Сиёсат', ['президент', 'парламент', 'выбор', 'санкц', 'министр', 'закон', 'депутат', 'политик', 'правительств']],
    ['Иқтисод', ['бизнес', 'эконом', 'рынок', 'компан', 'инвест', 'банк', 'валют', 'доллар', 'нефт', 'налог', 'сум', 'цен']],
    ['Технологиялар', ['технолог', 'ai', 'искусственн', 'нейросет', 'apple', 'google', 'смартфон', 'стартап', 'илон маск', 'интернет']],
    ['Маданият', ['кино', 'фильм', 'музык', 'искусств', 'книг', 'культур', 'актёр', 'актер', 'концерт', 'театр']],
    ['Спорт', ['матч', 'футбол', 'спорт', 'чемпион', 'игрок', 'олимп', 'турнир', 'гол']],
  ];
  for (const [cat, kws] of rules) {
    if (kws.some((k) => t.includes(k))) return cat;
  }
  return 'Асосий';
}

function makeExcerpt(text, n = 160) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= n) return clean;
  return clean.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

function parsePosts(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const wrappers = [...doc.querySelectorAll('.tgme_widget_message_wrap')];
  const posts = [];

  for (const w of wrappers) {
    const msg = w.querySelector('.tgme_widget_message');
    const textEl = w.querySelector('.tgme_widget_message_text');
    // текст с сохранением переводов строк
    let text = '';
    if (textEl) {
      text = textEl.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
    }

    // ссылка на пост
    const link = w.querySelector('.tgme_widget_message_date');
    const postUrl = link ? link.getAttribute('href') : null;
    const dataPost = msg ? msg.getAttribute('data-post') : null;
    const id = dataPost || (postUrl ? postUrl.split('/').pop() : String(posts.length));

    // дата
    const timeEl = w.querySelector('time');
    const date = timeEl ? timeEl.getAttribute('datetime') : null;

    // картинка (background-image у .tgme_widget_message_photo_wrap)
    let image = null;
    const photo = w.querySelector('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb');
    if (photo) {
      const style = photo.getAttribute('style') || '';
      const m = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
      if (m) image = m[1];
    }

    // просмотры
    const viewsEl = w.querySelector('.tgme_widget_message_views');
    const views = viewsEl ? viewsEl.textContent.trim() : null;

    if (!text && !image) continue;

    posts.push({
      id,
      title: makeExcerpt(text, 90) || 'Сарлавҳасиз',
      excerpt: makeExcerpt(text, 200),
      text,
      image,
      url: postUrl,
      date,
      views,
      category: detectCategory(text),
    });
  }

  // новейшие сверху
  return posts.reverse();
}

async function scrape() {
  const html = await fetchHTML(URL);
  const posts = parsePosts(html);
  return {
    channel: CHANNEL,
    updatedAt: new Date().toISOString(),
    count: posts.length,
    posts,
  };
}

module.exports = { scrape };
