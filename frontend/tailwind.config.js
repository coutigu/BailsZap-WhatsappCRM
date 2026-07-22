/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#121212',
        darker: '#0a0a0a',
        primary: '#10b981', // Emerald green (premium WhatsApp vibe)
        secondary: '#27272a', // Zinc 800
      }
    },
  },
  plugins: [],
}
