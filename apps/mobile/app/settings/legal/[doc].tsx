import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { NavHeader, Screen, Text } from '../../../src/components/ui';
import { t } from '../../../src/i18n';

const DOCS = ['terms', 'privacy'] as const;
type Doc = (typeof DOCS)[number];

function isDoc(value: string | undefined): value is Doc {
  return !!value && (DOCS as readonly string[]).includes(value);
}

/** F16: in-app Terms and Privacy pages (reachable signed out from Welcome and consent). */
export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const which: Doc = isDoc(doc) ? doc : 'terms';
  const paragraphs = t(`legal.${which}.body`).split('\n\n');
  return (
    <Screen
      header={
        <NavHeader
          backLabel={t('legal.back')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t(`legal.${which}.title`)}
      </Text>
      {paragraphs.map((p, i) => (
        <Text key={i} variant="body" color={i === 0 ? 'label3' : 'label'} style={styles.paragraph}>
          {p}
        </Text>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  paragraph: { marginBottom: 14 },
});
