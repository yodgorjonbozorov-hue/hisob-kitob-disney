import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppText } from '../components/AppText';
import { Input } from '../components/Input';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { apiFetch, ApiError } from '../api/client';

// Majburiy parol almashtirish (mustChangePassword). Muvaffaqiyatdan so'ng
// qayta login talab qilinadi — bearer token eski sessiya ma'lumotini saqlaydi.
export default function ParolOzgartirishScreen() {
  const { status, me, logout } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [eski, setEski] = useState('');
  const [yangi, setYangi] = useState('');
  const [yangi2, setYangi2] = useState('');
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  if (status === 'chiqqan') return <Redirect href="/login" />;
  if (me && !me.mustChangePassword) return <Redirect href="/(tabs)" />;

  const saqla = async () => {
    setXato(null);
    if (yangi.length < 8) {
      setXato("Yangi parol kamida 8 belgidan iborat bo'lsin");
      return;
    }
    if (yangi !== yangi2) {
      setXato('Yangi parollar mos kelmadi');
      return;
    }
    setYuklanmoqda(true);
    try {
      await apiFetch('/api/me/password', { method: 'PATCH', body: { eski, yangi } });
      Alert.alert('Parol almashtirildi', 'Endi yangi parol bilan qayta kiring.', [
        { text: 'Kirish', onPress: () => logout() },
      ]);
    } catch (e) {
      setXato(e instanceof ApiError ? e.message : 'Xatolik yuz berdi');
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
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xxxl,
          paddingHorizontal: spacing.xxl,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="headline" weight="700">
          Parolni almashtiring
        </AppText>
        <AppText variant="body" tone="soft">
          Xavfsizlik uchun boshlang'ich parolni yangilash talab qilinadi.
        </AppText>
        <Input label="Joriy parol" value={eski} onChangeText={setEski} secure autoCapitalize="none" />
        <Input label="Yangi parol" value={yangi} onChangeText={setYangi} secure autoCapitalize="none" />
        <Input
          label="Yangi parol (takror)"
          value={yangi2}
          onChangeText={setYangi2}
          secure
          autoCapitalize="none"
        />
        {xato ? (
          <AppText variant="small" tone="danger">
            {xato}
          </AppText>
        ) : null}
        <PrimaryButton title="Saqlash" onPress={saqla} loading={yuklanmoqda} />
        <SecondaryButton title="Chiqish" onPress={logout} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
