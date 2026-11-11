import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FinTracktw1ndy — умный учёт финансов",
  description: "Мультивалютный финансовый кабинет: операции, бюджеты, цели и курсы валют."
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
