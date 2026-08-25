import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/tokens';
import { crmKoradi, posKoradi, qarzKoradi } from '../auth/rbac';
import { t } from '../i18n/uz';

interface AddSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface Amal {
  kalit: string;
  nomi: string;
  ikon: keyof typeof Ionicons.glyphMap;
  rang: string;
  wash: string;
  href: string;
}

// Markaziy "+" tugmasi ochadigan varaq. Faqat rol/modul ruxsat bergan amallar chiqadi.
export function AddSheet({ visible, onClose }: AddSheetProps) {
  const { me } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const amallar: Amal[] = [
    {
      kalit: 'kirim',
      nomi: t().qoshish.kirimQoshish,
      ikon: 'arrow-down-circle',
      rang: colors.income,
      wash: colors.incomeWash,
      href: '/yangi-yozuv?turi=kirim',
    },
    {
      kalit: 'chiqim',
      nomi: t().qoshish.chiqimQoshish,
      ikon: 'arrow-up-circle',
      rang: colors.expense,
      wash: colors.expenseWash,
      href: '/yangi-yozuv?turi=chiqim',
    },
  ];

  if (crmKoradi(me)) {
    amallar.push({
      kalit: 'crm',
      nomi: t().qoshish.crmBuyurtma,
      ikon: 'briefcase',
      rang: colors.info,
      wash: colors.infoWash,
      href: '/crm-yangi',
    });
  }
  if (qarzKoradi(me?.rol)) {
    amallar.push({
      kalit: 'qarz',
      nomi: t().qoshish.qarzBerish,
      ikon: 'time',
      rang: colors.debt,
      wash: colors.debtWash,
      href: '/qarzdorlik/yangi',
    });
  }
  if (posKoradi(me)) {
    amallar.push({
      kalit: 'pos',
      nomi: t().qoshish.posSotuv,
      ikon: 'barcode',
      rang: colors.brand,
      wash: colors.brandWash,
      href: '/pos',
    });
  }

  const och = (href: string) => {
    onClose();
    // Sheet yopilishi bilan navigatsiya
    setTimeout(() => router.push(href as never), 80);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t().qoshish.sarlavha}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        {amallar.map((a) => (
          <Pressable
            key={a.kalit}
            onPress={() => och(a.href)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.line,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: a.wash, borderRadius: radius.input }]}>
              <Ionicons name={a.ikon} size={22} color={a.rang} />
            </View>
            <AppText variant="bodyLarge" weight="600" style={{ flex: 1 }}>
              {a.nomi}
            </AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
