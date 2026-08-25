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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { Input } from '../components/Input';
import { PrimaryButton } from '../components/Button';
import { BottomSheet } from '../components/BottomSheet';
import { useTheme } from '../theme/ThemeContext';
import { fetchCategories } from '../api/transactions';
import { createDeal } from '../api/crm';
import { ApiError, NetworkError } from '../api/client';
import { formatAmountInput, parseAmountInput } from '../utils/money';
import { bugun } from '../utils/sana';
import { spacing, radius, fontSize } from '../theme/tokens';
import { t } from '../i18n/uz';

// Yangi CRM buyurtma. Kategoriya — moliya KIRIM kategoriyasi (backend talabi).
export default function CrmYangiScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [nomi, setNomi] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [summaText, setSummaText] = useState('');
  const [mijozIsm, setMijozIsm] = useState('');
  const [mijozTel, setMijozTel] = useState('');
  const [izoh, setIzoh] = useState('');
  const [katOchiq, setKatOchiq] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const kategoriyalar = useQuery({
    queryKey: ['categories', 'kirim'],
    queryFn: () => fetchCategories('kirim'),
  });
  const tanlangan = kategoriyalar.data?.find((c) => c.id === categoryId) ?? null;

  const saqlash = useMutation({
    mutationFn: createDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-board'] });
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
    if (!nomi.trim()) {
      setXato('Xizmat/buyurtma nomini kiriting');
      return;
    }
    if (!categoryId) {
      setXato('Kategoriya tanlang');
      return;
    }
    if (saqlash.isPending) return;
    saqlash.mutate({
      nomi: nomi.trim(),
      categoryId,
      summa: parseAmountInput(summaText) ?? 0,
      kontaktIsm: mijozIsm.trim() || null,
      kontaktTel: mijozTel.trim() || null,
      sana: bugun(),
      izoh: izoh.trim() || null,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.line,
            paddingTop: Platform.OS === 'android' ? insets.top + spacing.sm : spacing.lg,
          },
        ]}
      >
        <AppText variant="title" weight="700">
          {t().qoshish.crmBuyurtma}
        </AppText>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t().umumiy.yopish}>
          <Ionicons name="close" size={24} color={colors.inkSoft} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="Xizmat / buyurtma nomi"
          value={nomi}
          onChangeText={setNomi}
          placeholder="Masalan: To'y bezagi"
          maxLength={200}
          autoFocus
        />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="small" tone="soft" weight="500">
            {t().moliya.kategoriya}
          </AppText>
          <Pressable
            onPress={() => setKatOchiq(true)}
            style={[
              styles.selector,
              { backgroundColor: colors.surfaceSunk, borderColor: colors.line, borderRadius: radius.input },
            ]}
          >
            <AppText variant="bodyLarge" tone={tanlangan ? 'ink' : 'faint'}>
              {tanlangan?.nomi ?? 'Tanlang...'}
            </AppText>
            <Ionicons name="chevron-down" size={18} color={colors.inkFaint} />
          </Pressable>
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="small" tone="soft" weight="500">
            Narx
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
              {t().moliya.som}
            </AppText>
          </View>
        </View>

        <Input label="Mijoz ismi" value={mijozIsm} onChangeText={setMijozIsm} maxLength={100} />
        <Input
          label="Mijoz telefoni"
          value={mijozTel}
          onChangeText={setMijozTel}
          keyboardType="phone-pad"
          placeholder="+998..."
          maxLength={30}
        />
        <Input label={t().moliya.izoh} value={izoh} onChangeText={setIzoh} maxLength={1000} />

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

      <BottomSheet visible={katOchiq} onClose={() => setKatOchiq(false)} title={t().moliya.kategoriya} scroll>
        <View style={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
          {(kategoriyalar.data ?? []).map((c) => {
            const faol = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCategoryId(c.id);
                  setKatOchiq(false);
                }}
                style={[
                  styles.katRow,
                  { backgroundColor: faol ? colors.brandWash : 'transparent', borderRadius: radius.input },
                ]}
              >
                <AppText variant="bodyLarge" weight={faol ? '600' : '400'}>
                  {c.nomi}
                </AppText>
                {faol ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: 52,
    borderWidth: 1,
  },
  summaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  katRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
