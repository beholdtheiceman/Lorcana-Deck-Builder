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
      colors: {
        ink: {
          amber:    '#f4b223',
          amethyst: '#9b59d0',
          emerald:  '#2ecc71',
          ruby:     '#e74c5e',
          sapphire: '#3aa0e0',
          steel:    '#9aa7b8',
        },
        bg: {
          base:    '#0e1116',
          raised:  '#161b24',
          overlay: '#1d2430',
        },
        line:  '#2a3340',
        brand: { DEFAULT: '#8b5cf6', fg: '#0e1116' },
        good:  '#2ecc71',
        warn:  '#f4c542',
        bad:   '#e74c5e',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
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
