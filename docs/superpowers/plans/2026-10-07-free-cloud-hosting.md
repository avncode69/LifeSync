# Бесплатный облачный запуск LifeSync

Цель: весь сервис для 5–10 пользователей работает независимо от ПК, в пределах бесплатных квот. Выбран Oracle Always Free VM + PostgreSQL + Caddy + DuckDNS + Gmail SMTP. Непрерывная бесплатная доступность не гарантируется провайдером; реальный аккаунт/VM ещё не настроены.

1. SMTP adapter и production validation с тестами — auth/config владелец api_continue.
2. Node Docker образ и исключение секретов — web_continue.
3. Compose, HTTPS routing, последовательные фоновые задания с PostgreSQL lease, encrypted backups, private setup — root.
4. Переписать интерактивный HTML под browser Cloud Shell, доступные квоты, free services, setup/migrations/admin/integrations/recovery — web_continue.
5. Независимый review — review_continue; исправить подтверждённые замечания.
6. Проверки: unit/integration, API/typecheck, нормальная web build, setup harness, HTML Playwright; финальный diff и исключение секретов перед Git push.

Docker локально отсутствует: actual image/Compose/Caddy/restore и живые SMTP/OAuth/Oracle требуют внешней VM и учётных данных. Не заменять эту проверку утверждением о готовом deployment.
