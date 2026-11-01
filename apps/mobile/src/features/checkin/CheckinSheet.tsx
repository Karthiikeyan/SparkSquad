import {
  isValidTimeZone,
  photoRetentionDays,
  rawDayNumber,
  TEXT_LIMITS,
  type PlanTask,
} from '@sparksquad/shared';
import { getCalendars } from 'expo-localization';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, ImagePlus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  ChipToggle,
  IconButton,
  OfflineBanner,
  Pressable,
  Stepper,
  Switch,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { t } from '../../i18n';
import { track } from '../../lib/analytics';
import { useOnline } from '../../lib/hooks/useOnline';
import { getRuntime } from '../../lib/runtime';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import {
  dayFor,
  globalStreak,
  pendingCards,
  predictedStreak,
  type TodayCard,
  type TodaySource,
} from '../today/model';
import { stepperUnit, targetLabel } from '../today/taskText';
import { useToday } from '../today/useToday';
import { prefillFromVerification, verifiedIndices, type Prefill } from '../verify/prefill';
import { clearDraft, readDraft, writeDraft } from './drafts';
import { localProofUri, removeLocalProof, saveLocalProof } from './localProof';
import { submitCheckin, type DraftValues } from './submit';

function stepFor(task: PlanTask): { step: number; max: number } {
  if (task.verify === 'steps' || /step/i.test(task.unit ?? '')) return { step: 500, max: 100_000 };
  if (task.type === 'minutes') return { step: 5, max: 1_440 };
  return { step: 1, max: 1_000 };
}

function deviceTimeZone(fallback: string): string {
  const tz = getCalendars()[0]?.timeZone;
  return tz && isValidTimeZone(tz) ? tz : fallback;
}

interface FormProps {
  card: TodayCard;
  source: TodaySource;
  date: string;
  onDone: (go: () => void) => void;
}

function TaskInput({
  task,
  value,
  onChange,
  first,
  hint,
}: {
  task: PlanTask;
  value: number | boolean | undefined;
  onChange: (v: number | boolean) => void;
  first: boolean;
  /** Verification line under the target ("Verified from your GitHub activity"). */
  hint?: { text: string; verified: boolean } | null;
}) {
  const { step, max } = stepFor(task);
  return (
    <View style={[styles.taskRow, first && styles.taskRowFirst]}>
      <View style={styles.taskTexts}>
        <Text variant="bodyMedium">{task.title}</Text>
        <Text variant="footnote" color="label2">
          {targetLabel(task)}
        </Text>
        {hint ? (
          <View style={styles.hint} accessibilityLiveRegion="polite">
            {hint.verified ? (
              <BadgeCheck size={14} color={colors.success} strokeWidth={iconStroke} />
            ) : null}
            <Text variant="caption" color={hint.verified ? 'success' : 'label2'}>
              {hint.text}
            </Text>
          </View>
        ) : null}
      </View>
      {task.type === 'check' ? (
        <Switch value={value === true} onValueChange={onChange} accessibilityLabel={task.title} />
      ) : (
        <Stepper
          value={typeof value === 'number' ? value : 0}
          onChange={onChange}
          label={stepperUnit(task)}
          step={step}
          max={max}
        />
      )}
    </View>
  );
}

