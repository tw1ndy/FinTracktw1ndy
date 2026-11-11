import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const emailA = process.env.SUPABASE_TEST_USER_A_EMAIL;
const passwordA = process.env.SUPABASE_TEST_USER_A_PASSWORD;
const emailB = process.env.SUPABASE_TEST_USER_B_EMAIL;
const passwordB = process.env.SUPABASE_TEST_USER_B_PASSWORD;
for (const [name, value] of Object.entries({ url, anon, emailA, passwordA, emailB, passwordB })) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

async function signedInClient(email, password) {
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error(`Test login failed for ${email}: ${error?.message || "no session"}`);
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
  });
  return { auth, client, user: data.user };
}

const a = await signedInClient(emailA, passwordA);
const b = await signedInClient(emailB, passwordB);
const suffix = randomUUID();
const ids = {};
const today = new Date().toISOString().slice(0, 10);

try {
  const fixtures = [
    ["accounts", { user_id: a.user.id, client_id: `rls-${suffix}`, name: `RLS test ${suffix}`, balance: 12.34, currency: "EUR" }],
    ["transactions", { user_id: a.user.id, client_id: `rls-${suffix}`, title: "RLS test", amount: 1, currency: "EUR", type: "expense", category: "Другое", tx_date: today, account_name: "RLS test" }],
    ["budgets", { user_id: a.user.id, category: `RLS-${suffix}`, amount_limit: 100, currency: "EUR" }],
    ["goals", { user_id: a.user.id, client_id: `rls-${suffix}`, title: `RLS test ${suffix}`, target: 100, saved: 10, currency: "EUR" }]
  ];

  for (const [table, row] of fixtures) {
    const { data, error } = await a.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`User A insert failed for ${table}: ${error.message}`);
    ids[table] = data.id;

    const { data: hidden, error: readError } = await b.client.from(table).select("id").eq("id", data.id);
    if (readError) throw new Error(`User B read check failed for ${table}: ${readError.message}`);
    assert.equal(hidden.length, 0, `RLS leak: user B can read user A's ${table} row`);

    const { data: changed, error: updateError } = await b.client.from(table)
      .update(table === "accounts" ? { balance: 999 } : table === "goals" ? { saved: 99 } : {})
      .eq("id", data.id).select("id");
    if (updateError) throw new Error(`User B update check failed for ${table}: ${updateError.message}`);
    assert.equal(changed.length, 0, `RLS leak: user B can update user A's ${table} row`);

    const { data: visible, error: ownReadError } = await a.client.from(table).select("id").eq("id", data.id);
    if (ownReadError) throw new Error(`User A read failed for ${table}: ${ownReadError.message}`);
    assert.equal(visible.length, 1, `User A cannot read own ${table} row`);
  }
  console.log("Supabase RLS integration checks passed for accounts, transactions, budgets, and goals.");
} finally {
  for (const [table, id] of Object.entries(ids)) {
    await a.client.from(table).delete().eq("id", id).eq("user_id", a.user.id);
  }
  await Promise.all([a.auth.auth.signOut(), b.auth.auth.signOut()]);
}
