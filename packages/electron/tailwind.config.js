/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,vue,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f5f5f7',
          dark: '#1e1e2e',
        },
        panel: {
          DEFAULT: '#ffffff',
          dark: '#26263a',
        },
        accent: {
          DEFAULT: '#6c5ce7',
          dark: '#a29bfe',
        },
      },
    },
  },
  plugins: [],
};
