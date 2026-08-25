import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { MoneyText } from './MoneyText';
import { Card } from './Card';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/tokens';
import type { KategoriyaGuruh } from '../utils/guruhlash';

interface CategoryCardProps {
  guruh: KategoriyaGuruh;
  onPress: () => void;
}

export function CategoryCard({ guruh, onPress }: CategoryCardProps) {
  const { colors } = useTheme();
  const kirim = guruh.turi === 'kirim';
  return (
    <Card onPress={onPress} style={styles.card}>
      <View
        style={[
          styles.badge,
          { backgroundColor: kirim ? colors.incomeWash : colors.expenseWash, borderRadius: radius.input },
        ]}
      >
        <Ionicons
          name={kirim ? 'arrow-down' : 'arrow-up'}
          size={18}
          color={kirim ? colors.income : colors.expense}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyLarge" weight="600" numberOfLines={1}>
          {guruh.nomi}
        </AppText>
        <AppText variant="caption" tone="faint">
          {guruh.soni} ta yozuv · {kirim ? 'Kirim' : 'Chiqim'}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <MoneyText value={guruh.jami} turi={guruh.turi} variant="bodyLarge" />
        <Ionicons name="chevron-forward" size={14} color={colors.inkFaint} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