function CheckinForm({ card, source, date, onDone }: FormProps) {
  const me = useMe();
  const toast = useToast();
  const ch = card.challenge;
  const isToday = date === card.today;
  const n = rawDayNumber(date, ch.startDate);
  const day = isToday ? card.day : dayFor(source, ch, n);
  const existing =
    source.checkins.find(
      (c) => c.challengeId === ch.id && c.userId === me.id && c.localDate === date,
    ) ?? null;

  const [draft, setDraft] = useState<DraftValues>(() => readDraft(ch.id, date, existing));
  const [note, setNote] = useState(existing?.note ?? '');
  const [photo, setPhoto] = useState<string | null>(() => localProofUri(ch.id, date));
  const [saving, setSaving] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const online = useOnline();
  const shareDays = photoRetentionDays(me.plan, card.squad.isPro);
  const canShare = shareDays > 0;

  // Fill in what GitHub / LeetCode / Codeforces already show; never blocks a manual check-in.
  const tasks = day && !day.rest ? day.tasks : null;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const verifyKey = tasks ? tasks.map((x) => x.verify ?? '').join('|') : '';
  useEffect(() => {
    const current = tasksRef.current;
    if (!current || !current.some((x) => x.verify)) return;
    let alive = true;
    prefillFromVerification(current, date, me.timezone)
      .then((p) => {
        if (!alive) return;
        setPrefill(p);
        setDraft((cur) => {
          const next = { ...cur };
          for (const [i, v] of Object.entries(p.values)) {
            const k = Number(i);
            if (next[k] === undefined || next[k] === false || next[k] === 0) next[k] = v;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [verifyKey, date, me.timezone]);

  const hintFor = (i: number) => {
    if (!prefill) return null;
    const source = prefill.sources[i];
    if (source && draft[i] === prefill.values[i]) {
      const name =
        source === 'steps'
          ? t(
              Platform.OS === 'ios'
                ? 'integrations.name_appleHealth'
                : 'integrations.name_healthConnect',
            )
          : t(`integrations.name_${source}`);
      return { text: t('integrations.verified', { source: name }), verified: true };
    }
    return prefill.failed.includes(i)
      ? { text: t('integrations.couldNot'), verified: false }
      : null;
  };

  const update = (i: number, v: number | boolean) => {
    const next = { ...draft, [i]: v };
    setDraft(next);
    writeDraft(ch.id, date, next);
  };

  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (res.canceled || !res.assets[0]) return;
      setPhoto(await saveLocalProof(ch.id, date, res.assets[0].uri));
    } catch {
      // G5: explain and offer the phone's settings.
      Alert.alert(t('checkin.photoDenied'), undefined, [
        { text: t('common.notNow'), style: 'cancel' },
        {
          text: t('notificationsSettings.openSettings'),
          onPress: () => void Linking.openSettings(),
        },
      ]);
    }
  };

  const submit = async (honestMiss: boolean) => {
    if (!day) return;
    setSaving(true);
    try {
      const { db, outbox } = getRuntime();
      const before = globalStreak(source.streaks);
      const { checkin, countsDone } = await submitCheckin({
        db,
        outbox,
        userId: me.id,
        timezone: deviceTimeZone(me.timezone),
        challengeId: ch.id,
        localDate: date,
        dayNumber: n,
        tasks: day.tasks,
        draft,
        note,
        honestMiss,
        hasPhoto: !honestMiss && !!photo,
        sharePhotoUri: canShare ? photo : null,
        partialCounts: card.squad.partialCounts,
        existing,
        verified: prefill ? verifiedIndices(prefill, draft) : [],
      });
      clearDraft(ch.id, date);
      track('checkin', {
        status: checkin.status,
        edit: !!existing,
        backfill: !isToday,
        tasks: day.tasks.length,
      });
      const params = {
        challengeId: ch.id,
        date,
        n: String(n),
        status: checkin.status,
        streak: String(predictedStreak(before, date, countsDone)),
        counts: countsDone ? '1' : '0',
        since: checkin.updatedAt,
      };
      onDone(() => router.replace({ pathname: '/checkin/success', params }));
    } catch {
      toast.show({ message: t('checkin.saveFailed'), kind: 'error' });
      setSaving(false);
    }
  };

  const confirmMiss = () =>
    Alert.alert(t('checkin.honestTitle'), t('checkin.honestBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('checkin.honestConfirm'), onPress: () => void submit(true) },
    ]);

  if (!day || day.rest) {
    return (
      <View style={styles.message}>
        <Text variant="callout" color="label2">
          {day?.rest ? t('checkin.restDay') : t('checkin.planMissing')}
        </Text>
        <Button
          label={t('common.close')}
          variant="secondary"
          onPress={() => onDone(() => router.back())}
        />
      </View>
    );
  }

  return (
    <>
      {!online ? <OfflineBanner /> : null}
      <View>
        {day.tasks.map((task, i) => (
          <TaskInput
            key={task.id}
            task={task}
            value={draft[i]}
            onChange={(v) => update(i, v)}
            first={i === 0}
            hint={hintFor(i)}
          />
        ))}
      </View>

      <TextField
        label={t('checkin.noteLabel')}
        placeholder={t('checkin.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        multiline
        counter={TEXT_LIMITS.checkinNote}
        containerStyle={styles.note}
        testID="checkin-note"
      />

      {photo ? (
        <View style={styles.photoRow}>
          <Image
            source={{ uri: photo }}
            style={styles.thumb}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.photoTexts}>
            <Text variant="bodyMedium">{t('checkin.photoAdded')}</Text>
            <Text variant="caption" color="label2">
              {canShare
                ? t('checkin.photoAddedShared', { n: shareDays })
                : t('checkin.photoAddedBody')}
            </Text>
          </View>
          <IconButton
            icon={X}
            size={36}
            background="surface3"
            color="onControl"
            accessibilityLabel={t('checkin.photoRemove')}
            onPress={() => {
              removeLocalProof(ch.id, date);
              setPhoto(null);
            }}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => void pickPhoto()}
          accessibilityRole="button"
          accessibilityLabel={t('checkin.photoAdd')}
          accessibilityHint={
            canShare ? t('checkin.photoShared', { n: shareDays }) : t('checkin.photoFree')
          }
          style={styles.photoButton}
          testID="checkin-photo"
        >
          <ImagePlus size={22} color={colors.label} strokeWidth={iconStroke} />
          <View style={styles.photoTexts}>
            <Text variant="bodyMedium">{t('checkin.photoAdd')}</Text>
            <Text variant="caption" color="label2">
              {canShare ? t('checkin.photoShared', { n: shareDays }) : t('checkin.photoFree')}
            </Text>
          </View>
        </Pressable>
      )}

      <View style={styles.actions}>
        <Button
          label={existing ? t('checkin.update') : t('checkin.submit')}
          onPress={() => void submit(false)}
          loading={saving}
          testID="checkin-submit"
        />
        <Text variant="caption" color="label3" align="center">
          {t('checkin.editNote')}
        </Text>
        {existing?.status !== 'honest_miss' ? (
          <Button
            label={t('checkin.honestMiss')}
            variant="ghost"
            size="md"
            onPress={confirmMiss}
            disabled={saving}
            testID="checkin-honest"
          />
        ) : null}
      </View>
    </>
  );
}

/** B4: check-in sheet (route `checkin/[challengeId]`, `next` picks the first pending challenge). */
export function CheckinSheetScreen() {
  const { challengeId, date } = useLocalSearchParams<{ challengeId: string; date?: string }>();
  const today = useToday();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const after = useRef<() => void>(() => router.back());

  const close = (go: () => void = () => router.back()) => {
    after.current = go;
    setOpen(false);
  };

  const cards = useMemo(() => today.data?.cards ?? [], [today.data]);
  const pending = useMemo(() => pendingCards(cards), [cards]);
  const card =
    cards.find((c) => c.challenge.id === (selected ?? challengeId)) ??
    (challengeId === 'next' && !selected ? (pending[0] ?? null) : null);
  const localDate = date ?? card?.today ?? '';
  const isToday = !!card && localDate === card.today;
  const showPicker = !date && pending.length > 1 && !!card && pending.includes(card);
  const n = card ? rawDayNumber(localDate, card.challenge.startDate) : 0;

  return (
    <BottomSheet
      visible={open}
      onClose={() => close()}
      onClosed={() => after.current()}
      top={card ? 128 : undefined}
      accessibilityLabel={card ? t('checkin.title', { n }) : t('tabs.checkIn')}
    >
      {!today.data ? null : !card ? (
        <View style={styles.message}>
          <Text variant="title2">{t('checkin.nothingPending')}</Text>
          <Button label={t('common.close')} variant="secondary" onPress={() => close()} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.head}>
            <View style={styles.headTexts}>
              <Text variant="title2" style={styles.title} accessibilityRole="header">
                {isToday ? t('checkin.title', { n }) : t('checkin.titleYesterday', { n })}
              </Text>
              <Text variant="footnote" color="label2">
                {t('checkin.subtitle', { challenge: card.challenge.title, squad: card.squad.name })}
              </Text>
            </View>
            <IconButton
              icon={X}
              size={36}
              background="surface3"
              color="onControl"
              accessibilityLabel={t('common.close')}
              onPress={() => close()}
            />
          </View>
          {showPicker ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.picker}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('checkin.pickerLabel')}
            >
              {pending.map((c) => (
                <ChipToggle
                  key={c.challenge.id}
                  label={c.challenge.title}
                  role="radio"
                  selected={c.challenge.id === card.challenge.id}
                  onPress={() => setSelected(c.challenge.id)}
                />
              ))}
            </ScrollView>
          ) : null}
          <CheckinForm
            key={`${card.challenge.id}:${localDate}`}
            card={card}
            source={today.data.source}
            date={localDate}
            onDone={(go) => {
              // Keep this challenge on screen while the sheet animates away.
              setSelected(card.challenge.id);
              close(go);
            }}
          />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  headTexts: { flex: 1, gap: 2 },
  title: { fontSize: 24, lineHeight: 30 },
  picker: { gap: 8, paddingVertical: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  taskRowFirst: {},
  taskTexts: { flex: 1, gap: 4, minWidth: 0 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  note: { marginTop: 18 },
  photoButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.strong,
    borderRadius: radius.input,
    minHeight: 56,
  },
  photoRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.input,
    backgroundColor: colors.surface2,
  },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  photoTexts: { flex: 1, gap: 2 },
  actions: { marginTop: 20, gap: 10 },
  message: { gap: 16, paddingVertical: 12 },
});
