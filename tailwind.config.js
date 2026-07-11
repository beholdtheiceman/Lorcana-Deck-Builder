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
        brand: { DEFAULT: 'var(--sapphire)', fg: '#0e1116' },
        good:  'var(--emerald)',
        warn:  '#f4c542',
        bad:   'var(--ruby)',

        // Re-skin the legacy off-palette accents (from pre-redesign markup,
        // especially the App.jsx Deck Lab monolith) onto the ink system without
        // rewriting hundreds of class strings: violet + indigo -> sapphire ramp,
        // purple -> amethyst ramp. Real hex shades so opacity modifiers (e.g.
        // violet-500/20) still resolve. Any `violet-*`/`indigo-*`/`purple-*`
        // class app-wide now renders as the ink accent.
        violet: { 200: '#cbe6f7', 300: '#a3d3f0', 400: '#6bb8e8', 500: '#3aa0e0', 600: '#2f86c0', 700: '#266a98', 800: '#1f5279', 900: '#17384f' },
        indigo: { 200: '#cbe6f7', 300: '#a3d3f0', 400: '#6bb8e8', 500: '#3aa0e0', 600: '#2f86c0', 700: '#266a98', 800: '#1f5279', 900: '#17384f' },
        purple: { 200: '#e0cef0', 300: '#c9a8e4', 400: '#b482dc', 500: '#9b59d0', 600: '#8342b8', 700: '#683593', 800: '#4f2873', 900: '#3a1d52' },
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
