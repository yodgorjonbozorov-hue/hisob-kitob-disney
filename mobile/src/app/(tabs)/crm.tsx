import React, { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { SegmentedControl } from '../../components/SegmentedControl';
import { BottomSheet } from '../../components/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { EmptyState, ErrorState, SkeletonCard } from '../../components/holatlar';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { fetchBoard, moveDeal, dealToKirim, DealDTO, StageDTO } from '../../api/crm';
import { ApiError } from '../../api/client';
import { formatSana, isoToDateString } from '../../utils/sana';
import { spacing, radius } from '../../theme/tokens';

const TAB_BOSH = 108;
type Korinish = 'ochiq' | 'yutildi' | 'yoqotildi';

export default function CrmScreen() {
  const { me } = useAuth();
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const [korinish, setKorinish] = useState<Korinish>('ochiq');
  const [tanlangan, setTanlangan] = useState<DealDTO | null>(null);

  const board = useQuery({
    queryKey: ['crm-board', me?.activeBusinessId],
    queryFn: fetchBoard,
  });

  const stageMap = useMemo(() => {
    const map = new Map<string, StageDTO>();
    for (const s of board.data?.stages ?? []) map.set(s.id, s);
    return map;
  }, [board.data]);

  const deals = useMemo(() => {
    const hammasi = board.data?.deals ?? [];
    return hammasi.filter((d) => {
      const stage = stageMap.get(d.stageId);
      if (!stage) return korinish === 'ochiq';
      if (korinish === 'ochiq') return stage.turi === 'OPEN';
      if (korinish === 'yutildi') return stage.turi === 'WON';
      return stage.turi === 'LOST';
    });
  }, [board.data, stageMap, korinish]);

  const yangilaVaYop = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-board'] });
    queryClient.invalidateQueries({ queryKey: ['transactions-all'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    setTanlangan(null);
  };

  const kochirish = useMutation({
    mutationFn: ({ id, stageId, kirimYoz }: { id: string; stageId: string; kirimYoz?: boolean }) =>
      moveDeal(id, stageId, kirimYoz),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      yangilaVaYop();
    },
    onError: (e) =>
      Alert.alert('Xatolik', e instanceof ApiError ? e.message : "Amalni bajarib bo'lmadi"),
  });

  const kirimga = useMutation({
    mutationFn: (id: string) => dealToKirim(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Tayyor', 'Buyurtma Kirimga yozildi');
      yangilaVaYop();
    },
    onError: (e) =>
      Alert.alert('Xatolik', e instanceof ApiError ? e.message : "Kirimga yozib bo'lmadi"),
  });

  const wonStage = board.data?.stages.find((s) => s.turi === 'WON');
  const lostStage = board.data?.stages.find((s) => s.turi === 'LOST');

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Header title="CRM buyurtmalar" />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SegmentedControl<Korinish>
          segments={[
            { value: 'ochiq', label: 'Ochiq' },
            { value: 'yutildi', label: 'Yutildi' },
            { value: 'yoqotildi', label: "Yo'qotildi" },
          ]}
          value={korinish}
          onChange={setKorinish}
        />
      </View>

      <FlatList
        data={deals}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: TAB_BOSH, gap: spacing.sm }}
        refreshing={board.isRefetching}
        onRefresh={() => board.refetch()}
        ListEmptyComponent={
          board.isPending ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>
          ) : board.isError ? (
            <ErrorState error={board.error} onRetry={() => board.refetch()} />
          ) : (
            <EmptyState
              title="Buyurtma yo'q"
              subtitle="Yangi buyurtma qo'shish uchun + tugmasini bosing"
            />
          )
        }
        renderItem={({ item }) => {
          const stage = stageMap.get(item.stageId);
          return (
            <Card onPress={() => setTanlangan(item)} style={{ gap: spacing.sm }}>
              <View style={styles.rowBetween}>
                <AppText variant="bodyLarge" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                  {item.nomi}
                </AppText>
                <MoneyText value={item.summa} variant="bodyLarge" />
              </View>
              <View style={styles.rowBetween}>
                <AppText variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
                  {[item.contact?.ism, item.contact?.tel, item.sana ? formatSana(isoToDateString(item.sana)) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
                <View
                  style={[
                    styles.stagePill,
                    {
                      backgroundColor:
                        stage?.turi === 'WON'
                          ? colors.incomeWash
                          : stage?.turi === 'LOST'
                            ? colors.expenseWash
                            : colors.infoWash,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    weight="600"
                    style={{
                      color:
                        stage?.turi === 'WON'
                          ? colors.income
                          : stage?.turi === 'LOST'
                            ? colors.expense
                            : colors.info,
                    }}
                  >
                    {stage?.nomi ?? '—'}
                  </AppText>
                </View>
              </View>
              {item.transactionId ? (
                <AppText variant="caption" tone="income">
                  ✓ Kirimga yozilgan
                </AppText>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Buyurtma amallari varag'i */}
      <BottomSheet
        visible={!!tanlangan}
        onClose={() => setTanlangan(null)}
        title={tanlangan?.nomi ?? ''}
      >
        {tanlangan ? (
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <View style={styles.rowBetween}>
              <AppText variant="body" tone="soft">
                Summa
              </AppText>
              <MoneyText value={tanlangan.summa} variant="title" showSom />
            </View>
            {tanlangan.contact ? (
              <View style={styles.rowBetween}>
                <AppText variant="body" tone="soft">
                  Mijoz
                </AppText>
                <AppText variant="body" weight="600">
                  {tanlangan.contact.ism}
                  {tanlangan.contact.tel ? ` · ${tanlangan.contact.tel}` : ''}
                </AppText>
              </View>
            ) : null}
            {tanlangan.izoh ? (
              <AppText variant="body" tone="soft">
                {tanlangan.izoh}
              </AppText>
            ) : null}

            {tanlangan.transactionId ? (
              <AppText variant="body" tone="income" center>
                ✓ Bu buyurtma Kirimga yozilgan
              </AppText>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {stageMap.get(tanlangan.stageId)?.turi === 'OPEN' && wonStage ? (
                  <PrimaryButton
                    title="Yutildi + Kirimga yozish"
                    onPress={() =>
                      kochirish.mutate({ id: tanlangan.id, stageId: wonStage.id, kirimYoz: true })
                    }
                    loading={kochirish.isPending}
                    disabled={kochirish.isPending || tanlangan.summa <= 0}
                  />
                ) : null}
                {stageMap.get(tanlangan.stageId)?.turi === 'WON' ? (
                  <PrimaryButton
                    title="Kirimga yozish"
                    onPress={() => kirimga.mutate(tanlangan.id)}
                    loading={kirimga.isPending}
                    disabled={kirimga.isPending || tanlangan.summa <= 0}
                  />
                ) : null}
                {stageMap.get(tanlangan.stageId)?.turi === 'OPEN' && lostStage ? (
                  <SecondaryButton
                    title="Yo'qotildi deb belgilash"
                    onPress={() => kochirish.mutate({ id: tanlangan.id, stageId: lostStage.id })}
                    loading={kochirish.isPending}
                    disabled={kochirish.isPending}
                  />
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stagePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
