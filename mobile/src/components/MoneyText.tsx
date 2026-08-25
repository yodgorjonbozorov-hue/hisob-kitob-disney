import React from 'react';
import { TextStyle } from 'react-native';
import { AppText } from './AppText';
import { formatSum, formatCompact } from '../utils/money';

interface MoneyTextProps {
  value: number;
  // kirim: +yashil, chiqim: -qizil, neytral: rang yo'q
  turi?: 'kirim' | 'chiqim' | 'neytral' | 'qarz';
  compact?: boolean;
  showSign?: boolean;
  showSom?: boolean;
  variant?: 'small' | 'body' | 'bodyLarge' | 'title' | 'headline' | 'display';
  style?: TextStyle;
}

export function MoneyText({
  value,
  turi = 'neytral',
  compact = false,
  showSign = false,
  showSom = false,
  variant = 'body',
  style,
}: MoneyTextProps) {
  const tone =
    turi === 'kirim' ? 'income' : turi === 'chiqim' ? 'expense' : turi === 'qarz' ? 'debt' : 'ink';
  const sign = showSign ? (turi === 'kirim' ? '+' : turi === 'chiqim' ? '-' : '') : '';
  const text = compact ? formatCompact(value) : formatSum(value);
  return (
    <AppText variant={variant} tone={tone} weight="700" tabular style={style}>
      {sign}
      {text}
      {showSom ? " so'm" : ''}
    </AppText>
  );
}
