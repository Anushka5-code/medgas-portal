/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary:   { DEFAULT: '#2F80ED', light: '#5B9FF3', dark: '#1A6DCF' },
        accent:    { DEFAULT: '#F0386B', light: '#F5608A' },
        navy:      { DEFAULT: '#1E2A4A', light: '#2D3E6B' },
        muted:     { DEFAULT: '#8A94A6', light: '#B0B8C8' },
        surface:   { DEFAULT: '#FFFFFF', bg: '#F4F7FC' },
        success:   { DEFAULT: '#22C55E', light: '#DCFCE7' },
        warning:   { DEFAULT: '#F5A524', light: '#FEF3C7' },
        danger:    { DEFAULT: '#EF4444', light: '#FEE2E2' },
        info:      { DEFAULT: '#4FC3F7', light: '#E0F7FF' },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card:   '0 4px 24px rgba(80, 110, 180, 0.08)',
        hover:  '0 8px 32px rgba(80, 110, 180, 0.14)',
        sidebar:'4px 0 24px rgba(80, 110, 180, 0.06)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in':   'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: 0, transform: 'translateX(16px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
