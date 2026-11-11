import { cookies } from "next/headers";
import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, getUserScopedClient, jsonError } from "@/lib/server-supabase";

export const runtime = "nodejs";
const currencies = new Set(["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"]);
const types = new Set(["income","expense"]);
const validDate = (value: unknown) => { if (typeof value !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false; const parsed = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; };
const numeric = (v: unknown) => typeof v === "number" && Number.isFinite(v);

async function sessionForRequest() {
  const access = cookies().get("ft_access")?.value;
  if (!access) return null;
  const auth = getSupabaseAdminlessClient();
  const { data, error } = await auth.auth.getUser(access);
  if (error || !data.user) return null;
  return { access, user: data.user };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await sessionForRequest();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allowRequest(`migration:${session.user.id}:${ip}`, 5, 60 * 60 * 1000))
      return jsonError("Слишком много попыток переноса. Попробуйте позже.", 429);

    const body = await request.json();
    const transactions = Array.isArray(body.transactions) ? body.transactions : [];
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const budgets = Array.isArray(body.budgets) ? body.budgets : [];
    const goals = Array.isArray(body.goals) ? body.goals : [];
    const total = transactions.length + accounts.length + budgets.length + goals.length;
    if (total > 2000) return jsonError("За один раз можно перенести не более 2000 записей.");
    const client = getUserScopedClient(session.access);

    const txRows = transactions.map((x: any) => {
      if (!x || typeof x.id !== "string" || !x.id || x.id.length > 100 ||
        typeof x.title !== "string" || !x.title.trim() || x.title.length > 100 ||
        !numeric(x.amount) || x.amount <= 0 || x.amount > 1_000_000_000 ||
        !currencies.has(x.currency) || !types.has(x.type) ||
        typeof x.category !== "string" || !x.category.trim() || x.category.length > 60 ||
        !validDate(x.date) || typeof x.account !== "string" || !x.account.trim() || x.account.length > 80)
        throw new Error("Некорректная операция в локальных данных.");
      return { user_id: session.user.id, client_id: x.id, title: x.title.trim(), amount: x.amount,
        currency: x.currency, type: x.type, category: x.category.trim(), tx_date: x.date,
        account_name: x.account.trim(), note: typeof x.note === "string" ? x.note.slice(0,500) : null };
    });
    const accountRows = accounts.map((x: any) => {
      if (!x || typeof x.id !== "string" || !x.id || x.id.length > 100 ||
        typeof x.name !== "string" || !x.name.trim() || x.name.length > 80 ||
        !numeric(x.balance) || Math.abs(x.balance) > 1_000_000_000 || !currencies.has(x.currency))
        throw new Error("Некорректный счёт в локальных данных.");
      return { user_id: session.user.id, client_id: x.id, name: x.name.trim(), balance: x.balance, currency: x.currency };
    });
    const budgetRows = budgets.map((x: any) => {
      if (!x || typeof x.category !== "string" || !x.category.trim() || x.category.length > 60 ||
        !numeric(x.limit) || x.limit <= 0 || x.limit > 1_000_000_000 || !currencies.has(x.currency))
        throw new Error("Некорректный бюджет в локальных данных.");
      return { user_id: session.user.id, category: x.category.trim(), amount_limit: x.limit, currency: x.currency };
    });
    const goalRows = goals.map((x: any) => {
      if (!x || typeof x.id !== "string" || !x.id || x.id.length > 100 ||
        typeof x.title !== "string" || !x.title.trim() || x.title.length > 100 ||
        !numeric(x.target) || x.target <= 0 || x.target > 1_000_000_000 ||
        !numeric(x.saved) || x.saved < 0 || x.saved > x.target || !currencies.has(x.currency) ||
        (x.deadline != null && x.deadline !== "" && !validDate(x.deadline)))
        throw new Error("Некорректная цель в локальных данных.");
      return { user_id: session.user.id, client_id: x.id, title: x.title.trim(), target: x.target,
        saved: x.saved, currency: x.currency, deadline: x.deadline || null };
    });

    const saveByStableId = async (table: "transactions" | "accounts" | "goals", rows: any[]) => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const uuidRows = rows.filter(row => uuidPattern.test(row.client_id)).map(({ client_id, ...row }) => ({ ...row, id: client_id, client_id: null }));
      const legacyRows = rows.filter(row => !uuidPattern.test(row.client_id));
      if (uuidRows.length) {
        const { error } = await client.from(table).upsert(uuidRows, { onConflict: "id" });
        if (error) return error;
      }
      if (legacyRows.length) {
        const { error } = await client.from(table).upsert(legacyRows, { onConflict: "user_id,client_id" });
        if (error) return error;
      }
      return null;
    };
    for (const [table, rows, label] of [
      ["transactions", txRows, "операции"], ["accounts", accountRows, "счета"], ["goals", goalRows, "цели"]
    ] as const) {
      if (rows.length) {
        const error = await saveByStableId(table, rows);
        if (error) return jsonError(`Не удалось перенести ${label}. Проверьте SQL-миграцию локальных данных.`, 400);
      }
    }
    if (budgetRows.length) {
      const { error } = await client.from("budgets").upsert(budgetRows, { onConflict: "user_id,category,currency", ignoreDuplicates: true });
      if (error) return jsonError("Не удалось перенести бюджеты.", 400);
    }
    return Response.json({ ok: true, imported: { transactions: txRows.length, accounts: accountRows.length, budgets: budgetRows.length, goals: goalRows.length } },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Ошибка переноса локальных данных.", 400);
  }
}
