import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, jsonError } from "@/lib/server-supabase";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allowRequest(`reset:${ip}`, 3, 60 * 60 * 1000)) return jsonError("Слишком много запросов. Попробуйте позже.", 429);
    const body = await request.json(); const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Укажите корректную почту.");
    const client = getSupabaseAdminlessClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${new URL(request.url).origin}/auth/confirm?next=/reset-password` });
    if (error) return jsonError("Не удалось отправить письмо. Попробуйте позже.", 400);
    return Response.json({ message: "Если аккаунт существует, письмо для восстановления будет отправлено." }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Недопустимый запрос.", 403); }
}
