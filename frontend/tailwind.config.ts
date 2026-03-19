import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f8fafc",
        ember: "#f97316",
        pine: "#14532d",
        mist: "#cbd5e1",
      },
      boxShadow: {
        glow: "0 24px 80px rgba(15, 23, 42, 0.18)",
      },
      fontFamily: {
        display: ["SUIT Variable", "Pretendard Variable", "Noto Sans KR", "sans-serif"],
        body: ["Pretendard Variable", "Noto Sans KR", "sans-serif"]
      }
    },
  },
  plugins: [],
};

export default config;
