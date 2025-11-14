/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 确保 Tailwind 扫描你的所有组件文件
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

