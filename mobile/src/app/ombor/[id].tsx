import React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { ErrorState, SkeletonCard, EmptyState } from '../../components/holatlar';
import { useTheme } from '../../theme/ThemeContext';
import { fetchMahsulotDetal } from '../../api/ombor';
import { formatSana, isoToDateString } from '../../utils/sana';
import { spacing, radius } from '../../theme/tokens';

const HARAKAT_NOMI: Record<string, string> = {
  taminot: "Ta'minot (kirim)",
  sotuv: 'Sotuv',
  chiqarish: 'Chiqarish',
  inventarizatsiya: 'Inventarizatsiya',
  taminot_bekor: "Ta'minot bekor",
};

export default function MahsulotDetalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const detal = useQuery({
    queryKey: ['mahsulot-detal', id],
    queryFn: () => fetchMahsulotDetal(id),
    enabled: !!id,
  });

  const m = detal.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <AppText variant="title" weight="700" numberOfLines={1} style={{ flex: 1 }}>
          {m?.nomi ?? 'Mahsulot'}
        </AppText>
      </View>

      {detal.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </View>
      ) : detal.isError ? (
        <ErrorState error={detal.error} onRetry={() => detal.refetch()} />
      ) : m ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Card style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" tone="soft">
                Qoldiq
              </AppText>
              <AppText
                variant="headline"
                weight="700"
                tone={m.miqdor === 0 ? 'danger' : m.miqdor <= m.minQoldiq ? 'debt' : 'ink'}
                tabular
              >
                {m.miqdor} {m.birlik}
              </AppText>
            </Card>
            <Card style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" tone="soft">
                Ombor qiymati
              </AppText>
              <MoneyText value={m.qiymat} compact variant="headline" />
            </Card>
          </View>

          <Card style={{ gap: spacing.sm }}>
            <Qator nomi="Sotuv narxi">
              <MoneyText value={m.sotuvNarx} showSom variant="body" />
            </Qator>
            <Qator nomi="Kelgan narx">
              <MoneyText value={m.kelganNarx} showSom variant="body" />
            </Qator>
            {m.sku ? (
              <Qator nomi="SKU">
                <AppText variant="body">{m.sku}</AppText>
              </Qator>
            ) : null}
            {m.barcode ? (
              <Qator nomi="Shtrix-kod">
                <AppText variant="body">{m.barcode}</AppText>
              </Qator>
            ) : null}
            {m.kategoriyaNomi ? (
              <Qator nomi="Kategoriya">
                <AppText variant="body">{m.kategoriyaNomi}</AppText>
              </Qator>
            ) : null}
          </Card>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" tone="soft" weight="600">
              Harakatlar tarixi
            </AppText>
            {m.harakatlar.length === 0 ? (
              <EmptyState title="Harakat yo'q" />
            ) : (
              m.harakatlar.map((h) => (
                <View key={h.id} style={[styles.harakat, { borderBottomColor: colors.line }]}>
                  <View
                    style={[
                      styles.harakatIkon,
                      {
                        backgroundColor: h.farq >= 0 ? colors.incomeWash : colors.expenseWash,
                        borderRadius: radius.input,
                      },
                    ]}
                  >
                    <Ionicons
                      name={h.farq >= 0 ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={h.farq >= 0 ? colors.income : colors.expense}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="500">
                      {HARAKAT_NOMI[h.turi] ?? h.turi}
                    </AppText>
                    <AppText variant="caption" tone="faint" numberOfLines={1}>
                      {[formatSana(isoToDateString(h.sana)), h.izoh].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                  <AppText
                    variant="body"
                    weight="700"
                    tone={h.farq >= 0 ? 'income' : 'expense'}
                    tabular
                  >
                    {h.farq >= 0 ? '+' : ''}
                    {h.farq}
                  </AppText>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function Qator({ nomi, children }: { nomi: string; children: React.ReactNode }) {
  return (
    <View style={styles.qator}>
      <AppText variant="body" tone="soft">
        {nomi}
      </AppText>
      {children}
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
  qator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  harakat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  harakatIkon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
