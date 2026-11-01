/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Screen tests render whole trees; the 5 s default flakes on slower machines under load.
  testTimeout: 20000,
  moduleNameMapper: {
    // The "react-native" entry is .mjs, which Jest does not transform; use the CJS build.
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|lucide-react-native|react-native-svg|standard-navigation|@shopify/flash-list|@sparksquad/.*)',
  ],
};
