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
const easProjectId = '428c8db3-afbc-469a-9171-e22395ed37eb';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'spark-squad',
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
    infoPlist: {
      // HTTPS only, so no export compliance paperwork on each upload.
      ITSAppUsesNonExemptEncryption: false,
      // Development builds still need plain HTTP to reach the PC.
      ...(IS_DEV ? {} : { NSAppTransportSecurity: { NSAllowsArbitraryLoads: false } }),
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  android: {
    package: bundleId,
    // Only steps are read; nothing is written to Health Connect.
    permissions: ['android.permission.health.READ_STEPS'],
    // Pulled in by expo-media-library; SparkSquad never reads audio or video.
    blockedPermissions: [
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VIDEO',
      // Play's photo policy: proofs use the system picker, which needs no permission, and share
      // cards are saved write-only.
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.ACCESS_MEDIA_LOCATION',
      // Add to calendar opens the phone's own "new event" screen.
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
      // No ads, so no advertising ID.
      'com.google.android.gms.permission.AD_ID',
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
    [
      'expo-quick-actions',
      {
        androidIcons: {
          shortcut_checkin: {
            foregroundImage: './assets/images/shortcut-checkin.png',
            backgroundColor: '#000000',
          },
          shortcut_today: {
            foregroundImage: './assets/images/shortcut-today.png',
            backgroundColor: '#000000',
          },
          shortcut_invite: {
            foregroundImage: './assets/images/shortcut-invite.png',
            backgroundColor: '#000000',
          },
        },
      },
    ],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'SquadToday',
            label: 'SparkSquad today',
            description: "Tick off today's tasks from your home screen",
            // Small minimums and no maximum: resize it freely, the layout follows the size.
            minWidth: '180dp',
            minHeight: '70dp',
            targetCellWidth: 4,
            targetCellHeight: 3,
            resizeMode: 'horizontal|vertical',
            previewImage: './assets/images/widget-preview.png',
            // Android refreshes it at least this often; the app also redraws it on every change.
            updatePeriodMillis: 3_600_000,
          },
        ],
      },
    ],
    'expo-font',
    'expo-localization',
    // Keys are never gated on Face ID, so no permission text for it.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-sqlite',
    'expo-apple-authentication',
    'expo-sharing',
    // Only the Add to calendar sheet is used; iOS still needs these strings in the build.
    [
      'expo-calendar',
      {
        calendarPermission: 'SparkSquad adds your challenge to your calendar when you ask it to.',
        writeOnlyCalendarPermission:
          'SparkSquad adds your challenge to your calendar when you ask it to.',
        remindersPermission: false,
      },
    ],
    [
      'expo-media-library',
      {
        savePhotosPermission: 'SparkSquad saves share cards you make to your photos.',
        photosPermission:
          'SparkSquad uses your photos so you can add proof to a check-in, and saves share cards you make.',
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
          'SparkSquad reads your step count so step tasks fill in. It only leaves this phone in a check-in you submit.',
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
        imageWidth: 180,
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
