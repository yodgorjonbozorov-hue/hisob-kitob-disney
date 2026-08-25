import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { SearchInput } from '../../components/SearchInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { CategoryCard } from '../../components/CategoryCard';
import { EmptyState, ErrorState, SkeletonCard } from '../../components/holatlar';
import { FilterSheet } from '../../features/kirimChiqim/FilterSheet';
import { useAuth } from '../../auth/AuthContext';
import { moliyaviyJamlamaKoradi } from '../../auth/rbac';
import { useTheme } from '../../theme/ThemeContext';
import { useTransactionsAll } from '../../hooks/useTransactionsAll';
import { useDebounced } from '../../hooks/useDebounced';
import { kategoriyaGuruhla } from '../../utils/guruhlash';
import { BOSHLANGICH_FILTR, faolFiltrSoni, filtrToApi, KcFiltr, Davr } from '../../features/kirimChiqim/filtrlar';
import { spacing, radius } from '../../theme/tokens';
import { t } from '../../i18n/uz';

const TAB_BOSH = 108;

export default function KirimChiqimScreen() {
  const { me } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [filtr, setFiltr] = useState<KcFiltr>(BOSHLANGICH_FILTR);
  const [filtrOchiq, setFiltrOchiq] = useState(false);
  const qDeb = useDebounced(filtr.q, 350);

  const apiFiltr = useMemo(() => filtrToApi({ ...filtr, q: qDeb }), [filtr, qDeb]);
  const soro = useTransactionsAll(apiFiltr);

  const guruhlar = useMemo(() => kategoriyaGuruhla(soro.items), [soro.items]);
  const direktormi = moliyaviyJamlamaKoradi(me?.rol);
  const filtrSoni = faolFiltrSoni(filtr);

  const kategoriyaOch = (categoryId: string, nomi: string) => {
    router.push({
      pathname: '/kategoriya/[id]',
      params: {
        id: categoryId,
        nomi,
        from: apiFiltr.from,
        to: apiFiltr.to,
        turi: apiFiltr.turi ?? '',
        tolov: apiFiltr.tolov ?? '',
        q: apiFiltr.q ?? '',
        minSumma: apiFiltr.minSumma != null ? String(apiFiltr.minSumma) : '',
        maxSumma: apiFiltr.maxSumma != null ? String(apiFiltr.maxSumma) : '',
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Header title="Kirim va chiqimlar" />
      <View style={styles.controls}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <SearchInput
            value={filtr.q}
            onChangeText={(q) => setFiltr((s) => ({ ...s, q }))}
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={() => setFiltrOchiq(true)}
            accessibilityLabel="Filtr"
            style={[
              styles.filterBtn,
              {
                backgroundColor: filtrSoni > 0 ? colors.brandWash : colors.surfaceSunk,
                borderColor: filtrSoni > 0 ? colors.brand : colors.line,
              },
            ]}
          >
            <Ionicons name="options" size={18} color={filtrSoni > 0 ? colors.brand : colors.inkSoft} />
            {filtrSoni > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                <AppText variant="caption" weight="700" style={{ color: colors.brandFg, fontSize: 10 }}>
                  {filtrSoni}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
        <SegmentedControl<Davr>
          segments={[
            { value: 'bugun', label: t().sana.bugun },
            { value: 'hafta', label: t().sana.buHafta },
            { value: 'oy', label: t().sana.buOy },
          ]}
          value={filtr.davr}
          onChange={(davr) => setFiltr((s) => ({ ...s, davr }))}
        />
      </View>

      <FlatList
        data={guruhlar}
        keyExtractor={(g) => g.categoryId}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: TAB_BOSH, gap: spacing.sm }}
        refreshing={soro.isRefetching && !soro.isFetchingNextPage}
        onRefresh={() => soro.refetch()}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {/* Moliyaviy jamlama — FAQAT direktor/administrator */}
            {direktormi && soro.totals ? (
              <Card style={{ padding: spacing.lg }}>
                <View style={styles.totalsRow}>
                  <View style={styles.totalCol}>
                    <AppText variant="caption" tone="soft">
                      {t().moliya.kirim}
                    </AppText>
                    <MoneyText value={soro.totals.jamiKirim} turi="kirim" compact variant="title" />
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.line }]} />
                  <View style={styles.totalCol}>
                    <AppText variant="caption" tone="soft">
                      {t().moliya.chiqim}
                    </AppText>
                    <MoneyText value={soro.totals.jamiChiqim} turi="chiqim" compact variant="title" />
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.line }]} />
                  <View style={styles.totalCol}>
                    <AppText variant="caption" tone="soft">
                      {t().moliya.sof}
                    </AppText>
                    <MoneyText
                      value={soro.totals.sof}
                      turi={soro.totals.sof >= 0 ? 'kirim' : 'chiqim'}
                      compact
                      variant="title"
                    />
                  </View>
                </View>
              </Card>
            ) : null}
            {!soro.toliq && !soro.isPending ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.brand} />
                <AppText variant="caption" tone="faint">
                  Yozuvlar yuklanmoqda ({soro.items.length}/{soro.jamiSoni})
                </AppText>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          soro.isPending ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={1} />
              <SkeletonCard lines={1} />
              <SkeletonCard lines={1} />
            </View>
          ) : soro.isError ? (
            <ErrorState error={soro.error} onRetry={() => soro.refetch()} />
          ) : (
            <EmptyState title="Bu davrda yozuv yo'q" subtitle="Yangi yozuv qo'shish uchun + tugmasini bosing" />
          )
        }
        renderItem={({ item }) => (
          <CategoryCard guruh={item} onPress={() => kategoriyaOch(item.categoryId, item.nomi)} />
        )}
      />

      <FilterSheet
        visible={filtrOchiq}
        onClose={() => setFiltrOchiq(false)}
        filtr={filtr}
        onApply={setFiltr}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalCol: {
    flex: 1,
    gap: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
