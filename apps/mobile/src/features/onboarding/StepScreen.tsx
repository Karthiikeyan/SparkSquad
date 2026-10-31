import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavHeader, Screen, Text } from '../../components/ui';
import { t } from '../../i18n';

export interface StepScreenProps {
  /** "Step 1 of 4"; omitted on screens outside the numbered flow. */
  step?: string;
  title: string;
  body?: string;
  children?: ReactNode;
  /** Primary action(s), pinned in the thumb zone. */
  footer: ReactNode;
  /** Show a back chevron (defaults to true when there's history). */
  back?: boolean;
}

/** Shared layout for auth and onboarding steps: back, step label, title, intro, form, footer. */
export function StepScreen({ step, title, body, children, footer, back }: StepScreenProps) {
  const showBack = back ?? router.canGoBack();
  return (
    <Screen
      header={
        showBack ? (
          <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />
        ) : undefined
      }
      footer={footer}
    >
      <View style={[styles.head, !showBack && styles.headNoBack]}>
        {step ? (
          <Text variant="footnoteSemibold" color="accent">
            {step}
          </Text>
        ) : null}
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text variant="callout" color="label2">
            {body}
          </Text>
        ) : null}
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8, marginTop: 8, marginBottom: 24 },
  headNoBack: { marginTop: 32 },
});
