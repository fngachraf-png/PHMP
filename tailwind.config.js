/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        }
      },
      fontFamily: {
        arabic: ['Cairo', 'sans-serif'],
        latin: ['Inter', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        }
      }
    },
  },
  // الوضع القاتم عبر class على <html> (يديره AppContext + ThemeToggle)
  darkMode: 'class',
  plugins: [],
  // Safelist dynamically-used classes so Tailwind includes them in build
  safelist: [
    // بطاقات KPI وتبويبات التقارير (bg-*-600 ديناميكي)
    { pattern: /^bg-(emerald|blue|purple|amber|red|violet|indigo)-(50|100|500|600)/ },
    // نصوص ملونة ديناميكية (text-*-600/700)
    { pattern: /^text-(emerald|blue|purple|amber|red|violet|indigo)-(500|600|700|800)/ },
    // حدود ديناميكية (border-*-500 في نقطة البيع والإعدادات)
    { pattern: /^border-(emerald|blue|purple|amber|red|violet|indigo)-(300|500)/ },
  ]
}
