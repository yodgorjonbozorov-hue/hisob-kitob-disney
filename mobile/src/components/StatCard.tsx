import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { MoneyText } from './MoneyText';
import { Card } from './Card';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

interface StatCardProps {
  label: string;
  value: number;
  turi?: 'kirim' | 'chiqim' | 'neytral' | 'qarz';
  // O'tgan davrga nisbatan o'zgarish (foiz), null — taqqoslab bo'lmaydi
  changePct?: number | null;
  compact?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  sub?: string;
}

export function StatCard({ label, value, turi = 'neytral', changePct, compact = true, onPress, style, sub }: StatCardProps) {
  const { colors } = useTheme();
  const ijobiy = changePct != null && changePct >= 0;
  return (
    <Card onPress={onPress} style={StyleSheet.flatten([styles.card, style])}>
      <AppText variant="small" tone="soft" weight="500">
        {label}
      </AppText>
      <MoneyText value={value} turi={turi} compact={compact} variant="headline" />
      {changePct != null ? (
        <View style={styles.changeRow}>
          <Ionicons
            name={ijobiy ? 'trending-up' : 'trending-down'}
            size={13}
            color={ijobiy ? colors.income : colors.expense}
          />
          <AppText variant="caption" style={{ color: ijobiy ? colors.income : colors.expense }} weight="600">
            {Math.abs(Math.round(changePct))}%
          </AppText>
          <AppText variant="caption" tone="faint">
            o'tgan oyga nisbatan
          </AppText>
        </View>
      ) : sub ? (
        <AppText variant="caption" tone="faint">
          {sub}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    flex: 1,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
