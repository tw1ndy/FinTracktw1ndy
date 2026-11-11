# FinTracktw1ndy 2.0

Тёмный мультивалютный финансовый кабинет на Next.js 14.

## Что уже реализовано
- Адаптивный dashboard с тёмным интерфейсом.
- Операции доходов и расходов с валютой, категорией, датой и счётом.
- Счета, бюджеты и цели накоплений.
- График денежного потока и экспорт операций в CSV.
- Мультивалютный пересчёт баланса.
- Получение справочных FX-курсов через ExchangeRate-API Open Access endpoint; обновление в интерфейсе каждый час.
- Supabase Auth UI и SQL-схема с Row Level Security.
- Локальное сохранение данных в браузере.

## Запуск локально
Требуется Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```
Откройте http://localhost:3000

## Облачная база и авторизация
1. Создайте проект в Supabase.
2. Откройте SQL Editor и выполните `supabase/schema.sql`, затем `supabase/security-hardening.sql`, затем `supabase/local-data-migration.sql`.
3. В Project Settings → API скопируйте Project URL и anon/public key.
4. Заполните `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

5. Перезапустите `npm run dev`.

### Проверка изоляции Supabase
Создайте два отдельных тестовых пользователя в Supabase Auth. Перед запуском задайте переменные окружения (не коммитьте их и не отправляйте в чат):

```env
SUPABASE_TEST_USER_A_EMAIL=...
SUPABASE_TEST_USER_A_PASSWORD=...
SUPABASE_TEST_USER_B_EMAIL=...
SUPABASE_TEST_USER_B_PASSWORD=...
```

Затем выполните `npm run test:supabase`. Скрипт создаёт временные записи от первого пользователя и проверяет, что второй не может их читать или изменять; тестовые записи удаляются в конце. Запускайте только на тестовом проекте/тестовых аккаунтах.

6. В Supabase → Authentication → URL Configuration укажите URL сайта и добавьте redirect URL `https://ВАШ-ДОМЕН/auth/confirm?next=/reset-password` (для локальной разработки также `http://localhost:3000/auth/confirm?next=/reset-password`).
7. В шаблоне письма восстановления пароля используйте ссылку с `token_hash`: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`. Для подтверждения регистрации аналогично используйте `type=signup` и `next=/`.

**Облачная работа:** вход/регистрация/выход и восстановление пароля идут через серверные маршруты с HttpOnly-cookie. Операции, счета, бюджеты и цели загружаются и создаются через API; счета и цели также можно обновлять. Для переноса локальных записей после входа приложение предлагает импорт. Перенос идемпотентен по ID, а исходные localStorage-записи не удаляются. Перед включением импорта обязательно выполните `supabase/local-data-migration.sql`: он добавляет ключи идемпотентности для старых локальных записей. Бюджеты с уже существующей парой категория/валюта не перезаписываются при импорте. Не используйте приложение как единственное место хранения финансовых данных без резервной копии.

## Курсы валют
Курсы загружаются из `https://open.er-api.com/v6/latest/{BASE}`. Это справочные данные провайдера, не гарантированный курс покупки/продажи банка. Доступность валют зависит от API. При ошибке приложение показывает отсутствие данных, а не выдумывает курс. Сверяйте дату обновления и условия провайдера перед коммерческим использованием.

## Публикация на Vercel
1. Загрузите проект в GitHub.
2. Импортируйте репозиторий в Vercel.
3. Добавьте переменные окружения Supabase из `.env.local` в Vercel → Settings → Environment Variables.
4. Нажмите Deploy.

После публикации сайт будет работать на инфраструктуре Vercel независимо от вашего компьютера. Для постоянного публичного сервиса настройте домен, резервное копирование, мониторинг, политику конфиденциальности и условия использования.

## Монетизация
В этой сборке нет активных платежей и автоматического выставления подписок. Можно тестировать спрос и тарифную модель, но перед подключением платежей проверьте требования провайдера, налоги, потребительское законодательство и возрастные ограничения. Не храните данные банковских карт самостоятельно.


## Security notes before production
- Cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Keep the app behind HTTPS.
- Same-origin checks protect state-changing routes. Do not enable cross-origin credentials or wildcard CORS.
- The in-process rate limiter is only a best-effort development guard and is not shared across serverless instances. Configure Supabase Auth rate limits and add a shared Redis/Upstash limiter before a public launch.
- Supabase's project API is reachable over the internet by design. RLS and least-privilege grants protect rows; configure Supabase network restrictions where your plan supports them. Never expose a `service_role` key.
- Recovery email templates must pass `token_hash` to `/auth/confirm`; otherwise the custom HttpOnly-cookie recovery flow will not complete.
- Run `npm run security:smoke` for static security smoke checks. Run `npm audit` after dependency installation and commit the generated lockfile.
