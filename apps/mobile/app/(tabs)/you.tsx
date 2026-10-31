import { User } from 'lucide-react-native';
import { FoundationTab } from '../../src/features/system/FoundationTab';
import { t } from '../../src/i18n';

export default function YouScreen() {
  return <FoundationTab title={t('tabs.you')} emptyIcon={User} emptyMessage={t('empty.you')} />;
}
