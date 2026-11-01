import { Appearance, type ColorSchemeName, type TextStyle } from 'react-native';
import { getPref, type Prefs } from '../lib/prefs';
import palette from './colors';

export type ColorToken = keyof typeof palette.dark;
export type ThemeName = 'dark' | 'light';

/** Dark is the default (D6); "system" follows the phone. */
export function resolveTheme(
  pref: Prefs['theme'] | undefined,
  system: ColorSchemeName | null | undefined,
): ThemeName {
  if (pref === 'light') return 'light';
  if (pref === 'system') return system === 'light' ? 'light' : 'dark';
  return 'dark';
}

function readThemePref(): Prefs['theme'] | undefined {
  try {
    return getPref('theme');
  } catch {
    return undefined;
  }
}

/** Light theme ships later (D6): the choice is only honoured in builds with the flag on. */
export const lightThemeEnabled = process.env.EXPO_PUBLIC_LIGHT_THEME === 'true';

/** Saved choice, read once at launch. */
export const themePref: Prefs['theme'] = lightThemeEnabled ? (readThemePref() ?? 'dark') : 'dark';

/** Picked once at launch; changing the theme restarts the app (styles are static). */
export const themeName: ThemeName = resolveTheme(themePref, Appearance.getColorScheme());

export const colors: Record<ColorToken, string> =
  themeName === 'light' ? palette.light : palette.dark;
export const lightColors: Record<ColorToken, string> = palette.light;

export const avatarColors: readonly string[] =
  themeName === 'light' ? palette.avatarLight : palette.avatarDark;

export function avatarColor(index: number): string {
  const i = ((Math.trunc(index) % avatarColors.length) + avatarColors.length) % avatarColors.length;
  return avatarColors[i] ?? avatarColors[0]!;
}

/** Stable 0..11 index from any id, for users without a chosen colour. */
export function avatarIndexFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % avatarColors.length;
}

export const radius = {
  card: 22,
  list: 16,
  listLarge: 18,
  input: 14,
  button: 12,
  segment: 10,
  segmentPill: 8,
  sheet: 22,
} as const;

export const space = {
  screen: 16,
} as const;

/** Bottom bar height on this phone: fixed content plus the phone's own bottom inset. */
export function tabBarHeight(bottomInset: number): number {
  return 58 + bottomInset;
}

export const sizes = {
  touch: 44,
  primaryButton: 52,
  secondaryButton: 44,
  row: 52,
  rowTall: 56,
} as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  displayMedium: 'BricolageGrotesque_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** Typography scale from 02_DESIGN_SYSTEM.md. Font family encodes the weight. */
export const type = {
  largeTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  title2: { fontFamily: fonts.displaySemibold, fontSize: 22, lineHeight: 28 },
  statXL: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, fontVariant: tabular },
  stat: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontVariant: tabular },
  headline: { fontFamily: fonts.sansSemibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20 },
  bodySemibold: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 20 },
  callout: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 22 },
  footnote: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  footnoteSemibold: { fontFamily: fonts.sansSemibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 13 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const motion = {
  pressScale: 0.98,
  fast: 140,
  normal: 220,
} as const;

/** Lucide icons: 1.8 stroke everywhere (design system). */
export const iconStroke = 1.8;
