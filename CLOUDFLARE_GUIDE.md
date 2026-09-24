# 🚀 Інструкція: Розгортання LifeSync на Cloudflare Pages + Cloudflare D1

Цей посібник допоможе вам підключити базу даних, налаштувати реєстрацію/авторизацію, підключити Google Workspace та опублікувати додаток на хостингу **Cloudflare** безкоштовно та швидко.

---

## 🏗️ 1. Архітектура проекту

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 (знаходиться в `src/`).
- **Edge Backend API**: Cloudflare Pages Functions (знаходиться в `functions/api/`).
- **Database (БД)**: **Cloudflare D1** — швидка Serverless SQLite база даних з нульовою затримкою.
- **Local-First стійкість**: Додаток зберігає дані локально та синхронізує їх із Cloudflare D1. Тобто він працюватиме 100% стабільно навіть без інтернету або до підключення БД.
- **Маршрутизація SPA**: У `public/_redirects` налаштовано перенаправлення `/* /index.html 200`, що захищає від помилки 404 при оновленні сторінки.

---

## ⚡ 2. Швидкий старт локально

1. Відкрийте термінал у папці фронтенду:
   ```bash
   cd D:\.fq\фронт
   ```
2. Встановіть залежності (вже встановлено):
   ```bash
   npm install
   ```
3. Запустіть сервер розробки:
   ```bash
   npm run dev
   ```
4. Відкрийте посилання у браузері: `http://localhost:5173`.
   - Доступні дві вкладки: **Вхід** та **Реєстрація**.
   - Доступний **Швидкий демо-вхід** в 1 клік.

---

## 🗄️ 3. Створення та підключення бази даних Cloudflare D1

Cloudflare D1 — це рідна безкоштовна база даних Cloudflare (5 млн читань та 100 тис записів на добу безкоштовно).

### Крок 3.1: Вхід у Cloudflare через термінал
Якщо у вас ще не встановлено Wrangler, встановіть його та авторизуйтесь:
```bash
npx wrangler login
```
*(У браузері відкриється сторінка Cloudflare для підтвердження входу).*

### Крок 3.2: Створення бази даних D1
Виконайте команду:
```bash
npx wrangler d1 create lifesync-db
```
У відповідь термінал виведе приблизно такий текст:
```toml
[[d1_databases]]
binding = "DB"
database_name = "lifesync-db"
database_id = "xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Крок 3.3: Оновлення wrangler.toml
Відкрийте файл `wrangler.toml` у проекті та замініть `database_id` на отриманий ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "lifesync-db"
database_id = "ваш-отриманий-database-id"
```

### Крок 3.4: Застосування схеми таблиць (schema.sql)
У корені проекту вже підготовлено готовий файл `schema.sql` з усіма таблицями (користувачі, паролі, таски, фінанси, звички, події, Google Docs).

Виконайте команду для створення таблиць у хмарі:
```bash
npx wrangler d1 execute lifesync-db --remote --file=./schema.sql
```
*(Для локального тестування можна запустити без `--remote`: `npx wrangler d1 execute lifesync-db --local --file=./schema.sql`).*

---

## 🌐 4. Розгортання (Деплой) на Cloudflare Pages

### Спосіб А: Прямий деплой через термінал (Найшвидший — 1 хвилина)

1. Зберіть проект у папку `dist`:
   ```bash
   npm run build
   ```
