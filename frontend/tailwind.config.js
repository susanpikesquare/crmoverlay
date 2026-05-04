/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PikeSquare brand palette
        // Primary: navy (#202971) — used for the PikeSquare logo wordmark
        primary: {
          50: '#eef0f9',
          100: '#d4d8ed',
          200: '#a7abc7',  // light periwinkle from brand palette
          300: '#7a82b3',
          400: '#4d559f',
          500: '#202971',  // brand navy
          600: '#1c2466',
          700: '#181f57',
          800: '#141948',
          900: '#0f1339',
        },
        // Accent: orange (#FF8001) — used for the square in the PikeSquare logo
        accent: {
          50: '#fff4e6',
          100: '#ffe4c4',
          200: '#ffbb8a',  // peach from brand palette
          300: '#ffa05c',
          400: '#ff902e',
          500: '#ff8001',  // brand orange
          600: '#e67200',
          700: '#cc6500',
          800: '#a35100',
          900: '#7a3d00',
        },
        // Tertiary: muted purple (#594E86) — supporting palette
        secondary: {
          50: '#f3f2f8',
          100: '#e3e1ee',
          200: '#c7c3dd',
          300: '#938cb1',  // light purple from brand palette
          400: '#766ea0',
          500: '#594e86',  // brand purple
          600: '#4b416f',
          700: '#3d3559',
          800: '#2f2942',
          900: '#211d2c',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
