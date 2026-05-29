# TIMES — Telegram'дан автоматик тўлдириладиган янгиликлар сайти

Интерфейси **ўзбек тилида (кирилл)** замонавий янгиликлар портали. У публик
Telegram-канал [@times_officialuz](https://t.me/times_officialuz) дан постларни
автоматик равишда юклаб, уларни категориялар, қидирув, қоронғи мавзу ва тўлиқ матн
ойнаси билан лента кўринишида намойиш этади.

> Изоҳ: интерфейс (тугмалар, навигация, категориялар, изоҳлар) ўзбекча кириллда.
> Постлар матни эса каналда қандай бўлса — шундайлигича (русча) кўрсатилади.

## Как это работает

- `server/scraper.js` — парсит публичную страницу превью канала `https://t.me/s/times_officialuz`
  (официальный Telegram API и токены **не нужны**). Извлекает текст, фото, дату, просмотры,
  ссылку и автоматически проставляет категорию по ключевым словам.
- `server/server.js` — Express-сервер. Отдаёт фронтенд из `public/`, предоставляет API
  `GET /api/news`, кэширует результат в `server/news.json` и обновляет его каждые 5 минут.
- `public/` — фронтенд (HTML/CSS/JS, без сборки). Каждые 5 минут сам перезапрашивает `/api/news`.

## Структура

```
times-news/
├── public/          # фронтенд
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server/
│   ├── server.js    # Express + API + автообновление
│   ├── scraper.js   # парсер Telegram
│   └── news.json    # кэш постов (создаётся автоматически)
├── package.json
├── Dockerfile
└── render.yaml
```

## Локальный запуск

```bash
npm install
npm start
# открыть http://localhost:3000
```

Разово спарсить и сохранить новости вручную: `npm run scrape`

## Переменные окружения

| Переменная    | По умолчанию       | Описание                          |
|---------------|--------------------|-----------------------------------|
| `PORT`        | `3000`             | порт сервера                      |
| `TG_CHANNEL`  | `times_officialuz` | имя канала (без @)                |
| `REFRESH_MIN` | `5`                | интервал обновления в минутах     |

---

## Пошаговый план деплоя

### Вариант A — Render.com (бесплатно, проще всего)

1. Создай аккаунт на https://render.com и подключи GitHub.
2. Залей этот проект в репозиторий GitHub:
   ```bash
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/USERNAME/times-news.git
   git push -u origin main
   ```
3. На Render → **New → Web Service** → выбери свой репозиторий.
4. Render автоматически прочитает `render.yaml`. Если нет — задай вручную:
   - **Build Command:** `npm install`
   - **Start Command:** `node server/server.js`
   - **Environment:** Node
5. Нажми **Create Web Service**. Через 1–2 минуты сайт будет на
   `https://times-news.onrender.com`. Лента заполнится автоматически.

> На бесплатном плане Render сервис «засыпает» без трафика — первый запрос после паузы
> грузится ~30 сек. Кэш `news.json` сохраняется между обновлениями.

### Вариант B — Railway.app

1. https://railway.app → **New Project → Deploy from GitHub repo**.
2. Railway сам определит Node. Start Command: `node server/server.js`.
3. В разделе **Variables** при желании добавь `REFRESH_MIN=5`.
4. Открой сгенерированный публичный URL.

### Вариант C — свой VPS (Ubuntu)

```bash
# на сервере
sudo apt update && sudo apt install -y nodejs npm
git clone https://github.com/USERNAME/times-news.git
cd times-news
npm install
npm install -g pm2
pm2 start server/server.js --name times-news
pm2 save && pm2 startup    # автозапуск после ребута
```
Настрой Nginx как реверс-прокси на `localhost:3000` и подключи домен + SSL (certbot).

### Вариант D — Docker

```bash
docker build -t times-news .
docker run -d -p 3000:3000 --name times-news times-news
```

---

## Важно про парсинг

Парсер использует **публичную** страницу превью канала (`t.me/s/...`), которая доступна
только если канал публичный. Это законный способ чтения открытого контента, но соблюдай:

- не превышай разумную частоту запросов (5 мин — безопасно);
- весь контент принадлежит авторам канала — указывай источник (в футере уже стоит ссылка);
- если канал станет приватным или Telegram изменит вёрстку превью — поправь селекторы
  в `server/scraper.js`.
