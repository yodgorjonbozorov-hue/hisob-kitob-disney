import React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { MoneyText } from '../components/MoneyText';
import { Card } from '../components/Card';
import { ErrorState, SkeletonCard, EmptyState } from '../components/holatlar';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fetchKunlikHisobot } from '../api/dashboard';
import { spacing, radius } from '../theme/tokens';

const HOLAT_NOMI: Record<string, string> = {
  OPEN: 'Ochiq',
  SUBMITTED: 'Topshirilgan',
  CONFIRMED: 'Tasdiqlangan',
};

// Kunlik hisobot — bugungi kun ko'rinishi (KUNLIK moduli)
export default function KunlikScreen() {
  const { me } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const hisobot = useQuery({
    queryKey: ['kunlik-hisobot', me?.activeBusinessId],
    queryFn: () => fetchKunlikHisobot(),
  });

  const r = hisobot.data?.report;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="700">
            Kunlik hisobot
          </AppText>
          {r ? (
            <AppText variant="caption" tone="faint">
              {r.sana} · {HOLAT_NOMI[r.holat] ?? r.holat}
            </AppText>
          ) : null}
        </View>
      </View>

      {hisobot.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </View>
      ) : hisobot.isError ? (
        <ErrorState error={hisobot.error} onRetry={() => hisobot.refetch()} />
      ) : r ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
          <Card>
            <AppText variant="small" tone="soft" weight="500">
              Bugungi jami tushum
            </AppText>
            <MoneyText value={r.jamiSumma} turi="kirim" variant="display" showSom />
            <View style={styles.taqsim}>
              <AppText variant="caption" tone="faint">
                Naqd <MoneyText value={r.naqdSumma} compact variant="small" />
              </AppText>
              <AppText variant="caption" tone="faint">
                Click <MoneyText value={r.clickSumma} compact variant="small" />
              </AppText>
              <AppText variant="caption" tone="faint">
                Qarz <MoneyText value={r.qarzSumma} compact variant="small" />
              </AppText>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Card style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" tone="soft">
                Chiqim
              </AppText>
              <MoneyText value={r.chiqimSumma} turi="chiqim" compact variant="title" />
            </Card>
            <Card style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" tone="soft">
                Sof
              </AppText>
              <MoneyText value={r.sofSumma} turi={r.sofSumma >= 0 ? 'kirim' : 'chiqim'} compact variant="title" />
            </Card>
          </View>

          {r.holat !== 'OPEN' ? (
            <Card style={{ gap: spacing.xs }}>
              {r.submittedByIsm ? (
                <AppText variant="caption" tone="faint">
                  Topshirdi: {r.submittedByIsm}
                </AppText>
              ) : null}
              {r.sanalganNaqd != null ? (
                <AppText variant="caption" tone="faint">
                  Sanalgan naqd: <MoneyText value={r.sanalganNaqd} variant="small" />
                  {r.naqdFarq != null && r.naqdFarq !== 0 ? (
                    <AppText variant="small" tone={r.naqdFarq > 0 ? 'income' : 'danger'}>
                      {' '}
                      (farq {r.naqdFarq > 0 ? '+' : ''}
                      {r.naqdFarq.toLocaleString('uz-UZ')})
                    </AppText>
                  ) : null}
                </AppText>
              ) : null}
              {r.confirmedByIsm ? (
                <AppText variant="caption" tone="income">
                  Tasdiqladi: {r.confirmedByIsm}
                </AppText>
              ) : null}
            </Card>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" tone="soft" weight="600">
              Tushumlar ({r.items.length})
            </AppText>
            {r.items.length === 0 ? (
              <EmptyState title="Bugun tushum yo'q" />
            ) : (
              r.items.map((item) => (
                <View key={item.id} style={[styles.item, { borderBottomColor: colors.line }]}>
                  <View
                    style={[
                      styles.itemIkon,
                      {
                        backgroundColor:
                          item.tolovTuri === 'CASH'
                            ? colors.incomeWash
                            : item.tolovTuri === 'CLICK'
                              ? colors.infoWash
                              : colors.debtWash,
                        borderRadius: radius.input,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.tolovTuri === 'CASH'
                          ? 'cash-outline'
                          : item.tolovTuri === 'CLICK'
                            ? 'phone-portrait-outline'
                            : 'time-outline'
                      }
                      size={15}
                      color={
                        item.tolovTuri === 'CASH'
                          ? colors.income
                          : item.tolovTuri === 'CLICK'
                            ? colors.info
                            : colors.debt
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="500" numberOfLines={1}>
                      {item.izoh?.trim() || item.userIsm}
                    </AppText>
                    <AppText variant="caption" tone="faint">
                      {item.userIsm}
                      {item.yozuvdan ? ' · Kirim yozuvidan' : ''}
                    </AppText>
                  </View>
                  <MoneyText value={item.summa} turi="kirim" variant="body" />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}
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
  taqsim: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemIkon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
