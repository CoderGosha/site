/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,njk,js}", "./templates/**/*.{html,njk,js}"],
  theme: {
    extend: {
      animation: {
        slidein: "slidein .5s ease-out",
        fadein: "fadein .4s ease-out",
        slideout: "slideout .3s ease-in",
        fadeout: "fadeout .3s ease-in",
      },
      keyframes: {
        fadein: {
          "0%": { opacity: 0 },
          "100%": { opacity: 100 },
        },
        fadeout: {
          "0%": { opacity: 100 },
          "100%": { opacity: 0 },
        },
        slidein: {
          "0%": { transform: "translate(0, 100%)", opacity: 0 },
          "100%": { transform: "translate(0, 0)", opacity: 100 },
        },
        slideout: {
          "0%": { transform: "translate(0, 0)", opacity: 100 },
          "100%": { transform: "translate(0, 100%)", opacity: 0 },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
