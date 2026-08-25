import React from 'react';
import { Pressable, ActivityIndicator, ViewStyle, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  haptic?: boolean;
}

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <BaseButton {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <BaseButton {...props} variant="secondary" />;
}

export function BaseButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'lg',
  style,
  haptic = true,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? colors.brand
      : variant === 'danger'
        ? colors.expense
        : variant === 'secondary'
          ? colors.surfaceRaised
          : 'transparent';
  const textTone = variant === 'primary' || variant === 'danger' ? 'inverse' : 'ink';
  const textColor =
    variant === 'primary' ? colors.brandFg : variant === 'danger' ? '#FFFFFF' : colors.ink;

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          height: size === 'lg' ? 52 : 44,
          borderRadius: radius.button,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.lineStrong,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText variant={size === 'lg' ? 'bodyLarge' : 'body'} tone={textTone} weight="600" style={{ color: textColor }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
