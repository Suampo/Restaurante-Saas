// tailwind.config.js (v3)
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#10B981", // verde principal
          700: "#059669",
        },
        appbg: "#F5F7FB", // fondo gris-azulado del Figma
      },
      boxShadow: {
        card: "0 8px 24px rgba(0,0,0,.08)",
        cta: "0 6px 18px rgba(16,185,129,.35)",
      },
      fontFamily: {
        sans: ["Inter","ui-sans-serif","system-ui","Segoe UI","Arial","sans-serif"],
        montserrat: ["Montserrat","Inter","ui-sans-serif","system-ui","Arial","sans-serif"],
      },
    },
  },
  plugins: [],
};
