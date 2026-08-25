import React from 'react';
import { View, TextInput, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, fontSize } from '../theme/tokens';
import { t } from '../i18n/uz';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchInput({ value, onChangeText, placeholder, style }: SearchInputProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surfaceSunk, borderRadius: radius.input, borderColor: colors.line },
        style,
      ]}
    >
      <Ionicons name="search" size={17} color={colors.inkFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t().umumiy.qidirish}
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, { color: colors.ink, fontSize: fontSize.body }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Tozalash">
          <Ionicons name="close-circle" size={17} color={colors.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 42,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
});
