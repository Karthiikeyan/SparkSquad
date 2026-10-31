import { Users } from 'lucide-react-native';
import { FoundationTab } from '../../src/features/system/FoundationTab';
import { t } from '../../src/i18n';

export default function SquadsScreen() {
  return (
    <FoundationTab title={t('tabs.squads')} emptyIcon={Users} emptyMessage={t('empty.squads')} />
  );
}
