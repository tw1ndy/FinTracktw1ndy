# FinTracktw1ndy — Security Audit

Updated: 2026-11-11. Scope: current `fix/nextjs-project-structure` branch and the connected Supabase/Vercel project. This is a source/configuration review plus direct database configuration checks; it is **not** a penetration test or a completed end-to-end acceptance test.

## Verified controls

| Area | Result | Evidence / limits |
|---|---|---|
| Authentication | Implemented in code | Supabase Auth signup, login, session refresh, logout, and password reset routes. Live registration/login still untested. |
| Session cookies | Implemented in code | HttpOnly, SameSite=Lax, Secure in production. Invalid sessions clear cookies. Logout revokes the local session only. |
| CSRF | Implemented in code | Mutating API routes require the exact request Origin and use SameSite=Lax cookies. Must be rechecked on the final public hostname. |
| Database isolation | Verified in connected database | RLS enabled and FORCE RLS enabled on profiles, accounts, transactions, budgets, goals. anon has no SELECT privilege; authenticated has SELECT. |
| RLS policies | Verified in connected database | Each table has authenticated-only owner policy using auth.uid(). Supabase security advisor currently reports no security lints. |
| Transaction/account relation | Implemented in schema | Composite foreign key (account_id,user_id) prevents cross-user account references. |
| Input validation | Implemented in code | Amount/currency/type/text/date validation; goal deadlines now validate real calendar dates. |
| FX rates | Implemented in code | Server-side provider route, request timeout, rate validation, and rejection of rates older than 48 hours. |
| Security headers | Configured | CSP, HSTS in production, X-Content-Type-Options, frame protection, Referrer-Policy, Permissions-Policy. Live headers still need verification. |
| Dependency audit | Added to CI | CI now runs npm audit --audit-level=high after dependency installation. Current result is pending. |

## Current connected environment

- Supabase project URL matches the Vercel production environment variable.
- Five application tables exist; all are empty.
- The Supabase Auth user count is currently zero. Therefore no real registration, login, CRUD, or two-user RLS test has yet been run.
- GitHub Actions run #140 passed install, typecheck, static security smoke checks, and production build. Later hardening commits have their own CI run pending.
- The most recent historical Vercel build failed on an outdated commit because app/page.tsx omitted required accountId. The current branch includes the correction.
- New Vercel deployment requests are currently blocked by the team's 24-hour deployment quota. No successful production deployment is confirmed.
- Vercel project Node.js runtime is configured to 22.x.

## Remaining launch blockers

1. Wait for the Vercel deployment quota to reset, then deploy the current branch and verify the public production URL.
2. Create two dedicated test users and configure the six GitHub Actions integration secrets/variable; run the Supabase two-user isolation test.
3. Test registration, email confirmation, login, session refresh, logout, password reset, and full CRUD against the deployed site.
4. Add a shared distributed rate limiter. The current in-memory limiter is best-effort only and is not shared across Vercel instances.
5. Generate and commit package-lock.json so dependency installation is reproducible; review the new npm audit result.
6. Scan the complete Git history for accidentally committed secrets. Rotate any credentials found.
7. Verify production CSP/HSTS/cookies and forbidden paths; add centralized monitoring, alerts, backup/restore drills, privacy policy, and terms before public commercial use.

## Product limitations

- No bank/Open Banking synchronization. Account starting balances and goal progress are entered manually.
- No payment processing or subscription billing.
- FX rates are daily reference rates, not bank execution quotes.
- This project must not be marketed as a verified banking balance or financial advice product.

## Release status

**Not production-ready yet.** CI code checks and database RLS configuration are in place, but live deployment, user acceptance, two-user isolation, backup/restore, and operational controls remain unverified.