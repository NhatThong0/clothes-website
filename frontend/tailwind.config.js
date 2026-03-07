/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0EA5E9', // Sky blue
        secondary: '#06B6D4', // Cyan
        light: '#F0F9FF', // Light sky
        dark: '#0C2340', // Dark blue
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'screen': '100vh',
      },
      borderRadius: {
        'xl': '12px',
      }
    },
  },
  plugins: [],
}
