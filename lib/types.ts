export type Currency = "RUB" | "USD" | "EUR" | "GBP" | "CNY" | "TRY" | "AED" | "CHF" | "JPY" | "CAD";
export type TxType = "income" | "expense";
export type Transaction = {
  id: string; title: string; amount: number; currency: Currency; type: TxType;
  category: string; date: string; account: string; note?: string;
};
export type Budget = { id: string; category: string; limit: number; currency: Currency };
export type Goal = { id: string; title: string; target: number; saved: number; currency: Currency; deadline?: string };
export type Account = { id: string; name: string; balance: number; currency: Currency };
export const CURRENCIES: Currency[] = ["RUB","USD","EUR","GBP","CNY","TRY","AED","CHF","JPY","CAD"];
export const SYMBOL: Record<Currency,string> = { RUB:"₽",USD:"$",EUR:"€",GBP:"£",CNY:"¥",TRY:"₺",AED:"د.إ",CHF:"CHF",JPY:"¥",CAD:"C$" };
export const money = (n:number,c:Currency) => new Intl.NumberFormat("ru-RU",{style:"currency",currency:c,maximumFractionDigits: c==="JPY"?0:2}).format(Number.isFinite(n)?n:0);
export const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
