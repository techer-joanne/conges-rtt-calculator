/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette "Ville de Trappes" dérivée de l'en-tête du fichier Excel.
        trappes: {
          50: '#f2f8fd',
          100: '#e6f0f9',
          200: '#cce0f2',
          300: '#9cc3e6',
          400: '#6ba3d8',
          500: '#4a86c5',
          600: '#3367a3',
          700: '#274b78',
          800: '#1e3a5f',
          900: '#16294d',
          950: '#0f1f3d',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,31,61,0.06), 0 8px 24px -8px rgba(15,31,61,0.18)',
        glow: '0 0 0 1px rgba(74,134,197,0.25), 0 12px 40px -12px rgba(30,58,95,0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.96)' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'pop': 'pop 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
