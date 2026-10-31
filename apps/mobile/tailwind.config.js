const { dark } = require('./src/theme/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: dark,
      fontFamily: {
        display: ['BricolageGrotesque_700Bold'],
        'display-semibold': ['BricolageGrotesque_600SemiBold'],
        'display-medium': ['BricolageGrotesque_500Medium'],
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
      },
      borderRadius: {
        card: '22px',
        list: '16px',
        input: '14px',
        button: '12px',
      },
    },
  },
  plugins: [],
};
