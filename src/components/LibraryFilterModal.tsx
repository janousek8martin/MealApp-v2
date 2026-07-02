import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, typography } from '@/theme/tokens';

export type FilterOption = { value: string; label: string };

export type FilterSection = {
  key: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  sections: FilterSection[];
};

/** Full-screen filter modal shared by the recipes and foods segments of the library. */
export function LibraryFilterModal({ visible, onClose, onReset, sections }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('library.filterModal.title')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {sections
            .filter((section) => section.options.length > 0)
            .map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.chips}>
                  {section.options.map((option) => {
                    const selected = section.selected.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => section.onToggle(option.value)}
                        style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" style={styles.resetButton} onPress={onReset}>
            <Text style={styles.resetLabel}>{t('library.filterModal.reset')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.applyButton} onPress={onClose}>
            <Text style={styles.applyLabel}>{t('library.filterModal.apply')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  content: {
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: colors.onPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetLabel: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
  },
  applyLabel: {
    color: colors.onPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
