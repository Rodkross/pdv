/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pdv: {
          bg: '#0f172a',
          panel: '#1e293b',
          panelLight: '#334155',
          accent: '#2563eb',
          accent2: '#16a34a',
          warn: '#f59e0b',
          danger: '#dc2626',
        },
      },
      fontFamily: {
        mono: ['"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};
