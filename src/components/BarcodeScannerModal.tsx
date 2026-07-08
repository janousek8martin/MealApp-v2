import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const FOOD_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
};

/** Scans a food barcode (EAN/UPC) via the device camera; the caller looks it up (Open Food Facts) or falls back to manual entry. */
export function BarcodeScannerModal({ visible, onClose, onScanned }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  // Guards against onBarcodeScanned firing repeatedly for the same frame burst.
  const handledRef = useRef(false);

  useEffect(() => {
    if (visible) handledRef.current = false;
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, permission?.granted]);

  const handleScanned = (result: BarcodeScanningResult) => {
    if (handledRef.current) return;
    handledRef.current = true;
    onScanned(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('foodEdit.scanBarcodeTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODE_TYPES] }}
            onBarcodeScanned={handleScanned}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>{t('foodEdit.cameraPermissionNeeded')}</Text>
            <Button label={t('foodEdit.grantCameraPermission')} onPress={() => void requestPermission()} />
          </View>
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
    camera: {
      flex: 1,
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    permissionBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    permissionText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      textAlign: 'center',
    },
  });
}
