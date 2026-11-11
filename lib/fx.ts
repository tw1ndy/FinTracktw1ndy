import type { Currency } from "./types";

export type FxRates = {
  base: Currency;
  rates: Partial<Record<Currency, number>>;
  updated: string | null;
  nextUpdate?: string | null;
  source: string;
};
