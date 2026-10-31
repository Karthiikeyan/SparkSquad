import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { BottomSheet, EmptyState } from '../../src/components/ui';
import { t } from '../../src/i18n';

/** Check-in sheet route (B4). The full sheet is built in Phase 5. */
export default function CheckinSheet() {
  return (
    <BottomSheet visible onClose={() => router.back()} accessibilityLabel={t('tabs.checkIn')}>
      <EmptyState icon={CheckCircle2} message={t('placeholder.comingSoon')} />
    </BottomSheet>
  );
}
