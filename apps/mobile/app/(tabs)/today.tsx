import { CalendarDays } from 'lucide-react-native';
import { FoundationTab } from '../../src/features/system/FoundationTab';
import { t } from '../../src/i18n';
import { formatLongDate } from '../../src/lib/format';

export default function TodayScreen() {
  return (
    <FoundationTab
      title={t('tabs.today')}
      subtitle={formatLongDate(new Date())}
      emptyIcon={CalendarDays}
      emptyMessage={t('empty.today')}
    />
  );
}
