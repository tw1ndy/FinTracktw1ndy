import { cookies } from "next/headers";
import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, getUserScopedClient, jsonError } from "@/lib/server-supabase";

const currencies = new Set(["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"]);
export const runtime = "nodejs";

async function getAuthenticatedUser() {
  const access = (await cookies()).get("ft_access")?.value;
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
    const { data, error } = await client.from("budgets").select("id,category,amount_limit,currency")
      .eq("user_id", session.user.id).order("created_at");
    if (error) return jsonError("Не удалось загрузить бюджеты.", 400);
    return Response.json({ budgets: (data || []).map(row => ({ id: row.id, category: row.category, limit: Number(row.amount_limit), currency: row.currency })) },
      { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Ошибка загрузки бюджетов.", 500); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    if (!rateLimit(request, session.user.id, "budgets")) return jsonError("Слишком много запросов.", 429);
    const body = await request.json();
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const limit = Number(body.limit);
    if (!category || category.length > 60 || !Number.isFinite(limit) || limit <= 0 || limit > 1_000_000_000 || !currencies.has(body.currency))
      return jsonError("Проверьте категорию, лимит и валюту.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("budgets")
      .upsert({ user_id: session.user.id, category, amount_limit: limit, currency: body.currency }, { onConflict: "user_id,category,currency" })
      .select("id,category,amount_limit,currency").single();
    if (error) return jsonError("Не удалось сохранить бюджет.", 400);
    return Response.json({ budget: { id: data.id, category: data.category, limit: Number(data.amount_limit), currency: data.currency } },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка сохранения бюджета.", 400); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    if (!rateLimit(request, session.user.id, "budgets-delete")) return jsonError("Слишком много запросов.", 429);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 100) return jsonError("Не указан бюджет.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("budgets").delete().eq("id", id).eq("user_id", session.user.id).select("id").single();
    if (error || !data) return jsonError("Не удалось удалить бюджет.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка удаления бюджета.", 400); }
}
