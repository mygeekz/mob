/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    // مسیرهای دقیق برای اسکن فایل‌های شما
    "./App.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./layouts/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-green-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-teal-500',
    'bg-gray-200', // Fallback color
    // Add other dynamic classes here if needed
  ],
  theme: {
    extend: {
      fontFamily: {
        vazir: ['Vazirmatn', 'sans-serif'],
      },
      colors: {
        'glass-edge': 'rgba(255, 255, 255, 0.15)',
        'glass-bg': 'rgba(255, 255, 255, 0.1)',
        'glass-sidebar-bg': 'rgba(30, 41, 59, 0.6)',
        'glass-header-bg': 'rgba(30, 41, 59, 0.7)',
        'primary': '#4f46e5',
        'secondary': '#10b981',
        'accent': '#ec4899',
      }
    },
  },
  plugins: [],
}