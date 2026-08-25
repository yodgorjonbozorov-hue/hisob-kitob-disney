import React, { useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { SearchInput } from '../../components/SearchInput';
import { EmptyState, ErrorState, SkeletonCard } from '../../components/holatlar';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useDebounced } from '../../hooks/useDebounced';
import { fetchQarzdorlar, fetchQarzDashboard } from '../../api/debts';
import { spacing, radius } from '../../theme/tokens';

// Qarzdorlik: 1 mijoz = 1 karta (konsolidatsiya serverda — /api/debts/qarzdorlar)
export default function QarzdorlikScreen() {
  const { me } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const qDeb = useDebounced(q, 350);

  const qarzdorlar = useQuery({
    queryKey: ['qarzdorlar', me?.activeBusinessId, qDeb],
    queryFn: () => fetchQarzdorlar({ turi: 'olinadigan', q: qDeb || undefined }),
  });
  const dashboard = useQuery({
    queryKey: ['qarz-dashboard', me?.activeBusinessId],
    queryFn: fetchQarzDashboard,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <AppText variant="title" weight="700" style={{ flex: 1 }}>
          Qarzdorlik
        </AppText>
        <Pressable
          onPress={() => router.push('/qarzdorlik/yangi')}
          hitSlop={10}
          accessibilityLabel="Qarz qo'shish"
          style={[styles.addBtn, { backgroundColor: colors.brandWash }]}
        >
          <Ionicons name="add" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={qarzdorlar.data ?? []}
        keyExtractor={(item) => item.kalit}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}
        refreshing={qarzdorlar.isRefetching}
        onRefresh={() => {
          qarzdorlar.refetch();
          dashboard.refetch();
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {dashboard.data?.dashboard ? (
              <Card>
                <AppText variant="small" tone="soft" weight="500">
                  Jami ochiq qarz
                </AppText>
                <MoneyText value={dashboard.data.dashboard.ochiqJami} turi="qarz" variant="display" showSom />
                <AppText variant="caption" tone="faint">
                  {dashboard.data.dashboard.mijozlarSoni} mijoz
                  {dashboard.data.dashboard.muddatiOtganSoni > 0
                    ? ` · ${dashboard.data.dashboard.muddatiOtganSoni} tasida muddat o'tgan`
                    : ''}
                </AppText>
              </Card>
            ) : null}
            <SearchInput value={q} onChangeText={setQ} placeholder="Ism yoki telefon..." />
          </View>
        }
        ListEmptyComponent={
          qarzdorlar.isPending ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={1} />
              <SkeletonCard lines={1} />
            </View>
          ) : qarzdorlar.isError ? (
            <ErrorState error={qarzdorlar.error} onRetry={() => qarzdorlar.refetch()} />
          ) : (
            <EmptyState title="Ochiq qarz yo'q" />
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: '/qarzdorlik/tafsilot',
                params: { kalit: item.kalit, turi: item.turi, ism: item.ism },
              })
            }
            style={styles.row}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyLarge" weight="600" numberOfLines={1}>
                {item.ism}
              </AppText>
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {[item.tel, `${item.ochiqSoni} ta qarz`, `eng eskisi ${item.eskiKun} kun`]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              {item.muddatOtdi ? (
                <AppText variant="caption" tone="danger" weight="600">
                  Muddati o'tgan: <MoneyText value={item.muddatiOtganSumma} turi="chiqim" variant="small" />
                </AppText>
              ) : null}
            </View>
            <MoneyText value={item.qarz} turi="qarz" variant="bodyLarge" />
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});