2. Опублікуйте на Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name lifesync-app
   ```
3. Після публікації перейдіть у **Cloudflare Dashboard** -> **Workers & Pages** -> **lifesync-app** -> **Settings** -> **Functions** -> **D1 database bindings**:
   - Натисніть **Add binding**.
   - **Variable name**: `DB`
   - **D1 database**: оберіть вашу базу `lifesync-db`.
   - Натисніть **Save**.

---

### Спосіб Б: Через GitHub / GitLab (Автодеплой на кожен git push)

1. Створіть новий репозиторій на GitHub і запуште туди проект:
   ```bash
   git init
   git add .
   git commit -m "feat: complete lifesync app ready for cloudflare"
   git branch -M main
   git remote add origin https://github.com/ВАШ_АККАУНТ/lifesync.git
   git push -u origin main
   ```
2. Відкрийте [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Compute (Workers & Pages)** -> **Create application** -> вкладка **Pages** -> **Connect to Git**.
3. Оберіть ваш репозиторій.
4. Налаштування збірки (Build settings):
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (або `фронт`, якщо папка всередині монорепозиторію)
5. Натисніть **Save and Deploy**.
6. Прив'яжіть базу D1:
   - Після першого деплою відкрийте **Settings** проекту -> **Functions** -> **D1 database bindings** -> натисніть **Add binding**.
   - **Variable name**: обов'язково вкажіть `DB`
   - **D1 database**: оберіть `lifesync-db`.
   - Збережіть і натисніть **Retry deployment** у вкладці Deployments.

---

## 🔑 5. Налаштування Google Workspace OAuth 2.0

Щоб користувачі могли авторизуватися через свій Google акаунт та синхронізувати календар:

1. Перейдіть у [Google Cloud Console](https://console.cloud.google.com/).
2. Створіть новий проект (наприклад, `LifeSync App`).
3. Перейдіть у розділ **APIs & Services** -> **OAuth consent screen**:
   - Оберіть **External** (Зовнішній).
   - Заповніть назву додатку (`LifeSync`) та контактний email.
   - У розділі **Scopes** додайте:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `.../auth/calendar.readonly` (для читання Google Calendar)
   - Якщо додаток у статусі "Testing", додайте свій Google Email у список **Test users**.
4. Перейдіть у **Credentials** -> **Create Credentials** -> **OAuth Client ID**:
   - **Application type**: `Web application`.
   - **Name**: `LifeSync Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (для локальної перевірки)
     - `https://lifesync-app.pages.dev` (ваша адреса на Cloudflare Pages)
     - `https://ваш-домен.com` (якщо підключите власний домен)
5. Скопіюйте отриманий **Client ID** (вигляду `xxxxxxxxxx.apps.googleusercontent.com`).
6. Підключення в проекті:
   - **Варіант 1 (Рекомендований для продакшну)**: У Cloudflare Pages Dashboard перейдіть у **Settings** -> **Environment variables** -> додайте змінну:
     - Змінна: `VITE_GOOGLE_CLIENT_ID`
     - Значення: ваш Google Client ID.
   - **Варіант 2**: Введіть його безпосередньо у налаштуваннях самого додатку у вкладці **Інтеграції** -> **Google Workspace**.

---

## 🐱 6. Підключення Monobank API

1. Відкрийте [api.monobank.ua](https://api.monobank.ua/) та відскануйте QR-код через додаток Monobank.
2. Скопіюйте згенерований персональний API токен.
3. У LifeSync відкрийте **⚙️ Налаштування** -> **Інтеграції** -> вставте токен у поле **Monobank API**.
4. Натисніть кнопку **Тест** — система зв'яжеться з сервером через проксі `functions/api/monobank.ts` (без блокувань CORS браузером) та відобразить ім'я власника картки.

---

## 📁 7. Склад готових файлів для Cloudflare у проекті

| Файл / Папка | Призначення |
| :--- | :--- |
| `schema.sql` | Повна структура таблиць для бази даних Cloudflare D1 |
| `wrangler.toml` | Конфігурація для Cloudflare CLI, Pages та прив'язки D1 |
| `public/_redirects` | Правило `/* /index.html 200` для SPA маршрутизації |
| `public/_headers` | Заголовки безпеки (X-Frame-Options, Content-Type, CORS) |
| `functions/api/auth/register.ts` | Edge-функція реєстрації користувачів у D1 |
| `functions/api/auth/login.ts` | Edge-функція авторизації користувачів |
| `functions/api/sync.ts` | Edge-функція двосторонньої синхронізації тасків, звичок, фінансів |
| `functions/api/monobank.ts` | Безпечний проксі для Monobank API без CORS |
| `src/services/storage.ts` | Local-First двигун збереження та експорту в JSON |
| `src/services/api.ts` | Клієнт для зв'язку з Cloudflare API та резервного сховища |
| `src/services/google.ts` | Інтеграція Google Identity Services OAuth 2.0 |
