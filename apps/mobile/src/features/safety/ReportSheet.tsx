import { reportReasonSchema, TEXT_LIMITS, type ReportInput } from '@sparksquad/shared';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Text, TextField, useToast } from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { syncSoon } from '../squads/actions';

type Reason = ReportInput['reason'];
const REASONS = reportReasonSchema.options;

export interface ReportTarget {
  targetType: ReportInput['targetType'];
  targetId: string;
}

/** C15: reasons + optional details → "Report sent. We review reports within 24 hours." */
export function ReportSheet({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!target || !reason) return;
    setSending(true);
    try {
      await endpoints.report({ ...target, reason, details: details.trim() || undefined });
      toast.show({ message: t('report.sent'), kind: 'success' });
      setReason(null);
      setDetails('');
      onClose();
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet visible={!!target} onClose={onClose} accessibilityLabel={t('report.title')}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text variant="title2" accessibilityRole="header">
          {t('report.title')}
        </Text>
        <Text variant="footnote" color="label2" style={styles.body}>
          {t('report.body')}
        </Text>
        <View
          style={styles.group}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('report.reason')}
        >
          {REASONS.map((r, i) => (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === r }}
              accessibilityLabel={t(`report.${r}`)}
              style={[styles.row, i > 0 && styles.separator]}
            >
              <Text variant="body" style={styles.flex}>
                {t(`report.${r}`)}
              </Text>
              {reason === r ? (
                <Check size={20} color={colors.accent} strokeWidth={iconStroke} />
              ) : null}
            </Pressable>
          ))}
        </View>
        <TextField
          label={t('report.details')}
          value={details}
          onChangeText={setDetails}
          multiline
          counter={TEXT_LIMITS.reportDetails}
          containerStyle={styles.details}
        />
        <Button
          label={t('report.submit')}
          onPress={() => void submit()}
          disabled={!reason}
          loading={sending}
          style={styles.submit}
          testID="report-submit"
        />
      </ScrollView>
    </BottomSheet>
  );
}

/** Confirm, then block: their content disappears everywhere for me on the next sync. */
export function confirmBlock(
  user: { id: string; name: string },
  onDone: (message: string) => void,
  onError: (message: string) => void,
): void {
  Alert.alert(t('checkinDetail.blockConfirm', { name: user.name }), t('checkinDetail.blockBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('checkinDetail.blockAction'),
      style: 'destructive',
      onPress: () => {
        endpoints
          .block(user.id)
          .then(() => {
            syncSoon();
            onDone(t('checkinDetail.blocked', { name: user.name }));
          })
          .catch((e: unknown) => onError(errorMessage(e)));
      },
    },
  ]);
}

const styles = StyleSheet.create({
  body: { marginTop: 4, marginBottom: 12 },
  group: { backgroundColor: colors.surface2, borderRadius: radius.list, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  flex: { flex: 1 },
  details: { marginTop: 16 },
  submit: { marginTop: 16, marginBottom: 8 },
});
