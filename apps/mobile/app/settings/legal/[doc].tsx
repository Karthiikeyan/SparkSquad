import { LEGAL_DOCS, LEGAL_UPDATED, legalParagraphs, type LegalDoc } from '@sparksquad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { NavHeader, Screen, Text } from '../../../src/components/ui';
import { useConfig } from '../../../src/features/system/useConfig';
import { t } from '../../../src/i18n';
import { env } from '../../../src/lib/env';

type Doc = LegalDoc | 'licences';

function isDoc(value: string | undefined): value is Doc {
  return !!value && (value === 'licences' || value in LEGAL_DOCS);
}

/** F16: in-app legal pages (reachable signed out from Welcome and consent). Same text as the web. */
export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const config = useConfig();
  const which: Doc = isDoc(doc) ? doc : 'terms';
  const licences = which === 'licences';
  const title = licences ? t('legal.licences.title') : LEGAL_DOCS[which].title;
  const paragraphs = licences
    ? t('legal.licences.body').split('\n\n')
    : [
        t('legal.updated', { date: LEGAL_UPDATED }),
        ...legalParagraphs(which, {
          email: config.data?.contactEmail ?? t('legal.helpFallback'),
          deleteUrl: `${env.apiUrl}/delete-account`,
          childSafetyUrl: `${env.apiUrl}/child-safety`,
        }),
      ];
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
        {title}
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
