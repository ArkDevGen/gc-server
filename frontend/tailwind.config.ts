import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#e84049',
          600: '#c8202c',
          700: '#9b1620',
          800: '#7f1d1d',
          900: '#5a0f15',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
