/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // UI por defecto (ya la cargas en index.html)
        sans: ["Inter","ui-sans-serif","system-ui","Segoe UI","Arial","sans-serif"],
        // Serif de títulos secundarios (ya la cargas)
        serif: ["Playfair Display","Georgia","ui-serif","serif"],
        // 👇 Alias para usar como `font-montserrat`
        montserrat: ["Montserrat","Inter","ui-sans-serif","system-ui","Arial","sans-serif"],
      },
    },
  },
  plugins: [],
};
