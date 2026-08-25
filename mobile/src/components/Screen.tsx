import React from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  // Tab bar ostida qolmasligi uchun pastki joy
  bottomInset?: number;
  style?: ViewStyle;
  edges?: { top?: boolean; bottom?: boolean };
}

export function Screen({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  padded = true,
  bottomInset = 0,
  style,
  edges = { top: false, bottom: false },
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingTop: edges.top ? insets.top : 0,
  };

  if (scroll) {
    return (
      <View style={[containerStyle, style]}>
        <ScrollView
          contentContainerStyle={[
            padded && styles.padded,
            { paddingBottom: bottomInset + (edges.bottom ? insets.bottom : 0) + spacing.xxl },
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, padded && styles.padded, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
