import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const helper = read("lib/server-supabase.ts");
const login = read("app/api/auth/login/route.ts");
const tx = read("app/api/transactions/route.ts");
const sql = read("supabase/security-hardening.sql");
const ignore = read(".gitignore");
const config = read("next.config.mjs");
assert.match(helper, /HttpOnly/);
assert.match(helper, /SameSite=Lax/);
assert.match(helper, /NODE_ENV === "production" \? "; Secure"/);
assert.match(helper, /origin !== expected/);
assert.match(login, /signInWithPassword/);
assert.match(login, /allowRequest/);
assert.match(tx, /auth\.getUser\(access\)/);
assert.match(tx, /user_id: session.user.id/);
assert.match(tx, /Number\.isFinite\(amount\)/);
assert.match(sql, /force row level security/i);
assert.match(sql, /to authenticated/i);
assert.match(ignore, /^\.env$/m);
assert.match(ignore, /^\.env\.\*$/m);
assert.match(config, /Content-Security-Policy/);
for (const p of [
  "app/page.tsx",
  "app/layout.tsx",
  "app/auth/confirm/route.ts",
  "app/reset-password/page.tsx",
  "app/api/auth/password/route.ts",
  "app/api/auth/session/route.ts",
  "lib/types.ts",
  "lib/fx.ts"
]) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `Missing ${p}`);
console.log("Security smoke checks passed (static checks only; not a penetration test).");
