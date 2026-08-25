import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, motion } from '../theme/tokens';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  // true bo'lsa kontent ScrollView ichida (uzun ro'yxatlar uchun)
  scroll?: boolean;
  maxHeightRatio?: number;
}

// Native-uslub pastki varaq: overlay + slide-up animatsiya, Android back tugmasi yopadi.
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  scroll = false,
  maxHeightRatio = 0.85,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(slide, {
        toValue: 1,
        duration: motion.sheet,
        useNativeDriver: true,
      }).start();
    } else {
      slide.setValue(0);
    }
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          {title ? (
            <AppText variant="title" weight="700" style={styles.title}>
              {title}
            </AppText>
          ) : null}
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.lg,
  },
});
