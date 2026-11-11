# FinTracktw1ndy 2.0

Тёмный мультивалютный финансовый кабинет на Next.js 14.

## Что уже реализовано
- Адаптивный dashboard с тёмным интерфейсом.
- Операции доходов и расходов с валютой, категорией, датой и счётом, связанным по уникальному `account_id`.
- Счета, бюджеты и цели накоплений.
- График денежного потока и экспорт операций в CSV.
- Мультивалютный пересчёт баланса.
- Получение справочных FX-курсов через ExchangeRate-API Open Access endpoint; обновление в интерфейсе каждый час.
- Supabase Auth UI и SQL-схема с Row Level Security.
- Все финансовые данные хранятся только в Supabase; локальное хранилище браузера не используется.

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
2. Для **нового проекта** откройте SQL Editor и выполните `supabase/schema.sql`, затем `supabase/security-hardening.sql`. Для уже существующей базы с колонкой `transactions.account_name` сначала сделайте резервную копию и выполните миграцию `supabase/migrations/20261111_account_id.sql`, затем `supabase/security-hardening.sql`. Миграция связывает операции со счетами по уникальному совпадению имени; если найдутся непривязанные или неоднозначные операции, она остановится и откатит изменения. Такие записи нужно исправить до повторного запуска. Не запускайте миграцию поверх новой схемы.
3. В Project Settings → API скопируйте Project URL и anon/public key.
4. Заполните `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

5. Перезапустите `npm run dev`.

### Проверка изоляции Supabase
Создайте два отдельных тестовых пользователя в Supabase Auth. Добавьте эти значения в `.env.local` рядом с уже указанными `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Не коммитьте этот файл и не отправляйте пароли в чат:

```env
SUPABASE_TEST_USER_A_EMAIL=...
SUPABASE_TEST_USER_A_PASSWORD=...
SUPABASE_TEST_USER_B_EMAIL=...
SUPABASE_TEST_USER_B_PASSWORD=...
```

Затем выполните `npm run test:supabase` (нужен Node.js 20.6+). Скрипт создаёт временные записи от первого пользователя и проверяет, что второй не может их читать или изменять; тестовые записи удаляются в конце. Запускайте только на тестовом проекте/тестовых аккаунтах. Для автоматического запуска в GitHub Actions добавьте в Settings → Secrets and variables → Actions переменную `RUN_SUPABASE_INTEGRATION=true` и шесть секретов с теми же именами, что выше (включая URL и anon key). Пароли тестовых пользователей должны принадлежать только тестовым аккаунтам.

6. В Supabase → Authentication → URL Configuration укажите URL сайта и добавьте redirect URL `https://ВАШ-ДОМЕН/auth/confirm?next=/reset-password` (для локальной разработки также `http://localhost:3000/auth/confirm?next=/reset-password`).
7. В шаблоне письма восстановления пароля используйте ссылку с `token_hash`: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`. Для подтверждения регистрации аналогично используйте `type=signup` и `next=/`.

**Только облако:** вход обязателен для создания и изменения финансовых данных. Операции, счета, бюджеты и цели читаются и записываются только через Supabase с Row Level Security. Гостевого режима и локального сохранения нет. При запуске удаляются старые ключи приложения `ft2_*` и `ft3_*` из браузерного хранилища; новые финансовые записи в браузер не записываются. Не используйте приложение как единственное место хранения финансовых данных без резервной копии.

## Курсы валют
Курсы запрашиваются серверным маршрутом `/api/fx` у ExchangeRate-API Open Access (`https://open.er-api.com/v6/latest/{BASE}`). Это реальные справочные межбанковские курсы провайдера с ежедневным обновлением, не биржевой тикер и не гарантированный курс покупки/продажи банка. Время последнего и следующего обновления приходит от поставщика. При ошибке приложение показывает ошибку и не подставляет выдуманные значения. Сверяйте дату обновления, доступность валют и условия провайдера перед коммерческим использованием.

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

## Financial data behavior
- Transactions support cloud create, edit, and delete operations.
- Accounts, budgets, and savings goals are managed through authenticated API routes; rows are scoped to the signed-in user by Supabase RLS.
- An account's stored `balance` is its starting balance. Transactions reference accounts by immutable `account_id` with a database-level composite foreign key that enforces matching ownership. The displayed balance is recalculated from that amount plus/minus linked income and expense transactions. Transactions in another currency are converted using the currently loaded reference rates; if a required rate is unavailable, the derived balance is shown as unavailable rather than guessed.
- Accounts with linked transactions cannot be deleted until those transactions are removed or moved.
- Starting account balances and savings-goal progress are entered manually by the user. There is no bank/Open Banking connection in this build; these values are not independently verified against a bank statement.
- The dashboard and charts include only records loaded from the signed-in Supabase account. Empty periods are not filled with fabricated chart values. Missing account links and missing FX rates make derived totals unavailable instead of guessing.
