import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { EmptyState, NavHeader, Screen } from '../../src/components/ui';
import { t } from '../../src/i18n';

/** D1 Squad basics. Built in Phase 7; reachable now from A10 "Start a squad". */
export default function CreateBasics() {
  return (
    <Screen
      header={
        <NavHeader
          backLabel={t('common.back')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      <EmptyState icon={Plus} message={t('placeholder.comingSoon')} />
    </Screen>
  );
}
