import {
  CATEGORIES,
  chatUrlSchema,
  HARD_CAPS,
  limitsFor,
  TEXT_LIMITS,
  type Category,
  type Privacy,
} from '@sparksquad/shared';
import { and, eq } from 'drizzle-orm';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ChipToggle,
  Screen,
  SegmentedControl,
  Stepper,
  Text,
  TextField,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { members } from '../../../lib/db/schema';
import { qk } from '../../../lib/query/keys';
import { useLocalQuery } from '../../../lib/query/useLocalQuery';
import { useMe } from '../../auth/SessionProvider';
import { useConfig } from '../../system/useConfig';
import { CreateHeader } from '../components';
import { useCreateFlow } from '../flow';

/** D1: Step 1 of 3. Name, description, category, privacy, member limit, chat link. */
export function BasicsScreen() {
  const me = useMe();
  const toast = useToast();
  const config = useConfig();
  const { flow, update } = useCreateFlow();
  const b = flow.basics;
  const [name, setName] = useState(b?.name ?? '');
  const [description, setDescription] = useState(b?.description ?? '');
  const [category, setCategory] = useState<Category>(
    b?.category ?? (me.interests[0] as Category | undefined) ?? 'career',
  );
  const [privacy, setPrivacy] = useState<Privacy>(b?.privacy ?? 'private');
  const [limit, setLimit] = useState(b?.memberLimit ?? HARD_CAPS.maxMembersPerSquad);
  const [chatUrl, setChatUrl] = useState(b?.chatUrl ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [chatError, setChatError] = useState<string | undefined>();

  const owned = useLocalQuery([...qk.local, 'owned', me.id], async (db) => {
    const rows = await db
      .select({ id: members.squadId })
      .from(members)
      .where(
        and(eq(members.userId, me.id), eq(members.role, 'owner'), eq(members.status, 'active')),
      )
      .all();
    return rows.length;
  });
  const ownLimit = config.data?.limits[me.plan]?.squadsOwned ?? limitsFor(me.plan).squadsOwned;

  const next = () => {
    if (name.trim().length < 2) {
      setNameError(t('create.nameShort'));
      return;
    }
    const url = chatUrl.trim();
    if (url && !chatUrlSchema.safeParse(url).success) {
      setChatError(t('create.chatInvalid'));
      return;
    }
    // The server enforces this too; checking here saves a dead end at the last step.
    if ((owned.data ?? 0) >= ownLimit) {
      toast.show({ message: t('create.ownLimit', { n: ownLimit }), kind: 'error' });
      return;
    }
    update({
      basics: {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        privacy,
        memberLimit: limit,
        chatUrl: url || undefined,
      },
    });
    router.push(flow.plan ? '/create/review' : '/create/plan');
  };

  return (
    <Screen
      header={<CreateHeader step={1} />}
      footer={<Button label={t('create.continue')} onPress={next} testID="basics-continue" />}
    >
      <Text variant="title1" accessibilityRole="header">
        {t('create.basicsTitle')}
      </Text>
      <Text variant="body" color="label2" style={styles.body}>
        {t('create.basicsBody')}
      </Text>
      <View style={styles.form}>
        <TextField
          label={t('create.name')}
          placeholder={t('create.namePlaceholder')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameError(undefined);
          }}
          error={nameError}
          maxLength={TEXT_LIMITS.squadName}
          testID="squad-name"
        />
        <TextField
          label={t('create.description')}
          placeholder={t('create.descriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          multiline
          counter={TEXT_LIMITS.squadDescription}
        />
        <View>
          <Text variant="footnote" color="label2" style={styles.label}>
            {t('create.category')}
          </Text>
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('create.category')}
          >
            {CATEGORIES.map((c) => (
              <ChipToggle
                key={c}
                label={t(`categories.${c}`)}
                role="radio"
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </View>
        <View>
          <Text variant="footnote" color="label2" style={styles.label}>
            {t('create.privacy')}
          </Text>
          <SegmentedControl
            role="radiogroup"
            accessibilityLabel={t('create.privacy')}
            value={privacy}
            onChange={setPrivacy}
            options={[
              { value: 'private', label: t('create.privacyPrivate') },
              { value: 'public', label: t('create.privacyPublic') },
            ]}
          />
          <Text variant="caption" color="label3" style={styles.help}>
            {t(privacy === 'private' ? 'create.privacyHelpPrivate' : 'create.privacyHelpPublic')}
          </Text>
        </View>
        <View style={styles.row}>
          <Text variant="body" style={styles.flex}>
            {t('create.memberLimit')}
          </Text>
          <Stepper
            value={limit}
            onChange={setLimit}
            label={t('create.memberLimit')}
            min={2}
            max={HARD_CAPS.maxMembersPerSquad}
          />
        </View>
        <TextField
          label={t('create.chatUrl')}
          placeholder={t('settings.chatPlaceholder')}
          value={chatUrl}
          onChangeText={(v) => {
            setChatUrl(v);
            setChatError(undefined);
          }}
          error={chatError}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 6, marginBottom: 18 },
  form: { gap: 16 },
  label: { marginBottom: 6 },
  help: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  flex: { flex: 1 },
});
