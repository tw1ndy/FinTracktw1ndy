import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const helper = read("lib/server-supabase.ts");
const login = read("app/api/auth/login/route.ts");
const logout = read("app/api/auth/logout/route.ts");
const goals = read("app/api/goals/route.ts");
const page = read("app/page.tsx");
const tx = read("app/api/transactions/route.ts");
const accounts = read("app/api/accounts/route.ts");
const budgets = read("app/api/budgets/route.ts");
const goals = read("app/api/goals/route.ts");
const fx = read("app/api/fx/route.ts");
const sql = read("supabase/security-hardening.sql");
const ignore = read(".gitignore");
const config = read("next.config.mjs");

assert.ok(helper.includes("HttpOnly"));
assert.ok(helper.includes("SameSite=Lax"));
assert.ok(helper.includes('NODE_ENV === "production" ? "; Secure"'));
assert.ok(helper.includes("origin !== expected"));
assert.ok(login.includes("signInWithPassword"));
assert.ok(login.includes("allowRequest"));
assert.ok(logout.includes('scope: "local"'));
assert.ok(goals.includes("isValidDate"));
assert.ok(goals.includes("goals-delete"));
assert.ok(accounts.includes("accounts-delete"));
assert.ok(budgets.includes("budgets-delete"));
assert.ok(tx.includes("Array.isArray(row.accounts)"));
assert.ok(tx.includes("Array.isArray(data.accounts)"));
assert.ok((tx.match(/allowRequest\(`tx:/g) || []).length >= 3);
assert.ok(tx.includes("auth.getUser(access)"));
assert.ok(tx.includes("user_id: session.user.id"));
assert.ok(tx.includes("account_id: account.id"));
assert.ok(tx.includes("accounts(name)"));
assert.ok(!tx.includes("account_name"));
assert.ok(tx.includes("Number.isFinite(amount)"));
assert.ok(tx.includes("export async function PATCH"));
assert.ok(tx.includes("export async function DELETE"));
assert.ok(accounts.includes("export async function PATCH"));
assert.ok(accounts.includes("export async function DELETE"));
assert.ok(budgets.includes(".upsert("));
assert.ok(budgets.includes("export async function DELETE"));
assert.ok(goals.includes("export async function PATCH"));
assert.ok(goals.includes("export async function DELETE"));
assert.ok(fx.includes("open.er-api.com"));
assert.match(sql, /force row level security/i);
assert.match(sql, /to authenticated/i);
assert.ok(ignore.includes(".env"));
assert.ok(config.includes("Content-Security-Policy"));
assert.ok(!page.includes("localStorage.setItem") && !page.includes("useStored"));
assert.ok(!tx.includes("client_id"));
assert.ok(!goals.includes("client_id"));
assert.equal(existsSync(new URL("../app/api/migrate/route.ts", import.meta.url)), false);
assert.ok(existsSync(new URL("../supabase/migrations/20261111_account_id.sql", import.meta.url)));
assert.ok(!existsSync(new URL("../schema.sql", import.meta.url)));
assert.ok(!existsSync(new URL("../types.ts", import.meta.url)));
assert.ok(!existsSync(new URL("../app/api/auth/update-password/route.ts", import.meta.url)));
assert.ok(read("supabase/migrations/20261111_account_id.sql").includes("transactions_account_id_user_id_fkey"));

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
