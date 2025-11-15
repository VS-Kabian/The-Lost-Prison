/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brandStart: "#667eea",
        brandEnd: "#764ba2"
      }
    }
  },
  plugins: []
};

