import React, { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Redirect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppText } from '../components/AppText';
import { Input } from '../components/Input';
import { PrimaryButton } from '../components/Button';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/tokens';
import { ApiError, NetworkError } from '../api/client';
import { t } from '../i18n/uz';

export default function LoginScreen() {
  const { status, login } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loginVal, setLoginVal] = useState('');
  const [parol, setParol] = useState('');
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  if (status === 'kirgan') return <Redirect href="/(tabs)" />;

  const kirish = async () => {
    setXato(null);
    if (!loginVal.trim()) {
      setXato('Login kiriting');
      return;
    }
    if (!parol) {
      setXato('Parol kiriting');
      return;
    }
    setYuklanmoqda(true);
    try {
      await login(loginVal.trim(), parol);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (e instanceof NetworkError) setXato(t().umumiy.tarmoqXato);
      else if (e instanceof ApiError) setXato(e.message);
      else if (e instanceof Error) setXato(e.message);
      else setXato(t().umumiy.xato);
    } finally {
      setYuklanmoqda(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xxxl * 2, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo: tarozi belgisi soddalashtirilgan shaklda */}
        <View style={styles.logoWrap}>
          <View style={[styles.logoMark, { backgroundColor: colors.brandWash, borderRadius: radius.card }]}>
            <AppText variant="display" weight="800" style={{ color: colors.brand }}>
              B
            </AppText>
          </View>
          <AppText variant="headline" weight="800" center style={{ marginTop: spacing.lg }}>
            Balansa
          </AppText>
          <AppText variant="body" tone="soft" center style={{ marginTop: spacing.xs }}>
            {t().auth.xushKelibsiz}
          </AppText>
        </View>

        <View style={{ gap: spacing.lg, marginTop: spacing.xxxl }}>
          <Input
            label={t().auth.login}
            value={loginVal}
            onChangeText={setLoginVal}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            placeholder="login yoki +998..."
          />
          <Input
            label={t().auth.parol}
            value={parol}
            onChangeText={setParol}
            secure
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={kirish}
            placeholder="••••••••"
          />
          {xato ? (
            <AppText variant="small" tone="danger">
              {xato}
            </AppText>
          ) : null}
          <PrimaryButton
            title={t().auth.kirish}
            onPress={kirish}
            loading={yuklanmoqda}
            disabled={yuklanmoqda}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logoMark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
