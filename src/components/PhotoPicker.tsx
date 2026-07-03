import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { newId } from '@/db/id';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { persistPhoto } from '@/utils/photos';

type Props = {
  uri: string | null;
  onPicked: (persistentUri: string) => void;
};

/**
 * Photo capture per the brief: a visual record attached to a recipe/food.
 * Photos live in rounded cards; illustrations never mix into these.
 */
export function PhotoPicker({ uri, onPicked }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    try {
      onPicked(persistPhoto(result.assets[0].uri, newId()));
    } catch (error) {
      Alert.alert('Photo error', String(error));
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    handleResult(await ImagePicker.launchCameraAsync({ quality: 0.7 }));
  };

  const pickFromLibrary = async () => {
    handleResult(await ImagePicker.launchImageLibraryAsync({ quality: 0.7 }));
  };

  return (
    <View style={styles.container}>
      {uri ? (
        <Image source={{ uri }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.buttonLabel}>{t('photo.take')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={pickFromLibrary}>
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.buttonLabel}>{t('photo.gallery')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    photo: {
      width: '100%',
      height: 180,
      borderRadius: radius.card,
    },
    placeholder: {
      backgroundColor: colors.lime,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    buttonLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '600',
    },
  });
}
