"use client";
import { useState } from "react";
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      setMessage(response.ok ? "Пароль обновлён. Теперь можно вернуться в приложение." : (result.error || "Не удалось обновить пароль."));
    } catch { setMessage("Ошибка соединения. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen grid place-items-center bg-[#080d17] p-4 text-white"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101827] p-6"><h1 className="text-xl font-semibold">Новый пароль</h1><p className="mt-2 text-sm text-slate-400">Введите новый пароль для FinTracktw1ndy.</p><input className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 p-3" type="password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Новый пароль (от 8 символов)"/><button disabled={busy} className="mt-4 w-full rounded-xl bg-indigo-500 p-3 font-semibold disabled:opacity-50">{busy ? "Сохранение…" : "Обновить пароль"}</button>{message&&<p className="mt-4 text-sm text-indigo-200">{message}</p>}</form></main>;
}
