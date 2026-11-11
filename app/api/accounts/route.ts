import { cookies } from "next/headers";
import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, getUserScopedClient, jsonError } from "@/lib/server-supabase";

const currencies = new Set(["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"]);
export const runtime = "nodejs";

async function getAuthenticatedUser() {
  const access = cookies().get("ft_access")?.value;
  if (!access) return null;
  const auth = getSupabaseAdminlessClient();
  const { data, error } = await auth.auth.getUser(access);
  if (error || !data.user) return null;
  return { access, user: data.user };
}

function rateLimit(request: Request, userId: string, key: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return allowRequest(`${key}:${userId}:${ip}`, 60, 60 * 60 * 1000);
}

export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("accounts")
      .select("id,name,balance,currency").eq("user_id", session.user.id).order("created_at");
    if (error) return jsonError("Не удалось загрузить счета.", 400);
    return Response.json({ accounts: (data || []).map(row => ({ ...row, balance: Number(row.balance) })) },
      { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Ошибка загрузки счетов.", 500); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    if (!rateLimit(request, session.user.id, "accounts")) return jsonError("Слишком много запросов.", 429);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const balance = Number(body.balance);
    if (!name || name.length > 80 || !Number.isFinite(balance) || Math.abs(balance) > 1_000_000_000 || !currencies.has(body.currency))
      return jsonError("Проверьте название, баланс и валюту.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("accounts")
      .insert({ user_id: session.user.id, name, balance, currency: body.currency })
      .select("id,name,balance,currency").single();
    if (error) return jsonError("Не удалось сохранить счёт.", 400);
    return Response.json({ account: { ...data, balance: Number(data.balance) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка сохранения счёта.", 400); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    if (!rateLimit(request, session.user.id, "accounts-update")) return jsonError("Слишком много запросов.", 429);
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const balance = Number(body.balance);
    if (!id || id.length > 100 || !name || name.length > 80 || !Number.isFinite(balance) ||
      Math.abs(balance) > 1_000_000_000 || !currencies.has(body.currency))
      return jsonError("Проверьте данные счёта.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("accounts").update({ name, balance, currency: body.currency })
      .eq("id", id).eq("user_id", session.user.id).select("id,name,balance,currency").single();
    if (error || !data) return jsonError("Не удалось обновить счёт.", 404);
    return Response.json({ account: { ...data, balance: Number(data.balance) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка обновления счёта.", 400); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 100) return jsonError("Не указан счёт.");
    const client = getUserScopedClient(session.access);
    const { data: linked, error: linkedError } = await client.from("transactions")
      .select("id").eq("user_id", session.user.id).eq("account_id", id).limit(1);
    if (linkedError) return jsonError("Не удалось проверить операции счёта.", 400);
    if (linked?.length) return jsonError("Нельзя удалить счёт, пока к нему привязаны операции.", 409);
    const { data, error } = await client.from("accounts").delete()
      .eq("id", id).eq("user_id", session.user.id).select("id").single();
    if (error || !data) return jsonError("Не удалось удалить счёт.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка удаления счёта.", 400); }
}
