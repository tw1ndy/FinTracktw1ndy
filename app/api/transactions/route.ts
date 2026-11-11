import { cookies } from "next/headers";
import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, getUserScopedClient, jsonError } from "@/lib/server-supabase";
const currencies = new Set(["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"]);
const types = new Set(["income","expense"]);
export const runtime = "nodejs";

async function getAuthenticatedUser() {
  const access = cookies().get("ft_access")?.value;
  if (!access) return null;
  const authClient = getSupabaseAdminlessClient();
  const { data, error } = await authClient.auth.getUser(access);
  if (error || !data.user) return null;
  return { access, user: data.user };
}

export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("transactions")
      .select("id,title,amount,currency,type,category,tx_date,account_id,note,accounts(name)")
      .eq("user_id", session.user.id)
      .order("tx_date", { ascending: false });
    if (error) return jsonError("Не удалось загрузить операции.", 400);
    const transactions = (data || []).map((row) => ({
      id: row.id, title: row.title, amount: Number(row.amount), currency: row.currency,
      type: row.type, category: row.category, date: row.tx_date,
      accountId: row.account_id, account: row.accounts?.name || "",
      ...(row.note ? { note: row.note } : {}),
    }));
    return Response.json({ transactions }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Ошибка загрузки операций.", 500); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allowRequest(`tx:${session.user.id}:${ip}`, 30, 60 * 60 * 1000)) return jsonError("Слишком много операций. Попробуйте позже.", 429);
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId : "";
    const amount = Number(body.amount);
    const date = typeof body.date === "string" ? body.date : "";
    if (!title || title.length > 100 || !category || category.length > 60 || !accountId || accountId.length > 100 ||
      !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || !currencies.has(body.currency) ||
      !types.has(body.type) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return jsonError("Проверьте поля операции.");
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return jsonError("Некорректная дата.");
    const client = getUserScopedClient(session.access);
    const { data: account, error: accountError } = await client.from("accounts")
      .select("id,name").eq("id", accountId).eq("user_id", session.user.id).single();
    if (accountError || !account) return jsonError("Укажите существующий счёт.", 400);
    const { data, error } = await client.from("transactions").insert({
      user_id: session.user.id, account_id: account.id, title, amount, currency: body.currency,
      type: body.type, category, tx_date: date, note: typeof body.note === "string" ? body.note.slice(0,500) : null,
    }).select("id").single();
    if (error) return jsonError("Не удалось сохранить операцию.", 400);
    return Response.json({ id: data.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка сохранения операции.", 400); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId : "";
    const amount = Number(body.amount);
    const date = typeof body.date === "string" ? body.date : "";
    if (!id || id.length > 100 || !title || title.length > 100 || !category || category.length > 60 ||
      !accountId || accountId.length > 100 || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 ||
      !currencies.has(body.currency) || !types.has(body.type) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date))
      return jsonError("Проверьте поля операции.");
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
      return jsonError("Некорректная дата.");
    const client = getUserScopedClient(session.access);
    const { data: account, error: accountError } = await client.from("accounts")
      .select("id,name").eq("id", accountId).eq("user_id", session.user.id).single();
    if (accountError || !account) return jsonError("Укажите существующий счёт.", 400);
    const { data, error } = await client.from("transactions").update({
      title, amount, currency: body.currency, type: body.type, category, tx_date: date,
      account_id: account.id, note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    }).eq("id", id).eq("user_id", session.user.id)
      .select("id,title,amount,currency,type,category,tx_date,account_id,note,accounts(name)").single();
    if (error || !data) return jsonError("Не удалось обновить операцию.", 404);
    return Response.json({ transaction: {
      id: data.id, title: data.title, amount: Number(data.amount), currency: data.currency,
      type: data.type, category: data.category, date: data.tx_date, accountId: data.account_id,
      account: data.accounts?.name || "", ...(data.note ? { note: data.note } : {}),
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка обновления операции.", 400);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 100) return jsonError("Не указана операция.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("transactions")
      .delete().eq("id", id).eq("user_id", session.user.id).select("id").single();
    if (error || !data) return jsonError("Не удалось удалить операцию.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка удаления операции.", 400); }
}
