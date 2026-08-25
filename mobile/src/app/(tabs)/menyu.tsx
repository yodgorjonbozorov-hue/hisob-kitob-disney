import React from 'react';
import { View, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import {
  isManager,
  crmKoradi,
  kunlikKoradi,
  omborKoradi,
  posKoradi,
  qarzKoradi,
  ROL_NOMI,
} from '../../auth/rbac';
import { spacing, radius } from '../../theme/tokens';
import { API_URL } from '../../utils/env';

const TAB_BOSH = 108;

interface MenyuBand {
  kalit: string;
  nomi: string;
  izoh?: string;
  ikon: keyof typeof Ionicons.glyphMap;
  href?: string;
  vebda?: boolean; // hozircha faqat veb-ilovada
}

export default function MenyuScreen() {
  const { me, logout } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const bandlar: MenyuBand[] = [];
  bandlar.push({ kalit: 'asosiy', nomi: 'Asosiy', ikon: 'home-outline', href: '/(tabs)' });
  bandlar.push({
    kalit: 'kirim-chiqim',
    nomi: 'Kirim/Chiqim',
    ikon: 'swap-vertical-outline',
    href: '/(tabs)/kirim-chiqim',
  });
  if (kunlikKoradi(me)) {
    bandlar.push({ kalit: 'kunlik', nomi: 'Kunlik hisobot', ikon: 'today-outline', href: '/kunlik' });
  }
  if (crmKoradi(me)) {
    bandlar.push({ kalit: 'crm', nomi: 'CRM', ikon: 'briefcase-outline', href: '/(tabs)/crm' });
  }
  if (qarzKoradi(me?.rol)) {
    bandlar.push({ kalit: 'qarz', nomi: 'Qarzdorlik', ikon: 'time-outline', href: '/qarzdorlik' });
  }
  if (omborKoradi(me) && isManager(me?.rol)) {
    bandlar.push({ kalit: 'ombor', nomi: 'Ombor', ikon: 'cube-outline', href: '/ombor' });
  }
  if (posKoradi(me)) {
    bandlar.push({ kalit: 'pos', nomi: 'Kassa (POS)', ikon: 'barcode-outline', href: '/pos' });
  }
  if (isManager(me?.rol)) {
    bandlar.push({ kalit: 'hisobot', nomi: 'Hisobotlar', ikon: 'bar-chart-outline', vebda: true });
    bandlar.push({ kalit: 'sozlamalar', nomi: 'Sozlamalar', ikon: 'settings-outline', vebda: true });
  }

  const och = (band: MenyuBand) => {
    if (band.vebda) {
      Alert.alert(band.nomi, `Bu bo'lim hozircha veb-ilovada: ${API_URL}`);
      return;
    }
    if (band.href) router.push(band.href as never);
  };

  const chiqish = () => {
    Alert.alert('Chiqish', 'Hisobdan chiqmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Chiqish', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Header title="Menyu" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BOSH, gap: spacing.lg }}>
        {/* Profil kartasi */}
        <Card style={styles.profil}>
          <View style={[styles.avatar, { backgroundColor: colors.brandWash }]}>
            <AppText variant="title" weight="700" style={{ color: colors.brand }}>
              {me?.ism?.charAt(0).toUpperCase() ?? '?'}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" weight="700">
              {me?.ism}
            </AppText>
            <AppText variant="caption" tone="faint">
              {me ? ROL_NOMI[me.rol] : ''} · {me?.login}
            </AppText>
          </View>
        </Card>

        {/* Modullar */}
        <Card padded={false}>
          {bandlar.map((band, i) => (
            <Pressable
              key={band.kalit}
              onPress={() => och(band)}
              style={({ pressed }) => [
                styles.band,
                i < bandlar.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.bandIkon, { backgroundColor: colors.surfaceSunk }]}>
                <Ionicons name={band.ikon} size={19} color={colors.brand} />
              </View>
              <AppText variant="bodyLarge" weight="500" style={{ flex: 1 }}>
                {band.nomi}
              </AppText>
              {band.vebda ? (
                <AppText variant="caption" tone="faint">
                  veb
                </AppText>
              ) : null}
              <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
            </Pressable>
          ))}
        </Card>

        {/* Chiqish */}
        <Card padded={false}>
          <Pressable onPress={chiqish} style={({ pressed }) => [styles.band, pressed && { opacity: 0.7 }]}>
            <View style={[styles.bandIkon, { backgroundColor: colors.expenseWash }]}>
              <Ionicons name="log-out-outline" size={19} color={colors.expense} />
            </View>
            <AppText variant="bodyLarge" weight="500" tone="danger" style={{ flex: 1 }}>
              Chiqish
            </AppText>
          </Pressable>
        </Card>

        <AppText variant="caption" tone="faint" center>
          Balansa mobil · {me?.tenant?.name ?? ''}
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  bandIkon: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
