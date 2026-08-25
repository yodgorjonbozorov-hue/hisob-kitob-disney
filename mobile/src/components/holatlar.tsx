// Holat komponentlari: bo'sh, xato, skelet yuklanish
import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { SecondaryButton } from './Button';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';
import { NetworkError } from '../api/client';
import { t } from '../i18n/uz';

export function EmptyState({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <View style={styles.center}>
      <AppText variant="bodyLarge" tone="soft" weight="600" center>
        {title ?? t().umumiy.bosh}
      </AppText>
      {subtitle ? (
        <AppText variant="small" tone="faint" center style={{ marginTop: spacing.xs }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof NetworkError
      ? t().umumiy.tarmoqXato
      : error instanceof Error && error.message
        ? error.message
        : t().umumiy.xato;
  return (
    <View style={styles.center}>
      <AppText variant="body" tone="soft" center>
        {message}
      </AppText>
      {onRetry ? (
        <SecondaryButton
          title={t().umumiy.qaytaUrinish}
          onPress={onRetry}
          size="md"
          style={{ marginTop: spacing.lg, alignSelf: 'center', minWidth: 160 }}
        />
      ) : null}
    </View>
  );
}

export function Skeleton({ height = 16, width, style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius: radius.input,
          backgroundColor: colors.surfaceSunk,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        padding: spacing.lg,
        gap: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.line,
      }}
    >
      <Skeleton height={14} width="40%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={22} width={i === 0 ? '65%' : '50%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
});
