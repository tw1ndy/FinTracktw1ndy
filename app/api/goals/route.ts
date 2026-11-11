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
    const { data, error } = await client.from("goals").select("id,title,target,saved,currency,deadline")
      .eq("user_id", session.user.id).order("created_at");
    if (error) return jsonError("Не удалось загрузить цели.", 400);
    return Response.json({ goals: (data || []).map(row => ({ ...row, target: Number(row.target), saved: Number(row.saved), ...(row.deadline ? { deadline: row.deadline } : {}) })) },
      { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Ошибка загрузки целей.", 500); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    if (!rateLimit(request, session.user.id, "goals")) return jsonError("Слишком много запросов.", 429);
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const target = Number(body.target);
    const saved = body.saved === undefined ? 0 : Number(body.saved);
    const deadline = body.deadline == null || body.deadline === "" ? null : String(body.deadline);
    if (!title || title.length > 100 || !Number.isFinite(target) || target <= 0 || target > 1_000_000_000 ||
      !Number.isFinite(saved) || saved < 0 || saved > target || !currencies.has(body.currency) ||
      (deadline !== null && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)))
      return jsonError("Проверьте название, суммы, валюту и срок цели.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("goals")
      .insert({ user_id: session.user.id, client_id: typeof body.id === "string" ? body.id.slice(0,100) : null, title, target, saved, currency: body.currency, deadline })
      .select("id,title,target,saved,currency,deadline").single();
    if (error) return jsonError("Не удалось сохранить цель.", 400);
    return Response.json({ goal: { ...data, target: Number(data.target), saved: Number(data.saved) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка сохранения цели.", 400); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    if (!rateLimit(request, session.user.id, "goals-update")) return jsonError("Слишком много запросов.", 429);
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const target = Number(body.target);
    const saved = Number(body.saved);
    const deadline = body.deadline == null || body.deadline === "" ? null : String(body.deadline);
    if (!id || id.length > 100 || !title || title.length > 100 || !Number.isFinite(target) || target <= 0 ||
      target > 1_000_000_000 || !Number.isFinite(saved) || saved < 0 || saved > target ||
      !currencies.has(body.currency) || (deadline !== null && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)))
      return jsonError("Проверьте данные цели.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("goals").update({ title, target, saved, currency: body.currency, deadline })
      .eq("id", id).eq("user_id", session.user.id).select("id,title,target,saved,currency,deadline").single();
    if (error || !data) return jsonError("Не удалось обновить цель.", 404);
    return Response.json({ goal: { ...data, target: Number(data.target), saved: Number(data.saved) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка обновления цели.", 400); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAuthenticatedUser();
    if (!session) return jsonError("Требуется вход в аккаунт.", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 100) return jsonError("Не указана цель.");
    const client = getUserScopedClient(session.access);
    const { data, error } = await client.from("goals").delete().eq("id", id).eq("user_id", session.user.id).select("id").single();
    if (error || !data) return jsonError("Не удалось удалить цель.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка удаления цели.", 400); }
}
