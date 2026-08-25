import React, { useMemo } from 'react';
import { View, SectionList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { TransactionRow } from '../../components/TransactionRow';
import { EmptyState, ErrorState, SkeletonCard } from '../../components/holatlar';
import { useTheme } from '../../theme/ThemeContext';
import { fetchTransactions } from '../../api/transactions';
import { sanaGuruhla } from '../../utils/guruhlash';
import { spacing } from '../../theme/tokens';
import type { TolovGuruhi, TranTuri } from '../../api/types';

// Kategoriya tafsiloti: faqat shu kategoriya yozuvlari, sana bo'yicha guruhlangan.
// Filtrlar ro'yxat ekranidan params orqali keladi — server tomonda qo'llanadi.
export default function KategoriyaDetalScreen() {
  const params = useLocalSearchParams<{
    id: string;
    nomi?: string;
    from?: string;
    to?: string;
    turi?: string;
    tolov?: string;
    q?: string;
    minSumma?: string;
    maxSumma?: string;
  }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const filtr = useMemo(
    () => ({
      categoryId: params.id,
      from: params.from || undefined,
      to: params.to || undefined,
      turi: (params.turi || undefined) as TranTuri | undefined,
      tolov: (params.tolov || undefined) as TolovGuruhi | undefined,
      q: params.q || undefined,
      minSumma: params.minSumma ? Number(params.minSumma) : undefined,
      maxSumma: params.maxSumma ? Number(params.maxSumma) : undefined,
    }),
    [params.id, params.from, params.to, params.turi, params.tolov, params.q, params.minSumma, params.maxSumma]
  );

  const soro = useInfiniteQuery({
    queryKey: ['kategoriya-tranzaksiyalar', filtr],
    queryFn: ({ pageParam }) => fetchTransactions({ ...filtr, page: pageParam, pageSize: 50 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });

  const items = useMemo(() => soro.data?.pages.flatMap((p) => p.items) ?? [], [soro.data]);
  const bolimlar = useMemo(() => sanaGuruhla(items), [items]);
  const jami = useMemo(() => items.reduce((s, i) => s + i.summa, 0), [items]);
  const turi = items[0]?.turi;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="700" numberOfLines={1}>
            {params.nomi ?? 'Kategoriya'}
          </AppText>
          <AppText variant="caption" tone="faint">
            {soro.data?.pages[0]?.total ?? 0} ta yozuv
          </AppText>
        </View>
        {items.length > 0 ? (
          <MoneyText value={jami} turi={turi ?? 'neytral'} compact variant="title" />
        ) : null}
      </View>

      {soro.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : soro.isError ? (
        <ErrorState error={soro.error} onRetry={() => soro.refetch()} />
      ) : (
        <SectionList
          sections={bolimlar}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
          refreshing={soro.isRefetching && !soro.isFetchingNextPage}
          onRefresh={() => soro.refetch()}
          onEndReached={() => {
            if (soro.hasNextPage && !soro.isFetchingNextPage) soro.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.canvas }]}>
              <AppText variant="small" tone="soft" weight="600">
                {section.title}
              </AppText>
              <MoneyText
                value={Math.abs(section.jami)}
                turi={section.jami >= 0 ? 'kirim' : 'chiqim'}
                compact
                variant="small"
              />
            </View>
          )}
          renderItem={({ item }) => <TransactionRow item={item} />}
          ListEmptyComponent={<EmptyState title="Bu kategoriyada yozuv yo'q" />}
          ListFooterComponent={
            soro.isFetchingNextPage ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />
            ) : null
          }
        />
      )}
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
  back: {
    padding: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
