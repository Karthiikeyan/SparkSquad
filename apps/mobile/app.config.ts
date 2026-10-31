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
const easProjectId = process.env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  slug: 'sparksquad',
  scheme: 'sparksquad',
  version: '1.0.0',
  // Updates only reach builds with the same app version (EAS Update channels per profile).
  runtimeVersion: { policy: 'appVersion' },
  ...(easProjectId ? { updates: { url: `https://u.expo.dev/${easProjectId}` } } : {}),
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  // The app picks dark (default), light or the phone's look at launch (see theme/tokens.ts).
  userInterfaceStyle: 'automatic',
  backgroundColor: '#000000',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: bundleId,
    // Only steps are read; nothing is written to Health Connect.
    permissions: ['android.permission.health.READ_STEPS'],
    // Pulled in by expo-media-library; SparkSquad never reads audio or video.
    blockedPermissions: [
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VIDEO',
      // Added by the React Native template for dev tools; the app never draws over other apps.
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
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
    'expo-sharing',
    [
      'expo-media-library',
      {
        savePhotosPermission: 'SparkSquad saves share cards you make to your photos.',
        photosPermission: 'SparkSquad saves share cards you make to your photos.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'SparkSquad uses your photos so you can add proof to a check-in. Free plan photos stay on this phone.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    '@react-native-community/datetimepicker',
    // Health Connect needs Android 8+ (API 26).
    ['expo-build-properties', { android: { minSdkVersion: 26 } }],
    'react-native-health-connect',
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'SparkSquad reads your step count so step tasks can tick themselves off. Steps stay on this phone.',
        NSHealthUpdateUsageDescription: false,
        background: false,
      },
    ],
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
    eas: { projectId: easProjectId },
  },
});
