import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { insertMealSlot } from '@/db/repositories/households';
import { useMealSlots } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { slotDisplayLabel } from '@/utils/mealSlots';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Position = { afterSlotId: string | null; labelKey: 'beforeFirst' | 'between' | 'afterLast'; labelParams: Record<string, string> };

function midpointTime(before: string | undefined, after: string | undefined): string {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  if (before && after) return toTime(Math.round((toMinutes(before) + toMinutes(after)) / 2));
  if (before) return toTime(toMinutes(before) + 30);
  if (after) return toTime(toMinutes(after) - 30);
  return '12:00';
}

type Props = {
  visible: boolean;
  householdId: string;
  onClose: () => void;
  onAdded: (slotKey: string) => void;
};

/** Two-step "+ Add meal" flow: pick where to insert, then name/time it. Positions are built from the household's currently-enabled slots (useMealSlots), matching what MealSlotsPicker already renders. */
export function AddMealSlotModal({ visible, householdId, onClose, onAdded }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useMealSlots(householdId);

  const [position, setPosition] = useState<Position | null>(null);
  const [name, setName] = useState('');
  const [time, setTime] = useState('12:00');

  const reset = () => {
    setPosition(null);
    setName('');
    setTime('12:00');
  };

  const close = () => {
    reset();
    onClose();
  };

  const positions: Position[] = [];
  if (slots.length > 0) {
    positions.push({
      afterSlotId: null,
      labelKey: 'beforeFirst',
      labelParams: { slot: slotDisplayLabel(t, slots[0]) },
    });
    for (let i = 0; i < slots.length - 1; i += 1) {
      positions.push({
        afterSlotId: slots[i].id,
        labelKey: 'between',
        labelParams: { before: slotDisplayLabel(t, slots[i]), after: slotDisplayLabel(t, slots[i + 1]) },
      });
    }
    positions.push({
      afterSlotId: slots[slots.length - 1].id,
      labelKey: 'afterLast',
      labelParams: { slot: slotDisplayLabel(t, slots[slots.length - 1]) },
    });
  }

  const selectPosition = (p: Position) => {
    const beforeSlot = slots.find((s) => s.id === p.afterSlotId);
    const afterIndex = p.afterSlotId ? slots.findIndex((s) => s.id === p.afterSlotId) + 1 : 0;
    const afterSlot = slots[afterIndex];
    setTime(midpointTime(beforeSlot?.time, afterSlot?.time));
    setPosition(p);
  };

  const add = async () => {
    if (!position || !TIME_RE.test(time)) return;
    const slotId = await insertMealSlot(db, householdId, {
      afterSlotId: position.afterSlotId,
      label: name.trim() || t('addMeal.namePlaceholder'),
      time,
    });
    onAdded(`custom_${slotId}`);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('addMeal.title')}</Text>

          {!position ? (
            <>
              <Text style={styles.prompt}>{t('addMeal.positionPrompt')}</Text>
              {positions.map((p, i) => (
                <Pressable key={i} style={styles.positionRow} onPress={() => selectPosition(p)}>
                  <Text style={styles.positionLabel}>{t(`addMeal.${p.labelKey}`, p.labelParams)}</Text>
                </Pressable>
              ))}
              <Button label={t('addMeal.cancel')} variant="secondary" onPress={close} />
            </>
          ) : (
            <>
              <TextField label={t('addMeal.nameLabel')} value={name} onChangeText={setName} placeholder={t('addMeal.namePlaceholder')} />
              <TextField label={t('addMeal.timeLabel')} value={time} onChangeText={setTime} placeholder="HH:MM" />
              <View style={styles.actions}>
                <Button label={t('addMeal.cancel')} variant="secondary" onPress={close} style={styles.actionButton} />
                <Button label={t('addMeal.add')} onPress={add} disabled={!TIME_RE.test(time)} style={styles.actionButton} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    prompt: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.sm,
    },
    positionRow: {
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    positionLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
  });
}
