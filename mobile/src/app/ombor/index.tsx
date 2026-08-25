import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { SearchInput } from '../../components/SearchInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { EmptyState, ErrorState, SkeletonCard } from '../../components/holatlar';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useDebounced } from '../../hooks/useDebounced';
import { fetchOmborMahsulotlar, fetchOmborKpi } from '../../api/ombor';
import { isManager } from '../../auth/rbac';
import { spacing } from '../../theme/tokens';

type Holat = 'barchasi' | 'kam' | 'tugagan';

// Ombor — menejer ko'rinishi (backend /api/ombor/mahsulotlar requireManager)
export default function OmborScreen() {
  const { me } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [holat, setHolat] = useState<Holat>('barchasi');
  const qDeb = useDebounced(q, 350);
  const boshqaruvchi = isManager(me?.rol);

  const kpi = useQuery({
    queryKey: ['ombor-kpi', me?.activeBusinessId],
    queryFn: fetchOmborKpi,
    enabled: boshqaruvchi,
  });

  const royxat = useInfiniteQuery({
    queryKey: ['ombor-mahsulotlar', me?.activeBusinessId, qDeb, holat],
    queryFn: ({ pageParam }) =>
      fetchOmborMahsulotlar({ q: qDeb || undefined, holat, sahifa: pageParam, limit: 24 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.yanaBor ? last.sahifa + 1 : undefined),
    enabled: boshqaruvchi,
  });

  const mahsulotlar = useMemo(
    () => royxat.data?.pages.flatMap((p) => p.mahsulotlar) ?? [],
    [royxat.data]
  );

  if (!boshqaruvchi) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top }}>
        <EmptyState title="Ombor bo'limi faqat rahbariyat uchun" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <AppText variant="title" weight="700" style={{ flex: 1 }}>
          Ombor
        </AppText>
      </View>

      <FlatList
        data={mahsulotlar}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}
        refreshing={royxat.isRefetching && !royxat.isFetchingNextPage}
        onRefresh={() => {
          royxat.refetch();
          kpi.refetch();
        }}
        onEndReached={() => {
          if (royxat.hasNextPage && !royxat.isFetchingNextPage) royxat.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {kpi.data ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Card style={{ flex: 1, gap: 2 }}>
                  <AppText variant="caption" tone="soft">
                    Ombor qiymati
                  </AppText>
                  <MoneyText value={kpi.data.omborQiymati} compact variant="title" />
                </Card>
                <Card style={{ flex: 1, gap: 2 }}>
                  <AppText variant="caption" tone="soft">
                    Mahsulot turlari
                  </AppText>
                  <AppText variant="title" weight="700">
                    {kpi.data.turlarSoni}
                  </AppText>
                  {kpi.data.kamQolgan > 0 || kpi.data.tugagan > 0 ? (
                    <AppText variant="caption" tone="debt">
                      {kpi.data.kamQolgan} kam · {kpi.data.tugagan} tugagan
                    </AppText>
                  ) : null}
                </Card>
              </View>
            ) : null}
            <SearchInput value={q} onChangeText={setQ} placeholder="Mahsulot, SKU yoki shtrix-kod..." />
            <SegmentedControl<Holat>
              segments={[
                { value: 'barchasi', label: 'Barchasi' },
                { value: 'kam', label: 'Kam qolgan' },
                { value: 'tugagan', label: 'Tugagan' },
              ]}
              value={holat}
              onChange={setHolat}
            />
          </View>
        }
        ListEmptyComponent={
          royxat.isPending ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={1} />
              <SkeletonCard lines={1} />
            </View>
          ) : royxat.isError ? (
            <ErrorState error={royxat.error} onRetry={() => royxat.refetch()} />
          ) : (
            <EmptyState title="Mahsulot topilmadi" />
          )
        }
        ListFooterComponent={
          royxat.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />
          ) : null
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => router.push({ pathname: '/ombor/[id]', params: { id: item.id } })}
            style={styles.row}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyLarge" weight="600" numberOfLines={1}>
                {item.nomi}
              </AppText>
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {[item.kategoriyaNomi, item.sku].filter(Boolean).join(' · ') || item.birlik}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <AppText
                variant="bodyLarge"
                weight="700"
                tone={item.miqdor === 0 ? 'danger' : item.miqdor <= item.minQoldiq ? 'debt' : 'ink'}
                tabular
              >
                {item.miqdor} {item.birlik}
              </AppText>
              <MoneyText value={item.sotuvNarx} compact variant="small" />
            </View>
          </Card>
        )}
      />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});
