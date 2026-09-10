/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Un único acento cálido, tipo Flightradar24 / FlightAware.
        accent: {
          DEFAULT: '#f5b843',
          strong: '#ffb020',
          soft: '#f5d491',
        },
      },
      boxShadow: {
        panel: '0 8px 32px -12px rgba(0, 0, 0, 0.6)',
        marker: '0 1px 3px rgba(0, 0, 0, 0.4)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideIn: {
          '0%': { transform: 'translateX(16px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: 0 },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s ease-out',
        slideIn: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        slideUp: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
