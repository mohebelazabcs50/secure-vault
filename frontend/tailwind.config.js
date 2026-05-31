/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ios: {
          blue: '#0A84FF',    // iOS System Blue
          green: '#30D158',   // iOS System Green
          red: '#FF453A',     // iOS System Red
          orange: '#FF9F0A',  // iOS System Orange
          yellow: '#FFD60A',  // iOS System Yellow
          teal: '#64D2FF',    // iOS System Teal
          indigo: '#5E5CE6',  // iOS System Indigo
          purple: '#BF5AF2',  // iOS System Purple
          pink: '#FF375F',    // iOS System Pink
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.15)',
          dark: 'rgba(10, 10, 12, 0.3)',
          borderLight: 'rgba(255, 255, 255, 0.25)',
          borderDark: 'rgba(255, 255, 255, 0.08)',
        },
        space: {
          black: '#050507',
          dark: '#0E0D12',
          card: '#16151B',
          silver: '#F5F5F7',
          silverCard: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
      },
      boxShadow: {
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.06)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-blue': '0 0 20px rgba(10, 132, 255, 0.15)',
        'glow-green': '0 0 20px rgba(48, 209, 88, 0.15)',
        'glow-red': '0 0 20px rgba(255, 69, 58, 0.15)',
      },
      backdropBlur: {
        'xs': '2px',
        'apple': '40px', // Custom Apple Glass blur 40px
      }
    },
  },
  plugins: [],
}
