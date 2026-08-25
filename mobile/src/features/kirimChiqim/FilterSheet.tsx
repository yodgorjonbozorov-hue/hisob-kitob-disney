import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { AppText } from '../../components/AppText';
import { BottomSheet } from '../../components/BottomSheet';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Input } from '../../components/Input';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, radius } from '../../theme/tokens';
import { formatAmountInput, parseAmountInput } from '../../utils/money';
import { BOSHLANGICH_FILTR, KcFiltr } from './filtrlar';
import type { TolovGuruhi } from '../../api/types';
import { t } from '../../i18n/uz';

const TOLOVLAR: { value: TolovGuruhi; label: string }[] = [
  { value: 'naqd', label: 'Naqd' },
  { value: 'click', label: 'Click' },
  { value: 'karta', label: 'Karta / hisob' },
  { value: 'qarz', label: 'Qarz' },
];

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filtr: KcFiltr;
  onApply: (filtr: KcFiltr) => void;
}

export function FilterSheet({ visible, onClose, filtr, onApply }: FilterSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filtr" scroll>
      {/* Har ochilishda yangi mount — ish holati prop'dan boshlanadi */}
      {visible ? (
        <FiltrTanasi
          filtr={filtr}
          onApply={(f) => {
            onApply(f);
            onClose();
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

function FiltrTanasi({ filtr, onApply }: { filtr: KcFiltr; onApply: (f: KcFiltr) => void }) {
  const { colors } = useTheme();
  const [ish, setIsh] = useState<KcFiltr>(filtr);
  const [minText, setMinText] = useState(
    filtr.minSumma != null ? formatAmountInput(String(filtr.minSumma)) : ''
  );
  const [maxText, setMaxText] = useState(
    filtr.maxSumma != null ? formatAmountInput(String(filtr.maxSumma)) : ''
  );

  const qollash = () => {
    onApply({
      ...ish,
      minSumma: parseAmountInput(minText) ?? undefined,
      maxSumma: parseAmountInput(maxText) ?? undefined,
    });
  };

  const tozalash = () => {
    onApply({ ...BOSHLANGICH_FILTR, davr: ish.davr, q: filtr.q });
  };

  return (
    <View style={{ gap: spacing.xl, paddingBottom: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="small" tone="soft" weight="600">
          Turi
        </AppText>
        <SegmentedControl
          segments={[
            { value: 'hammasi', label: t().umumiy.hammasi },
            { value: 'kirim', label: t().moliya.kirim },
            { value: 'chiqim', label: t().moliya.chiqim },
          ]}
          value={ish.turi ?? 'hammasi'}
          onChange={(v) =>
            setIsh((s) => ({ ...s, turi: v === 'hammasi' ? undefined : (v as 'kirim' | 'chiqim') }))
          }
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="small" tone="soft" weight="600">
          {t().moliya.tolovTuri}
        </AppText>
        <View style={styles.chips}>
          {TOLOVLAR.map(({ value, label }) => {
            const faol = ish.tolov === value;
            return (
              <Pressable
                key={value}
                onPress={() => setIsh((s) => ({ ...s, tolov: faol ? undefined : value }))}
                style={[
                  styles.chip,
                  {
                    backgroundColor: faol ? colors.brandWash : colors.surfaceSunk,
                    borderColor: faol ? colors.brand : colors.line,
                  },
                ]}
              >
                <AppText variant="small" weight={faol ? '600' : '500'} tone={faol ? 'brand' : 'soft'}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="small" tone="soft" weight="600">
          Summa oralig'i
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            containerStyle={{ flex: 1 }}
            value={minText}
            onChangeText={(v) => setMinText(formatAmountInput(v))}
            keyboardType="number-pad"
            placeholder="Min"
          />
          <Input
            containerStyle={{ flex: 1 }}
            value={maxText}
            onChangeText={(v) => setMaxText(formatAmountInput(v))}
            keyboardType="number-pad"
            placeholder="Max"
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton title={t().umumiy.qollash} onPress={qollash} />
        <SecondaryButton title={t().umumiy.tozalash} onPress={tozalash} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
