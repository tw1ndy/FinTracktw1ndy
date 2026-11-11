import { NextRequest } from "next/server";

const CURRENCIES = new Set(["RUB", "USD", "EUR", "GBP", "CNY", "TRY", "AED", "CHF", "JPY", "CAD"]);
const PROVIDER = "https://open.er-api.com/v6/latest";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = (request.nextUrl.searchParams.get("base") || "EUR").toUpperCase();
  if (!CURRENCIES.has(base)) return Response.json({ error: "Unsupported base currency." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const upstream = await fetch(`${PROVIDER}/${base}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!upstream.ok) return Response.json({ error: "Currency provider is unavailable." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    const payload = await upstream.json();
    if (payload?.result !== "success" || !payload?.rates || typeof payload.rates !== "object")
      return Response.json({ error: "Currency provider returned invalid data." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    const rates: Record<string, number> = {};
    for (const currency of CURRENCIES) {
      const value = Number(payload.rates[currency]);
      if (Number.isFinite(value) && value > 0) rates[currency] = value;
    }
    if (rates[base] !== 1) return Response.json({ error: "Base currency rate is missing." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return Response.json({
      base,
      rates,
      updated: payload.time_last_update_utc || null,
      nextUpdate: payload.time_next_update_utc || null,
      source: "ExchangeRate-API Open Access (daily reference rates)",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not reach the currency provider." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
