import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#fbf7f0',
        champagne: { 50: '#f9f4ea', 100: '#f1e5cf', 300: '#d6b980', 500: '#b99457', 700: '#87662f' },
        rose: { 50: '#fff6f5', 100: '#f7dfda', 400: '#d88d82' },
        ink: '#302a25',
      },
      fontFamily: {
        serif: ['"Noto Serif TC"', 'serif'],
        sans: ['"Noto Sans TC"', 'sans-serif'],
      },
      boxShadow: { jewel: '0 14px 36px rgba(91, 65, 33, 0.10)' },
    },
  },
  plugins: [],
} satisfies Config
