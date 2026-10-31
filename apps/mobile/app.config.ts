import type { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const bundleId = IS_DEV
  ? 'com.sparktribe.sparksquad.dev'
  : IS_PREVIEW
    ? 'com.sparktribe.sparksquad.preview'
    : 'com.sparktribe.sparksquad';

const name = IS_DEV ? 'SparkSquad (Dev)' : IS_PREVIEW ? 'SparkSquad (Preview)' : 'SparkSquad';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  slug: 'sparksquad',
  scheme: 'sparksquad',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
