import type { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const bundleId = IS_DEV
  ? 'com.sparktribe.sparksquad.dev'
  : IS_PREVIEW
    ? 'com.sparktribe.sparksquad.preview'
    : 'com.sparktribe.sparksquad';

const name = IS_DEV ? 'SparkSquad (Dev)' : IS_PREVIEW ? 'SparkSquad (Preview)' : 'SparkSquad';

/** "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc" (iOS URL scheme). */
function reversedClientId(clientId: string | undefined): string | null {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId?.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

const googleIosScheme = reversedClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

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
    'expo-apple-authentication',
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: './assets/images/android-icon-monochrome.png',
        color: '#FFB224',
      },
    ],
    // The Google plugin needs the iOS URL scheme; without a client id Google sign-in is hidden.
    ...(googleIosScheme
      ? [
          ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosScheme }] as [
            string,
            unknown,
          ],
        ]
      : ['@react-native-google-signin/google-signin']),
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
