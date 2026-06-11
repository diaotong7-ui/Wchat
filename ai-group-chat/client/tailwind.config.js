/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wechat: {
          green: '#07C160',
          'green-dark': '#06AD56',
          'green-light': '#E8F9EE',
          bg: '#EDEDED',
          bubble: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
