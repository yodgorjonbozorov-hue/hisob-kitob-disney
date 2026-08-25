import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { BusinessSwitcher } from './BusinessSwitcher';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

interface HeaderProps {
  // title berilsa oddiy sarlavha; berilmasa biznes tanlagich
  title?: string;
  right?: React.ReactNode;
}

export function Header({ title, right }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + spacing.sm, backgroundColor: colors.canvas },
      ]}
    >
      <View style={styles.row}>
        {title ? (
          <AppText variant="title" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </AppText>
        ) : (
          <BusinessSwitcher />
        )}
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
});
