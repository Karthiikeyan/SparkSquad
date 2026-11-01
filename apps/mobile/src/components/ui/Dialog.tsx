import { useEffect, useState } from 'react';
import { Modal, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, radius } from '../../theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let setter: ((d: DialogState | null) => void) | null = null;

/** App-styled replacement for `Alert.alert` (same arguments). */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  setter?.({ title, message, buttons: buttons?.length ? buttons : [{ text: t('common.ok') }] });
}

/** Drop-in for React Native's `Alert` so call sites keep `Alert.alert(...)`. */
export const Alert = { alert: showDialog };

/** Mounted once near the root; renders whatever `showDialog` asked for. */
export function DialogHost() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  useEffect(() => {
    setter = setDialog;
    return () => {
      setter = null;
    };
  }, []);
  if (!dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const actions = dialog.buttons.filter((b) => b !== cancel);
  const press = (b?: DialogButton) => {
    setDialog(null);
    b?.onPress?.();
  };

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => press(cancel)}
    >
      <View style={styles.scrim}>
        <RNPressable
          style={StyleSheet.absoluteFill}
          onPress={() => press(cancel)}
          accessibilityRole="button"
          accessibilityLabel={cancel?.text ?? t('common.close')}
        />
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text variant="title2" align="center" accessibilityRole="header">
            {dialog.title}
          </Text>
          {dialog.message ? (
            <Text variant="body" color="label2" align="center">
              {dialog.message}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            {actions.map((b, i) => (
              <Button
                key={b.text}
                label={b.text}
                variant={
                  b.style === 'destructive' ? 'destructive' : i === 0 ? 'primary' : 'secondary'
                }
                size="md"
                onPress={() => press(b)}
              />
            ))}
            {cancel ? (
              <Button label={cancel.text} variant="ghost" size="md" onPress={() => press(cancel)} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: 20,
    gap: 10,
  },
  buttons: { gap: 8, marginTop: 8 },
});
