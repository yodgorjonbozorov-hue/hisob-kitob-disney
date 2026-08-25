import React, { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { Input } from '../components/Input';
import { PrimaryButton } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { BottomSheet } from '../components/BottomSheet';
import { useTheme } from '../theme/ThemeContext';
import {
  fetchCategories,
  createTransaction,
  tasdiqKutilmoqda,
} from '../api/transactions';
import { ApiError, NetworkError } from '../api/client';
import { formatAmountInput, parseAmountInput } from '../utils/money';
import { bugun, kecha, formatSana } from '../utils/sana';
import { spacing, radius, fontSize } from '../theme/tokens';
import { t } from '../i18n/uz';
import type { TolovTuri, TranTuri } from '../api/types';

// Yangi Kirim/Chiqim yozuvi. Hisob mantiqi serverda: summa validatsiyasi,
// kassa tanlash (tolovTuri asosida), tasdiqlash oqimi (202) — hammasi backend'da.
export default function YangiYozuvScreen() {
  const params = useLocalSearchParams<{ turi?: string; categoryId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [turi, setTuri] = useState<TranTuri>(params.turi === 'chiqim' ? 'chiqim' : 'kirim');
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [summaText, setSummaText] = useState('');
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>('naqd');
  const [izoh, setIzoh] = useState('');
  const [sana, setSana] = useState(bugun());
  const [sanaQolda, setSanaQolda] = useState(false);
  const [katOchiq, setKatOchiq] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const kategoriyalar = useQuery({
    queryKey: ['categories', turi],
    queryFn: () => fetchCategories(turi),
  });

  const tanlangan = kategoriyalar.data?.find((c) => c.id === categoryId) ?? null;

  const saqlash = useMutation({
    mutationFn: createTransaction,
    onSuccess: (natija) => {
      queryClient.invalidateQueries({ queryKey: ['transactions-all'] });
      queryClient.invalidateQueries({ queryKey: ['kategoriya-tranzaksiyalar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['xodim-bugun'] });
      queryClient.invalidateQueries({ queryKey: ['kassa-qoldiq'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (tasdiqKutilmoqda(natija)) {
        Alert.alert('Tasdiqlash kutilmoqda', natija.message, [
          { text: t().umumiy.tayyor, onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
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
    if (!summa) {
      setXato("Summa musbat butun son bo'lishi kerak");
      return;
    }
    if (!categoryId) {
      setXato('Kategoriya tanlang');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) {
      setXato("Sana YYYY-MM-DD ko'rinishida bo'lsin");
      return;
    }
    if (saqlash.isPending) return; // takroriy bosishdan himoya
    saqlash.mutate({
      turi,
      categoryId,
      summa,
      sana,
      tolovTuri,
      izoh: izoh.trim() || null,
    });
  };

  const tolovlar = useMemo(() => {
    const asosiy: { value: TolovTuri; label: string }[] = [
      { value: 'naqd', label: t().moliya.naqd },
      { value: 'click', label: t().moliya.click },
    ];
    // Qarz to'lov turi faqat kirim uchun (backend refine bilan mos)
    if (turi === 'kirim') asosiy.push({ value: 'qarz', label: t().moliya.qarz });
    return asosiy;
  }, [turi]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { borderBottomColor: colors.line, paddingTop: Platform.OS === 'android' ? insets.top + spacing.sm : spacing.lg }]}>
        <AppText variant="title" weight="700">
          {turi === 'kirim' ? t().qoshish.kirimQoshish : t().qoshish.chiqimQoshish}
        </AppText>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t().umumiy.yopish}>
          <Ionicons name="close" size={24} color={colors.inkSoft} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <SegmentedControl<TranTuri>
          segments={[
            { value: 'kirim', label: t().moliya.kirim },
            { value: 'chiqim', label: t().moliya.chiqim },
          ]}
          value={turi}
          onChange={(v) => {
            setTuri(v);
            setCategoryId(null);
            if (v === 'chiqim' && tolovTuri === 'qarz') setTolovTuri('naqd');
          }}
        />

        {/* Katta summa maydoni — ekranning qahramoni */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="small" tone="soft" weight="500">
            {t().moliya.summa}
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
                fontSize: fontSize.display,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: colors.ink,
                paddingVertical: spacing.lg,
              }}
              autoFocus
            />
            <AppText variant="title" tone="faint" weight="600">
              {t().moliya.som}
            </AppText>
          </View>
        </View>

        {/* Kategoriya tanlash */}
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

        {/* To'lov turi */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="small" tone="soft" weight="500">
            {t().moliya.tolovTuri}
          </AppText>
          <SegmentedControl<TolovTuri>
            segments={tolovlar}
            value={tolovTuri}
            onChange={setTolovTuri}
          />
        </View>

        {/* Sana */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="small" tone="soft" weight="500">
            Sana
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[
              { label: t().sana.bugun, qiymat: bugun() },
              { label: t().sana.kecha, qiymat: kecha() },
            ].map((v) => {
              const faol = !sanaQolda && sana === v.qiymat;
              return (
                <Pressable
                  key={v.label}
                  onPress={() => {
                    setSana(v.qiymat);
                    setSanaQolda(false);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: faol ? colors.brandWash : colors.surfaceSunk,
                      borderColor: faol ? colors.brand : colors.line,
                    },
                  ]}
                >
                  <AppText variant="small" weight="600" tone={faol ? 'brand' : 'soft'}>
                    {v.label}
                  </AppText>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setSanaQolda(true)}
              style={[
                styles.chip,
                {
                  backgroundColor: sanaQolda ? colors.brandWash : colors.surfaceSunk,
                  borderColor: sanaQolda ? colors.brand : colors.line,
                },
              ]}
            >
              <AppText variant="small" weight="600" tone={sanaQolda ? 'brand' : 'soft'}>
                Boshqa sana
              </AppText>
            </Pressable>
          </View>
          {sanaQolda ? (
            <Input
              value={sana}
              onChangeText={setSana}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          ) : (
            <AppText variant="caption" tone="faint">
              {formatSana(sana)}
            </AppText>
          )}
        </View>

        <Input
          label={t().moliya.izoh}
          value={izoh}
          onChangeText={setIzoh}
          placeholder="Ixtiyoriy izoh..."
          maxLength={500}
        />

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

      {/* Kategoriya varag'i */}
      <BottomSheet visible={katOchiq} onClose={() => setKatOchiq(false)} title={t().moliya.kategoriya} scroll>
        <View style={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
          {kategoriyalar.isPending ? (
            <AppText variant="body" tone="soft" center>
              {t().umumiy.yuklanmoqda}
            </AppText>
          ) : (kategoriyalar.data ?? []).length === 0 ? (
            <AppText variant="body" tone="soft" center>
              Kategoriya topilmadi
            </AppText>
          ) : (
            kategoriyalar.data!.map((c) => {
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
                    {
                      backgroundColor: faol ? colors.brandWash : 'transparent',
                      borderRadius: radius.input,
                    },
                  ]}
                >
                  <AppText variant="bodyLarge" weight={faol ? '600' : '400'}>
                    {c.nomi}
                  </AppText>
                  {faol ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </Pressable>
              );
            })
          )}
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
  summaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: 52,
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  katRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
