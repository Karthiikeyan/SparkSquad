import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, Platform, StyleSheet } from 'react-native';
import {
  Button,
  GroupedList,
  ListRow,
  NavHeader,
  Screen,
  SectionLabel,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { useMe } from '../auth/SessionProvider';
import { useConfig } from '../system/useConfig';
import { paymentsAvailable, subscriptionInfo } from './purchases';
import { usePaywall } from './usePaywall';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Store subscription pages, used when RevenueCat has no management URL. */
export const STORE_SUBSCRIPTIONS =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

/** F11: current plan, renewal or end date, manage in the store, restore. */
export function BillingScreen() {
  const me = useMe();
  const config = useConfig();
  const live = paymentsAvailable(config.data?.features.paymentsEnabled);
  const paywall = usePaywall('plus');
  const isPlus = me.plan === 'plus';
  const sub = useQuery({
    queryKey: ['subscription', me.id],
    queryFn: () => subscriptionInfo(me.id),
    enabled: live && isPlus,
  });

  const expires = sub.data?.expiresAt ?? me.planExpiresAt;
  const dateLine = expires
    ? sub.data?.willRenew === false
      ? t('billing.expires', { date: dateFmt.format(new Date(expires)) })
      : t('billing.renews', { date: dateFmt.format(new Date(expires)) })
    : undefined;

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('billing.title')}
      </Text>
      <SectionLabel>{t('billing.current')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={isPlus ? t('billing.plus') : t('billing.free')}
          subtitle={isPlus ? dateLine : undefined}
        />
        {isPlus ? (
          <ListRow
            title={t('billing.manage')}
            chevron
            onPress={() => void Linking.openURL(sub.data?.managementUrl ?? STORE_SUBSCRIPTIONS)}
          />
        ) : (
          <ListRow
            title={t('billing.seePlus')}
            chevron
            onPress={() => router.push('/paywall/plus')}
          />
        )}
        <ListRow
          title={t('billing.squadPro')}
          chevron
          onPress={() => router.push('/paywall/squad-pro')}
        />
      </GroupedList>
      {live ? (
        <Button
          label={t('billing.restore')}
          variant="secondary"
          onPress={() => void paywall.restore()}
          loading={paywall.busy === 'restore'}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: { marginBottom: 20 },
});
