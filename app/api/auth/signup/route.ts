import { allowRequest, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, jsonError, setSessionCookies } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = getClientIp(request);
    if (!allowRequest(`signup:${ip}`, 4, 60 * 60 * 1000)) return jsonError("Слишком много попыток регистрации. Попробуйте позже.", 429);
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) return jsonError("Укажите корректную почту и пароль от 8 до 128 символов.");
    const client = getSupabaseAdminlessClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return jsonError("Не удалось создать аккаунт. Проверьте данные или попробуйте позже.", 400);
    const response = Response.json({ message: data.session ? "Аккаунт создан." : "Проверьте почту и подтвердите регистрацию.", user: data.session && data.user ? { id: data.user.id, email: data.user.email } : null }, { headers: { "Cache-Control": "no-store" } });
    if (data.session) setSessionCookies(response, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") return jsonError("Недопустимый источник запроса.", 403);
    return jsonError("Ошибка регистрации.", 500);
  }
}
