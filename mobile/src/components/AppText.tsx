import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontSize } from '../theme/tokens';

type Variant = 'caption' | 'small' | 'body' | 'bodyLarge' | 'title' | 'headline' | 'display';
type Tone = 'ink' | 'soft' | 'faint' | 'brand' | 'income' | 'expense' | 'debt' | 'danger' | 'inverse';

interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700' | '800';
  center?: boolean;
  tabular?: boolean;
}

export function AppText({
  variant = 'body',
  tone = 'ink',
  weight,
  center,
  tabular,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const toneColor: Record<Tone, string> = {
    ink: colors.ink,
    soft: colors.inkSoft,
    faint: colors.inkFaint,
    brand: colors.brand,
    income: colors.income,
    expense: colors.expense,
    debt: colors.debt,
    danger: colors.danger,
    inverse: colors.brandFg,
  };
  const base: TextStyle = {
    fontSize: fontSize[variant],
    color: toneColor[tone],
    fontWeight: weight ?? (variant === 'display' || variant === 'headline' ? '700' : '400'),
    textAlign: center ? 'center' : undefined,
    fontVariant: tabular ? ['tabular-nums'] : undefined,
    letterSpacing: variant === 'display' || variant === 'headline' ? -0.4 : undefined,
  };
  return <Text {...rest} style={[base, style]} />;
}
