import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { MoneyText } from './MoneyText';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/tokens';
import { tolovYorligi } from '../utils/guruhlash';
import type { TransactionDTO } from '../api/types';

interface TransactionRowProps {
  item: TransactionDTO;
  // Kategoriya nomi ko'rsatilsinmi (kategoriya ichida kerak emas)
  showCategory?: boolean;
}

export function TransactionRow({ item, showCategory = false }: TransactionRowProps) {
  const { colors } = useTheme();
  const kirim = item.turi === 'kirim';
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <View
        style={[
          styles.icon,
          { backgroundColor: kirim ? colors.incomeWash : colors.expenseWash, borderRadius: radius.input },
        ]}
      >
        <Ionicons
          name={kirim ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={kirim ? colors.income : colors.expense}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight="500" numberOfLines={1}>
          {item.izoh?.trim() || (showCategory ? item.category?.nomi : null) || (kirim ? 'Kirim' : 'Chiqim')}
        </AppText>
        <AppText variant="caption" tone="faint" numberOfLines={1}>
          {[
            showCategory && item.izoh?.trim() ? item.category?.nomi : null,
            tolovYorligi(item),
            item.user?.ism,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
      <MoneyText value={item.summa} turi={item.turi} showSign variant="bodyLarge" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
