import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { ink: "#080B14", panel: "#101624", line: "#202A3B", muted: "#8994A8", accent: "#7C9CFF" }, boxShadow: { glow: "0 0 40px rgba(92,128,255,.14)" } } },
  plugins: []
};
export default config;
