import { Compass } from 'lucide-react-native';
import { FoundationTab } from '../../src/features/system/FoundationTab';
import { t } from '../../src/i18n';

export default function DiscoverScreen() {
  return (
    <FoundationTab
      title={t('tabs.discover')}
      emptyIcon={Compass}
      emptyMessage={t('empty.discover')}
    />
  );
}
