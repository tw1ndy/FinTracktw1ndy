# FinTracktw1ndy — Security Audit

Updated: 2026-11-11. Scope: current `fix/nextjs-project-structure` branch and connected Supabase/Vercel project. This is a source/configuration review and direct database configuration check; it is **not** a penetration test or complete end-to-end acceptance test.

## Verified controls

| Area | Result | Evidence / limits |
|---|---|---|
| Authentication | Implemented in code | Supabase Auth signup, login, session refresh, logout, email confirmation, and password recovery/update routes. Live flows remain untested. |
| Session cookies | Implemented in code | HttpOnly, SameSite=Lax, Secure in production; invalid sessions clear cookies; logout revokes the local session only. |
| CSRF | Implemented in code | State-changing routes require exact Origin match. |
| Database isolation | Verified in connected database | RLS enabled and FORCE RLS enabled on profiles, accounts, transactions, budgets, and goals. anon has no SELECT privilege; authenticated has SELECT. |
| RLS policies | Verified in connected database | Authenticated-only owner policies use auth.uid(). Supabase security advisor currently returns no security lints. |
| Transaction/account relation | Implemented in schema | Composite foreign key `(account_id,user_id)` prevents cross-user account references. |
| Input validation | Implemented in code | Amount/currency/type/text/date validation; goal deadlines validate real calendar dates. |
| FX rates | Implemented in code | Server-side provider route, 8-second timeout, rate validation, and rejection of rates older than 48 hours. |
| Security headers | Configured | CSP, HSTS in production, X-Content-Type-Options, frame protection, Referrer-Policy, Permissions-Policy. Live headers still need verification. |
| Dependencies | Verified in CI | Next.js 16.4.6, React 19.2.4, PostCSS 8.5.23, Recharts 3.10.1; committed package-lock.json; `npm ci` succeeds; `npm audit` reported 0 vulnerabilities. |

## Connected environment

- Vercel production environment variables contain the Supabase project URL and anon key; the URL matches the connected Supabase project.
- Supabase has five application tables; all are currently empty.
- Supabase Auth user count is zero. Real registration/login/CRUD and two-user isolation have not yet been tested.
- GitHub Actions run #250 passed `npm ci`, `npm audit`, TypeScript, static security smoke checks, and production build. The two-user integration job was skipped because test users/secrets are not configured.
- Vercel project Node.js runtime is 22.x. Preview SSO protection is enabled; production is configured to be public once a production deployment exists.
- The latest Vercel deployment is a READY **preview** built from older commit `4fcac69`; it is not the current branch head. Vercel reports `live: false`. No current production deployment is confirmed.
- Earlier Vercel deployment attempts hit the team's 24-hour deployment quota. The newest code still needs a deployment after that quota resets.

## Remaining before public launch

1. Deploy the latest branch to production and verify the production URL, headers, cookies, and core flows.
2. Create two dedicated test users and configure the GitHub Actions Supabase integration secrets/variable; run the two-user RLS test.
3. Test signup, email confirmation, login, refresh, logout, password reset/update, and full CRUD against the deployed site.
4. Add a shared distributed rate limiter. Current in-memory limits use the Vercel client IP header but are best-effort and are not shared across instances.
5. Scan the full Git history for accidentally committed secrets and rotate any credentials found.
6. Test database backup/restore and add centralized monitoring/alerts.
7. Prepare reviewed privacy policy and terms before public commercial use.

## Product limitations

- No bank/Open Banking synchronization. Account starting balances and goal progress are entered manually.
- No payment processing or subscription billing.
- FX rates are daily reference rates, not bank execution quotes.
- The product must not be marketed as a verified bank balance or financial advice service.

## Release status

**Not production-ready yet.** Source-level checks, dependency audit, reproducible install, production build, and database RLS configuration are verified. Live production deployment, user acceptance, two-user isolation, backup/restore, and operational controls remain unverified.