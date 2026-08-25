import React, { useCallback, useRef, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { MoneyText } from '../components/MoneyText';
import { Card } from '../components/Card';
import { BottomSheet } from '../components/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { EmptyState } from '../components/holatlar';
import { Input } from '../components/Input';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { posLookup, posSotuv, PosTolovTuri } from '../api/pos';
import { posKoradi } from '../auth/rbac';
import { ApiError } from '../api/client';
import { spacing, radius } from '../theme/tokens';

interface SavatSatr {
  productId: string;
  nomi: string;
  narx: number;
  miqdor: number;
  birlik: string;
}

// POS: skan → savat → sotuv. Faqat MAGAZIN yoqilgan biznesda (posKoradi).
export default function PosScreen() {
  const { me } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [permission, requestPermission] = useCameraPermissions();
  const [skanFaol, setSkanFaol] = useState(false);
  const [savat, setSavat] = useState<SavatSatr[]>([]);
  const [qoldaOchiq, setQoldaOchiq] = useState(false);
  const [qoldaKod, setQoldaKod] = useState('');
  const [tolovOchiq, setTolovOchiq] = useState(false);
  const [tolovTuri, setTolovTuri] = useState<PosTolovTuri>('naqd');
  const [mijozNomi, setMijozNomi] = useState('');
  const oxirgiKod = useRef<{ kod: string; vaqt: number }>({ kod: '', vaqt: 0 });

  const ruxsatBor = posKoradi(me);

  const qidirish = useMutation({
    mutationFn: posLookup,
    onSuccess: (natija, kod) => {
      if (!natija.topildi || !natija.mahsulot) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert('Topilmadi', `"${kod}" kodi bo'yicha mahsulot topilmadi`);
        return;
      }
      const m = natija.mahsulot;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSavat((s) => {
        const mavjud = s.find((x) => x.productId === m.id);
        if (mavjud) {
          return s.map((x) => (x.productId === m.id ? { ...x, miqdor: x.miqdor + 1 } : x));
        }
        return [...s, { productId: m.id, nomi: m.nomi, narx: m.sotuvNarx, miqdor: 1, birlik: m.birlik }];
      });
    },
    onError: (e) =>
      Alert.alert('Xatolik', e instanceof ApiError ? e.message : "Qidirib bo'lmadi"),
  });

  const skanQabul = useCallback(
    (kod: string) => {
      // Bir xil kod ketma-ket 2 soniya ichida qayta o'qilmasin
      const hozir = Date.now();
      if (oxirgiKod.current.kod === kod && hozir - oxirgiKod.current.vaqt < 2000) return;
      oxirgiKod.current = { kod, vaqt: hozir };
      qidirish.mutate(kod);
    },
    [qidirish]
  );

  const sotuv = useMutation({
    mutationFn: () =>
      posSotuv({
        satrlar: savat.map((s) => ({ productId: s.productId, miqdor: s.miqdor })),
        tolovTuri,
        mijozNomi: tolovTuri === 'qarz' ? mijozNomi.trim() : undefined,
      }),
    onSuccess: (chek) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['transactions-all'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ombor-mahsulotlar'] });
      setSavat([]);
      setTolovOchiq(false);
      setMijozNomi('');
      Alert.alert('Sotuv yakunlandi', `Chek #${chek.raqam} — ${chek.jamiSumma.toLocaleString('uz-UZ')} so'm`);
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Xatolik', e instanceof ApiError ? e.message : "Sotuvni saqlab bo'lmadi");
    },
  });

  const jami = savat.reduce((s, x) => s + x.narx * x.miqdor, 0);

  if (!ruxsatBor) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top }}>
        <EmptyState title="Bu biznesda POS (magazin kassasi) yoqilmagan" />
      </View>
    );
  }

  const miqdorOzgartir = (productId: string, delta: number) => {
    setSavat((s) =>
      s
        .map((x) => (x.productId === productId ? { ...x, miqdor: x.miqdor + delta } : x))
        .filter((x) => x.miqdor > 0)
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Orqaga" style={{ padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <AppText variant="title" weight="700" style={{ flex: 1 }}>
          Kassa (POS)
        </AppText>
        <Pressable
          onPress={() => setQoldaOchiq(true)}
          hitSlop={10}
          accessibilityLabel="Kodni qo'lda kiritish"
          style={[styles.headerBtn, { backgroundColor: colors.surfaceSunk }]}
        >
          <Ionicons name="keypad-outline" size={18} color={colors.brand} />
        </Pressable>
      </View>

      {/* Skaner maydoni */}
      <View style={[styles.skaner, { backgroundColor: colors.surfaceSunk }]}>
        {skanFaol && permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
            }}
            onBarcodeScanned={({ data }) => data && skanQabul(data)}
          />
        ) : (
          <Pressable
            style={styles.skanerPlaceholder}
            onPress={async () => {
              if (!permission?.granted) {
                const natija = await requestPermission();
                if (!natija.granted) {
                  Alert.alert(
                    'Kamera ruxsati kerak',
                    "Shtrix-kod skanerlash uchun sozlamalardan kamera ruxsatini bering, yoki kodni qo'lda kiriting."
                  );
                  return;
                }
              }
              setSkanFaol(true);
            }}
          >
            <Ionicons name="barcode-outline" size={40} color={colors.inkFaint} />
            <AppText variant="body" tone="soft" center>
              Skanerni yoqish uchun bosing
            </AppText>
          </Pressable>
        )}
        {skanFaol ? (
          <Pressable
            onPress={() => setSkanFaol(false)}
            style={[styles.skanerYop, { backgroundColor: colors.overlay }]}
            accessibilityLabel="Skanerni o'chirish"
          >
            <Ionicons name="close" size={18} color="#FFF" />
          </Pressable>
        ) : null}
      </View>

      {/* Savat */}
      <FlatList
        data={savat}
        keyExtractor={(s) => s.productId}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 140 }}
        ListEmptyComponent={<EmptyState title="Savat bo'sh" subtitle="Mahsulotni skanerlang yoki kodni kiriting" />}
        renderItem={({ item }) => (
          <Card style={styles.savatRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body" weight="600" numberOfLines={1}>
                {item.nomi}
              </AppText>
              <MoneyText value={item.narx} compact variant="small" />
            </View>
            <View style={styles.miqdorWrap}>
              <Pressable
                onPress={() => miqdorOzgartir(item.productId, -1)}
                style={[styles.miqdorBtn, { backgroundColor: colors.surfaceSunk }]}
                accessibilityLabel="Kamaytirish"
              >
                <Ionicons name="remove" size={17} color={colors.ink} />
              </Pressable>
              <AppText variant="bodyLarge" weight="700" tabular style={{ minWidth: 28, textAlign: 'center' }}>
                {item.miqdor}
              </AppText>
              <Pressable
                onPress={() => miqdorOzgartir(item.productId, 1)}
                style={[styles.miqdorBtn, { backgroundColor: colors.surfaceSunk }]}
                accessibilityLabel="Ko'paytirish"
              >
                <Ionicons name="add" size={17} color={colors.ink} />
              </Pressable>
            </View>
            <MoneyText value={item.narx * item.miqdor} variant="bodyLarge" />
          </Card>
        )}
      />

      {/* Pastki panel: jami + sotish */}
      {savat.length > 0 ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.canvas, borderTopColor: colors.line },
          ]}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="soft">
              Jami
            </AppText>
            <MoneyText value={jami} variant="headline" showSom />
          </View>
          <PrimaryButton
            title="Sotish"
            onPress={() => setTolovOchiq(true)}
            style={{ minWidth: 140 }}
          />
        </View>
      ) : null}

      {/* Qo'lda kod kiritish */}
      <BottomSheet visible={qoldaOchiq} onClose={() => setQoldaOchiq(false)} title="Kodni kiriting">
        <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
          <Input
            value={qoldaKod}
            onChangeText={setQoldaKod}
            placeholder="Shtrix-kod, QR yoki SKU"
            autoCapitalize="none"
            autoFocus
          />
          <PrimaryButton
            title="Qidirish"
            onPress={() => {
              const kod = qoldaKod.trim();
              if (!kod) return;
              setQoldaOchiq(false);
              setQoldaKod('');
              qidirish.mutate(kod);
            }}
            loading={qidirish.isPending}
          />
        </View>
      </BottomSheet>

      {/* To'lov varag'i */}
      <BottomSheet visible={tolovOchiq} onClose={() => setTolovOchiq(false)} title="To'lov">
        <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ alignItems: 'center' }}>
            <MoneyText value={jami} variant="display" showSom />
          </View>
          <SegmentedControl<PosTolovTuri>
            segments={[
              { value: 'naqd', label: 'Naqd' },
              { value: 'karta', label: 'Karta' },
              { value: 'click', label: 'Click' },
              { value: 'qarz', label: 'Qarz' },
            ]}
            value={tolovTuri}
            onChange={setTolovTuri}
          />
          {tolovTuri === 'qarz' ? (
            <Input
              label="Mijoz nomi (majburiy)"
              value={mijozNomi}
              onChangeText={setMijozNomi}
              maxLength={100}
            />
          ) : null}
          <PrimaryButton
            title="Sotuvni yakunlash"
            onPress={() => {
              if (tolovTuri === 'qarz' && !mijozNomi.trim()) {
                Alert.alert('Xatolik', 'Qarzga sotishda mijoz nomi kiritilishi shart');
                return;
              }
              if (sotuv.isPending) return;
              sotuv.mutate();
            }}
            loading={sotuv.isPending}
            disabled={sotuv.isPending}
          />
          <SecondaryButton title="Bekor qilish" onPress={() => setTolovOchiq(false)} />
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
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skaner: {
    height: 180,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  skanerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  skanerYop: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  miqdorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  miqdorBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
