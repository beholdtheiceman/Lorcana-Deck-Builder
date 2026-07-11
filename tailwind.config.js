/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App*.jsx",
    "./app_*.jsx"
  ],
  theme: {
    extend: {
      // Color/radius/font values are consumed from src/tokens.css (P3.3 —
      // single source of truth); only non-token extras are hardcoded here.
      colors: {
        ink: {
          amber:    'var(--amber)',
          amethyst: 'var(--amethyst)',
          emerald:  'var(--emerald)',
          ruby:     'var(--ruby)',
          sapphire: 'var(--sapphire)',
          steel:    'var(--steel)',
        },
        bg: {
          base:    'var(--canvas)',
          raised:  'var(--panel)',
          overlay: 'var(--panel-2)',
        },
        line:  'var(--line-2)',
        brand: { DEFAULT: '#8b5cf6', fg: '#0e1116' },
        good:  'var(--emerald)',
        warn:  '#f4c542',
        bad:   'var(--ruby)',
      },
      fontFamily: {
        display: 'var(--serif)',
        sans:    'var(--sans)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: '20px',
      },
      boxShadow: {
        card: '0 6px 24px rgba(0,0,0,.35)',
      },
      fontSize: {
        xs:   '12px',
        sm:   '13px',
        base: '14px',
        lg:   '17px',
        xl:   '22px',
        '2xl':'30px',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
      },
    },
  },
  plugins: [],
}
