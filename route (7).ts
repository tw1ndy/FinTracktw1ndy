import { cookies } from "next/headers";
import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, getUserScopedClient, jsonError } from "@/lib/server-supabase";
const currencies = new Set(["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"]);
const types = new Set(["income","expense"]);
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const access = cookies().get("ft_access")?.value;
    if (!access) return jsonError("Требуется вход в аккаунт.", 401);
    const client = getSupabaseAdminlessClient();
    const { data: auth, error: authError } = await client.auth.getUser(access);
    if (authError || !auth.user) return jsonError("Сессия недействительна.", 401);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allowRequest(`tx:${auth.user.id}:${ip}`, 30, 60 * 60 * 1000)) return jsonError("Слишком много операций. Попробуйте позже.", 429);
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const account = typeof body.account === "string" ? body.account.trim() : "";
    const amount = Number(body.amount);
    const date = typeof body.date === "string" ? body.date : "";
    if (!title || title.length > 100 || !category || category.length > 60 || !account || account.length > 80 || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || !currencies.has(body.currency) || !types.has(body.type) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError("Проверьте поля операции.");
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return jsonError("Некорректная дата.");
    const userClient = getUserScopedClient(access);
    const { data, error } = await userClient.from("transactions").insert({ user_id: auth.user.id, title, amount, currency: body.currency, type: body.type, category, tx_date: date, account_name: account }).select("id").single();
    if (error) return jsonError("Не удалось сохранить операцию.", 400);
    return Response.json({ id: data.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка сохранения операции.", 403); }
}
