import React, { useState } from 'react';
import { TextInput, View, TextInputProps, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, fontSize } from '../theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  secure?: boolean;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, secure, containerStyle, style, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText variant="small" tone="soft" weight="500" style={{ marginBottom: spacing.xs + 2 }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceSunk,
            borderColor: error ? colors.danger : focused ? colors.brand : colors.line,
            borderRadius: radius.input,
          },
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.inkFaint}
          style={[
            styles.input,
            { color: colors.ink, fontSize: fontSize.bodyLarge },
            style,
          ]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityLabel={hidden ? "Parolni ko'rsatish" : 'Parolni yashirish'}
            style={styles.eye}
          >
            <AppText variant="small" tone="soft">
              {hidden ? "Ko'rsatish" : 'Yashirish'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" tone="danger" style={{ marginTop: spacing.xs }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  eye: {
    paddingLeft: spacing.sm,
  },
});
