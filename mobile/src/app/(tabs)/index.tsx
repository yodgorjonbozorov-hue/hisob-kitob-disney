import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../components/Screen';
import { Header } from '../../components/Header';
import { AppText } from '../../components/AppText';
import { MoneyText } from '../../components/MoneyText';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { SkeletonCard, ErrorState } from '../../components/holatlar';
import { useAuth } from '../../auth/AuthContext';
import { isManager, omborKoradi, qarzKoradi, aktivBiznes } from '../../auth/rbac';
import { fetchMonthSummary, fetchAccountBalances } from '../../api/dashboard';
import { fetchQarzDashboard } from '../../api/debts';
import { fetchOmborKpi } from '../../api/ombor';
import { fetchTransactions } from '../../api/transactions';
import { bugun } from '../../utils/sana';
import { spacing } from '../../theme/tokens';

const TAB_BOSH = 96;

export default function AsosiyScreen() {
  const { me } = useAuth();
  const boshqaruvchi = isManager(me?.rol);
  return (
    <View style={{ flex: 1 }}>
      <Header />
      {boshqaruvchi ? <DirektorPanel /> : <XodimPanel />}
    </View>
  );
}

// DIREKTOR/ADMIN — biznes bo'ylab moliyaviy panel
function DirektorPanel() {
  const { me } = useAuth();
  const router = useRouter();
  const biznesId = me?.activeBusinessId;

  const summary = useQuery({
    queryKey: ['dashboard-summary', biznesId],
    queryFn: () => fetchMonthSummary(),
  });
  const kassalar = useQuery({
    queryKey: ['kassa-qoldiq', biznesId],
    queryFn: fetchAccountBalances,
  });
  const qarz = useQuery({
    queryKey: ['qarz-dashboard', biznesId],
    queryFn: fetchQarzDashboard,
    enabled: qarzKoradi(me?.rol),
  });
  const ombor = useQuery({
    queryKey: ['ombor-kpi', biznesId],
    queryFn: fetchOmborKpi,
    enabled: omborKoradi(me),
  });

  const yangilash = () => {
    summary.refetch();
    kassalar.refetch();
    if (qarzKoradi(me?.rol)) qarz.refetch();
    if (omborKoradi(me)) ombor.refetch();
  };

  const jamiKassa = (kassalar.data ?? []).reduce((s, k) => s + (k.isActive ? k.qoldiq : 0), 0);

  return (
    <Screen
      scroll
      bottomInset={TAB_BOSH}
      refreshing={summary.isRefetching}
      onRefresh={yangilash}
    >
      {summary.isPending ? (
        <View style={{ gap: spacing.md }}>
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </View>
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.row}>
            <StatCard
              label="Kirim (bu oy)"
              value={summary.data.jamiKirim}
              turi="kirim"
              changePct={summary.data.changePct.kirim}
              onPress={() => router.push('/kirim-chiqim')}
            />
            <StatCard
              label="Chiqim (bu oy)"
              value={summary.data.jamiChiqim}
              turi="chiqim"
              changePct={summary.data.changePct.chiqim}
              onPress={() => router.push('/kirim-chiqim')}
            />
          </View>
          <Card>
            <AppText variant="small" tone="soft" weight="500">
              Sof foyda (bu oy)
            </AppText>
            <MoneyText
              value={summary.data.sofFoyda}
              turi={summary.data.sofFoyda >= 0 ? 'kirim' : 'chiqim'}
              variant="display"
              showSom
            />
          </Card>
        </View>
      )}

      <View style={{ height: spacing.lg }} />

      <View style={styles.row}>
        <StatCard
          label="Kassa"
          value={jamiKassa}
          sub={kassalar.data ? `${kassalar.data.filter((k) => k.isActive).length} ta kassa` : undefined}
        />
        {qarzKoradi(me?.rol) ? (
          <StatCard
            label="Qarzdorlik"
            value={qarz.data?.dashboard?.ochiqJami ?? 0}
            turi="qarz"
            sub={
              qarz.data?.dashboard ? `${qarz.data.dashboard.mijozlarSoni} mijoz` : undefined
            }
            onPress={() => router.push('/qarzdorlik')}
          />
        ) : null}
      </View>

      {omborKoradi(me) && ombor.data ? (
        <>
          <View style={{ height: spacing.md }} />
          <StatCard
            label="Ombor qiymati"
            value={ombor.data.omborQiymati}
            sub={`${ombor.data.turlarSoni} tur mahsulot`}
            onPress={() => router.push('/ombor')}
          />
        </>
      ) : null}
    </Screen>
  );
}

// XODIM (KASSIR/SELLER) — faqat o'z yozuvlari, jamlamalar yo'q
function XodimPanel() {
  const { me } = useAuth();
  const router = useRouter();
  const sana = bugun();

  const bugungi = useQuery({
    queryKey: ['xodim-bugun', me?.activeBusinessId, sana],
    queryFn: () => fetchTransactions({ from: sana, to: sana, pageSize: 20 }),
  });

  const biznes = aktivBiznes(me);

  return (
    <Screen
      scroll
      bottomInset={TAB_BOSH}
      refreshing={bugungi.isRefetching}
      onRefresh={() => bugungi.refetch()}
    >
      <AppText variant="body" tone="soft">
        Salom, {me?.ism}
      </AppText>
      <AppText variant="caption" tone="faint" style={{ marginBottom: spacing.lg }}>
        {biznes?.nomi ?? ''}
      </AppText>

      {bugungi.isPending ? (
        <SkeletonCard lines={2} />
      ) : bugungi.isError ? (
        <ErrorState error={bugungi.error} onRetry={() => bugungi.refetch()} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.row}>
            <StatCard
              label="Bugungi kirimlarim"
              value={bugungi.data.totals?.jamiKirim ?? 0}
              turi="kirim"
            />
            <StatCard
              label="Bugungi chiqimlarim"
              value={bugungi.data.totals?.jamiChiqim ?? 0}
              turi="chiqim"
            />
          </View>
          <Card onPress={() => router.push('/kirim-chiqim')}>
            <AppText variant="small" tone="soft" weight="500">
              Bugungi yozuvlarim
            </AppText>
            <AppText variant="headline" weight="700">
              {bugungi.data.total} ta
            </AppText>
            <AppText variant="caption" tone="faint">
              Hammasini ko'rish →
            </AppText>
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
