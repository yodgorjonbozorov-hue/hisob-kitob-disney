import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { Input } from '../../components/Input';
import { PrimaryButton } from '../../components/Button';
import { useTheme } from '../../theme/ThemeContext';
import { createQarz } from '../../api/debts';
import { ApiError, NetworkError } from '../../api/client';
import { formatAmountInput, parseAmountInput } from '../../utils/money';
import { bugun } from '../../utils/sana';
import { spacing, radius, fontSize } from '../../theme/tokens';
import { t } from '../../i18n/uz';

// Yangi qarz (olinadigan). Mijoz telefoni majburiy — backend talabi
// (kimdan undirishni bilish uchun).
export default function QarzYangiScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [ism, setIsm] = useState('');
  const [tel, setTel] = useState('');
  const [summaText, setSummaText] = useState('');
  const [muddat, setMuddat] = useState('');
  const [izoh, setIzoh] = useState('');
  const [xato, setXato] = useState<string | null>(null);

  const saqlash = useMutation({
    mutationFn: createQarz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qarzdorlar'] });
      queryClient.invalidateQueries({ queryKey: ['qarz-dashboard'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (e instanceof NetworkError) setXato(t().umumiy.tarmoqXato);
      else if (e instanceof ApiError) setXato(e.message);
      else setXato(t().umumiy.xato);
    },
  });

  const yuborish = () => {
    setXato(null);
    const summa = parseAmountInput(summaText);
    if (!ism.trim()) {
      setXato('Mijoz ismini kiriting');
      return;
    }
    if (!tel.trim()) {
      setXato('Mijoz telefonini kiriting');
      return;
    }
    if (!summa) {
      setXato("Qarz summasi 0 dan katta bo'lishi kerak");
      return;
    }
    if (muddat && !/^\d{4}-\d{2}-\d{2}$/.test(muddat)) {
      setXato("Muddat YYYY-MM-DD ko'rinishida bo'lsin");
      return;
    }
    if (saqlash.isPending) return;
    saqlash.mutate({
      turi: 'olinadigan',
      mijozNomi: ism.trim(),
      mijozTel: tel.trim(),
      jamiSumma: summa,
      sana: bugun(),
      muddat: muddat || null,
      izoh: izoh.trim() || null,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <AppText variant="title" weight="700">
          {t().qoshish.qarzBerish}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Input label="Mijoz ismi" value={ism} onChangeText={setIsm} maxLength={100} autoFocus />
        <Input
          label="Telefon"
          value={tel}
          onChangeText={setTel}
          keyboardType="phone-pad"
          placeholder="+998 90 123 45 67"
          maxLength={30}
        />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="small" tone="soft" weight="500">
            Qarz summasi
          </AppText>
          <View
            style={[
              styles.summaWrap,
              { backgroundColor: colors.surfaceSunk, borderColor: colors.line, borderRadius: radius.card },
            ]}
          >
            <TextInput
              value={summaText}
              onChangeText={(v) => setSummaText(formatAmountInput(v))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.inkFaint}
              style={{
                flex: 1,
                fontSize: fontSize.headline,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: colors.ink,
                paddingVertical: spacing.md,
              }}
            />
            <AppText variant="body" tone="faint" weight="600">
              so'm
            </AppText>
          </View>
        </View>
        <Input
          label="To'lov muddati (ixtiyoriy)"
          value={muddat}
          onChangeText={setMuddat}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Input label={t().moliya.izoh} value={izoh} onChangeText={setIzoh} maxLength={500} />

        {xato ? (
          <AppText variant="small" tone="danger">
            {xato}
          </AppText>
        ) : null}

        <PrimaryButton
          title={t().umumiy.saqlash}
          onPress={yuborish}
          loading={saqlash.isPending}
          disabled={saqlash.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
});
