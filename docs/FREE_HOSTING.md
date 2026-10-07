# LifeSync: бесплатный сервер для 5–10 человек

Весь сайт, API, PostgreSQL и фоновые задания работают на Oracle VM. ПК владельца можно выключить. Cloudflare используется для бесплатного Turnstile; бесплатный адрес выдаёт DuckDNS, HTTPS — Caddy. Neon и Cloudflare Workers для этой схемы не нужны.

**Условия, а не гарантия:** Oracle Always Free может быть недоступен в выбранном регионе и может отозвать простаивающую VM. Бесплатные лимиты и правила могут измениться. Always Free A1 на дату проверки: всего 2 OCPU, 12 GB RAM, 200 GB boot/block storage; выбирайте домашний регион и только ресурсы с пометкой Always Free. Регистрация может потребовать карту для проверки. Не включайте платное повышение аккаунта/ресурсы. Не создавайте искусственную нагрузку ради обхода правил. [Официальные условия Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## Запуск только через браузер

Откройте Oracle Cloud Shell, создайте SSH-ключ и VM Ubuntu 24.04 (ARM A1, 2 OCPU / 12 GB / 50 GB boot). Сохраните SSH-ключ, разрешите SSH только с IP своей Cloud Shell; TCP 80/443 разрешите для посетителей. Подключитесь `ssh ubuntu@PUBLIC_IP` с выбранным ключом. Дальнейшие команды выполняются **внутри VM**.

Создайте бесплатный адрес на [DuckDNS](https://www.duckdns.org/), укажите публичный IP VM. Для этой инструкции адрес должен вести прямо на VM: не включайте Cloudflare proxy без изменения доверенных прокси Caddy.

Установите Docker Engine и Compose plugin для Ubuntu по [официальной инструкции](https://docs.docker.com/engine/install/ubuntu/), включите `sudo systemctl enable --now docker`. Клонируйте свой репозиторий:

```bash
git clone https://github.com/avncode69/LifeSync.git
cd LifeSync
```

Если репозиторий приватный, создайте на VM SSH deploy key, добавьте его в GitHub Settings → Deploy keys с правом чтения и клонируйте по SSH. Не вставляйте токен в URL.

Создайте Turnstile widget для своего DuckDNS hostname. В Gmail включите двухэтапную проверку и создайте [пароль приложения](https://support.google.com/accounts/answer/185833). Затем:

```bash
sudo docker run --rm -it -v "$PWD:/workspace" -w /workspace node:24-bookworm-slim node infra/oracle/setup.mjs
cd infra/oracle
sudo docker compose build
sudo docker compose run --rm migrate
sudo docker compose up -d db api web jobs backup caddy
sudo docker compose ps
```

Setup сохраняет `.env` с правами 600, генерирует ключи авторизации, шифрования Google, VAPID, БД и копий; не выводит секреты. Он не перезаписывает существующие ключи. Сервис web не получает секреты API. Наружу опубликованы только порты Caddy 80/443. Caddy получает сертификат после успешного DNS и доступности портов.

Зарегистрируйтесь на HTTPS-сайте, подтвердите почту. Для первого администратора:

```bash
sudo docker compose run --rm -e ADMIN_BOOTSTRAP_EMAIL=your@gmail.com api pnpm admin:bootstrap
```

Внешние интеграции требуют собственных ключей. В `sudo nano .env` заполните Google OAuth (login callback `/api/auth/callback/google`), Workspace OAuth (callback `/api/v1/integrations/google/callback`), Picker API/app ID и Gemini API key. Используйте точные callback из интерфейса/документации интеграции, совпадающий HTTPS-домен, настройте consent и доступ пользователей. Testing в Google может ограничивать срок refresh token; учитывайте это при постоянной синхронизации. Gemini бесплатен только в пределах доступной для аккаунта/региона квоты, поэтому бесконечный бесплатный AI не гарантируется. Не подключайте billing для сохранения строгого бюджета. Подробнее [SMTP.md](SMTP.md) и существующая документация Google в репозитории.

После изменения `.env`:

```bash
sudo docker compose up -d --force-recreate api jobs
```

Фоновый процесс выполняет цикл каждые пять минут после завершения предыдущего, блокировка PostgreSQL предотвращает параллельные циклы. Автоперезапуск применяется к контейнерам; unhealthy требует проверки оператора и не означает, что Docker сам перезапустит контейнер.

## Проверки и обслуживание

Проверьте регистрацию/письмо/вход/восстановление пароля, создание и редактирование данных каждым пользователем, изоляцию пользователей, повторяющиеся задачи, push после разрешения браузера, Google и AI после подключения ключей. Откройте сайт с телефона и выключенным домашним ПК. Проверяйте `sudo docker compose ps` и `sudo docker compose logs --tail=100 api jobs backup caddy`; не публикуйте дампы конфигурации или логи с приватными данными.

Для обновления: в корне репозитория `git pull --ff-only`, затем в `infra/oracle` выполнить `sudo docker compose build`, `sudo docker compose run --rm migrate`, `sudo docker compose up -d db api web jobs backup caddy`. Перед обновлением сохраните свежую копию и ключ расшифровки. Не выполняйте `docker compose down -v`: это удаляет БД.

Backup делает зашифрованный pg_dump сразу и каждые 24 часа, хранит примерно 14 дней в `infra/oracle/backups`. SHA256 рядом позволяет проверить целостность скачанного файла. Копии на той же VM не защищают от удаления VM/диска: регулярно переносите `.enc` + `.sha256` в Oracle Object Storage Always Free (сверьте лимит) либо собственное облако. **Отдельно сохраните BACKUP_PASSPHRASE** в менеджере паролей. После потери `.env` копии без ключа не восстановить.

Восстановление требует остановки приложения и заменяет данные. На VM в `infra/oracle`, сначала проверьте checksum и сделайте текущую копию. Выберите точный файл вместо примера:

```bash
sudo docker compose stop api web jobs backup
sudo docker compose run --rm --no-deps --entrypoint bash backup -c 'set -o pipefail; openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in /backups/EXACT.dump.enc | pg_restore --clean --if-exists --no-owner --exit-on-error -h db -U lifesync -d lifesync'
sudo docker compose up -d db api web jobs backup caddy
```

Не меняйте POSTGRES_PASSWORD в `.env` у существующей БД без соответствующего SQL изменения пароля. При смене домена обновите APP_HOST/APP_URL/BETTER_AUTH_URL, Turnstile и Google callbacks.

Проверено 2026-10-07: 23 suites / 133 tests, API TypeScript (включая scripts), нормальная web production build с внутренним адресом API, синтаксис setup, генерация AES/VAPID и защита от перезаписи конфигурации. YAML прочитан и проверены сервисы/порты/изоляция web environment; это не запуск Compose. Независимый review исправил Google callback.

Реальный Docker/ARM/Oracle/SMTP/SSL deployment и восстановление PostgreSQL требуют запуска на вашем аккаунте; Docker на рабочем ПК отсутствует. Этот документ не утверждает, что сервер уже развёрнут.
