import type { Currency } from "./types";

export type FxRates = {
  base: Currency;
  rates: Partial<Record<Currency, number>>;
  updated: string | null;
  nextUpdate?: string | null;
  source: string;
};

/** Backward-compatible client helper; all provider requests stay on our server route. */
export async function getRates(base: Currency = "EUR"): Promise<FxRates> {
  const response = await fetch(`/api/fx?base=${encodeURIComponent(base)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`FX API returned ${response.status}`);
  return await response.json() as FxRates;
}
