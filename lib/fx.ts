import type { Currency } from "./types";
export type FxRates = { base: Currency; rates: Partial<Record<Currency, number>>; updated: string; source: string; stale?: boolean };
const API = "https://open.er-api.com/v6/latest";
export async function getRates(base: Currency = "EUR"): Promise<FxRates> {
  const response = await fetch(`${API}/${base}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`FX API returned ${response.status}`);
  const data = await response.json();
  if (data.result !== "success" || !data.rates) throw new Error("FX provider returned invalid data");
  const wanted: Currency[] = ["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"];
  const rates: Partial<Record<Currency, number>> = {};
  for (const currency of wanted) {
    const value = Number(data.rates[currency]);
    if (Number.isFinite(value) && value > 0) rates[currency] = value;
  }
  return { base, rates, updated: data.time_last_update_utc || new Date().toISOString(), source: "ExchangeRate-API (reference rates)" };
}
