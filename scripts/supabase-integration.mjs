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
  const { data: account, error: accountError } = await a.client.from("accounts")
    .insert({ user_id: a.user.id, name: `RLS test ${suffix}`, balance: 12.34, currency: "EUR" })
    .select("id").single();
  if (accountError || !account) throw new Error(`User A account fixture failed: ${accountError?.message || "no row"}`);
  ids.accounts = account.id;

  const { data: hiddenAccount, error: accountReadError } = await b.client.from("accounts").select("id").eq("id", account.id);
  if (accountReadError) throw new Error(`User B account read check failed: ${accountReadError.message}`);
  assert.equal(hiddenAccount.length, 0, "RLS leak: user B can read user A's account");
  const { data: changedAccount, error: accountUpdateError } = await b.client.from("accounts")
    .update({ balance: 999 }).eq("id", account.id).select("id");
  if (accountUpdateError) throw new Error(`User B account update check failed: ${accountUpdateError.message}`);
  assert.equal(changedAccount.length, 0, "RLS leak: user B can update user A's account");
  const { data: visibleAccount, error: ownAccountReadError } = await a.client.from("accounts").select("id").eq("id", account.id);
  if (ownAccountReadError) throw new Error(`User A account read failed: ${ownAccountReadError.message}`);
  assert.equal(visibleAccount.length, 1, "User A cannot read own account");
  const { data: deletedAccount, error: accountDeleteError } = await b.client.from("accounts").delete().eq("id", account.id).select("id");
  if (accountDeleteError) throw new Error(`User B account delete check failed: ${accountDeleteError.message}`);
  assert.equal(deletedAccount.length, 0, "RLS leak: user B can delete user A's account");

  const fixtures = [
    ["transactions", { user_id: a.user.id, account_id: account.id, title: "RLS test", amount: 1, currency: "EUR", type: "expense", category: "Другое", tx_date: today }],
    ["budgets", { user_id: a.user.id, category: `RLS-${suffix}`, amount_limit: 100, currency: "EUR" }],
    ["goals", { user_id: a.user.id, title: `RLS test ${suffix}`, target: 100, saved: 10, currency: "EUR" }]
  ];

  for (const [table, row] of fixtures) {
    const { data, error } = await a.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`User A insert failed for ${table}: ${error.message}`);
    ids[table] = data.id;

    const { data: hidden, error: readError } = await b.client.from(table).select("id").eq("id", data.id);
    if (readError) throw new Error(`User B read check failed for ${table}: ${readError.message}`);
    assert.equal(hidden.length, 0, `RLS leak: user B can read user A's ${table} row`);

    const patch = table === "transactions" ? { title: "changed" } : table === "budgets" ? { amount_limit: 999 } : { saved: 99 };
    const { data: changed, error: updateError } = await b.client.from(table).update(patch).eq("id", data.id).select("id");
    if (updateError) throw new Error(`User B update check failed for ${table}: ${updateError.message}`);
    assert.equal(changed.length, 0, `RLS leak: user B can update user A's ${table} row`);

    const { data: visible, error: ownReadError } = await a.client.from(table).select("id").eq("id", data.id);
    if (ownReadError) throw new Error(`User A read failed for ${table}: ${ownReadError.message}`);
    assert.equal(visible.length, 1, `User A cannot read own ${table} row`);

    const { data: deleted, error: deleteError } = await b.client.from(table).delete().eq("id", data.id).select("id");
    if (deleteError) throw new Error(`User B delete check failed for ${table}: ${deleteError.message}`);
    assert.equal(deleted.length, 0, `RLS leak: user B can delete user A's ${table} row`);
  }

  const { error: crossAccountInsertError } = await b.client.from("transactions").insert({
    user_id: b.user.id, account_id: account.id, title: "Cross-user account reference",
    amount: 1, currency: "EUR", type: "expense", category: "Другое", tx_date: today
  });
  assert.ok(crossAccountInsertError, "User B must not attach a transaction to User A's account ID");

  console.log("Supabase RLS and cross-user account-reference checks passed.");
} finally {
  for (const table of ["transactions", "goals", "budgets", "accounts"]) {
    const id = ids[table];
    if (id) await a.client.from(table).delete().eq("id", id).eq("user_id", a.user.id);
  }
  await Promise.all([a.auth.auth.signOut(), b.auth.auth.signOut()]);
}
