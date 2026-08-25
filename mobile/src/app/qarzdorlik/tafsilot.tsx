import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { BottomSheet } from '../../components/BottomSheet';
import { PrimaryButton } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { ErrorState, SkeletonCard, EmptyState } from '../../components/holatlar';
import { useTheme } from '../../theme/ThemeContext';
import { fetchQarzdorTafsilot, qarzdorTolov, QarzTolovUsuli } from '../../api/debts';
import { ApiError } from '../../api/client';
import { formatAmountInput, parseAmountInput } from '../../utils/money';
import { formatSana, isoToDateString } from '../../utils/sana';
import { spacing, radius, fontSize } from '../../theme/tokens';

// Takroriy yuborishda dublikat to'lovni server tomonda bloklaydigan kalit
function idempotencyKalit(): string {
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function QarzdorTafsilotScreen() {
  const params = useLocalSearchParams<{ kalit: string; turi: string; ism?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [tolovOchiq, setTolovOchiq] = useState(false);
  const [summaText, setSummaText] = useState('');
  const [usul, setUsul] = useState<QarzTolovUsuli>('naqd');
  const [kalitNusxa, setKalitNusxa] = useState(idempotencyKalit());

  const turi = (params.turi === 'beriladigan' ? 'beriladigan' : 'olinadigan') as
    | 'olinadigan'
    | 'beriladigan';

  const tafsilot = useQuery({
    queryKey: ['qarzdor-tafsilot', params.kalit, turi],
    queryFn: () => fetchQarzdorTafsilot(params.kalit, turi),
    enabled: !!params.kalit,
  });

  const tolov = useMutation({
    mutationFn: (summa: number) =>
      qarzdorTolov({ turi, kalit: params.kalit, summa, tolovTuri: usul, idempotencyKey: kalitNusxa }),
    onSuccess: (natija) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['qarzdor-tafsilot'] });
      queryClient.invalidateQueries({ queryKey: ['qarzdorlar'] });
      queryClient.invalidateQueries({ queryKey: ['qarz-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-all'] });
      setTolovOchiq(false);
      setSummaText('');
      setKalitNusxa(idempotencyKalit());
      Alert.alert(
        "To'lov qabul qilindi",
        natija.yopilganSoni > 0 ? `${natija.yopilganSoni} ta qarz yopildi` : "Qarz qisman to'landi"
      );
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Xatolik', e instanceof ApiError ? e.message : "To'lovni saqlab bo'lmadi");
    },
  });

  const data = tafsilot.data;
  const hodisalar = useMemo(() => data?.hodisalar ?? [], [data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="700" numberOfLines={1}>
            {data?.ism ?? params.ism ?? 'Qarzdor'}
          </AppText>
          {data?.tel ? (
            <AppText variant="caption" tone="faint">
              {data.tel}
            </AppText>
          ) : null}
        </View>
      </View>

      {tafsilot.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </View>
      ) : tafsilot.isError ? (
        <ErrorState error={tafsilot.error} onRetry={() => tafsilot.refetch()} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 120 }}
        >
          <Card>
            <AppText variant="small" tone="soft" weight="500">
              Joriy qarz
            </AppText>
            <MoneyText value={data.jamiQarz} turi="qarz" variant="display" showSom />
            <AppText variant="caption" tone="faint">
              Berilgan: <MoneyText value={data.jamiBerilgan} variant="small" /> · To'langan:{' '}
              <MoneyText value={data.jamiTolangan} variant="small" />
            </AppText>
          </Card>

          {data.ochiqQarzlar.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="small" tone="soft" weight="600">
                Ochiq qarzlar
              </AppText>
              {data.ochiqQarzlar.map((qarz) => (
                <Card key={qarz.id} style={{ gap: spacing.xs, padding: spacing.md }}>
                  <View style={styles.rowBetween}>
                    <AppText variant="body" weight="500">
                      {qarz.sana ? formatSana(isoToDateString(qarz.sana)) : '—'}
                    </AppText>
                    <MoneyText value={qarz.qolgan} turi="qarz" variant="bodyLarge" />
                  </View>
                  <AppText variant="caption" tone="faint">
                    {[
                      qarz.izoh,
                      qarz.muddat ? `Muddat: ${formatSana(isoToDateString(qarz.muddat))}` : null,
                      qarz.tolangan > 0 ? `To'langan: ${qarz.tolangan.toLocaleString('uz-UZ')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || "Izoh yo'q"}
                  </AppText>
                  {qarz.muddatOtdi ? (
                    <AppText variant="caption" tone="danger" weight="600">
                      Muddati o'tgan
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" tone="soft" weight="600">
              Tarix
            </AppText>
            {hodisalar.length === 0 ? (
              <EmptyState title="Tarix bo'sh" />
            ) : (
              hodisalar.map((h) => (
                <View key={h.id} style={[styles.hodisa, { borderBottomColor: colors.line }]}>
                  <View
                    style={[
                      styles.hodisaIkon,
                      {
                        backgroundColor: h.turi === 'tolov' ? colors.incomeWash : colors.debtWash,
                        borderRadius: radius.input,
                      },
                    ]}
                  >
                    <Ionicons
                      name={h.turi === 'tolov' ? 'checkmark' : 'time'}
                      size={15}
                      color={h.turi === 'tolov' ? colors.income : colors.debt}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="500">
                      {h.turi === 'tolov' ? "To'lov" : 'Qarz'}
                    </AppText>
                    <AppText variant="caption" tone="faint" numberOfLines={1}>
                      {[h.sana ? formatSana(isoToDateString(h.sana)) : null, h.izoh ?? h.tafsil]
                        .filter(Boolean)
                        .join(' · ')}
                    </AppText>
                  </View>
                  <MoneyText
                    value={h.summa}
                    turi={h.turi === 'tolov' ? 'kirim' : 'qarz'}
                    showSign={h.turi === 'tolov'}
                    variant="body"
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}

      {/* Pastki mahkam tugma: to'lov qabul qilish */}
      {data && data.jamiQarz > 0 ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.canvas, borderTopColor: colors.line },
          ]}
        >
          <PrimaryButton title="To'lov qabul qilish" onPress={() => setTolovOchiq(true)} />
        </View>
      ) : null}

      <BottomSheet visible={tolovOchiq} onClose={() => setTolovOchiq(false)} title="To'lov qabul qilish">
        <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
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
              autoFocus
            />
            <AppText variant="body" tone="faint" weight="600">
              so'm
            </AppText>
          </View>
          <SegmentedControl<QarzTolovUsuli>
            segments={[
              { value: 'naqd', label: 'Naqd' },
              { value: 'click', label: 'Click' },
              { value: 'bank', label: 'Bank' },
            ]}
            value={usul}
            onChange={setUsul}
          />
          <AppText variant="caption" tone="faint">
            To'lov eng eski qarzdan boshlab yopiladi.
          </AppText>
          <PrimaryButton
            title="Saqlash"
            onPress={() => {
              const summa = parseAmountInput(summaText);
              if (!summa) {
                Alert.alert('Xatolik', "Summa musbat bo'lishi kerak");
                return;
              }
              if (tolov.isPending) return;
              tolov.mutate(summa);
            }}
            loading={tolov.isPending}
            disabled={tolov.isPending}
          />
        </View>
      </BottomSheet>
    </View>
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hodisa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hodisaIkon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
});
