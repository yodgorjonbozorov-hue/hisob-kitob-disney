import React, { useState } from 'react';
import { Pressable, View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/tokens';
import { ApiError } from '../api/client';

// Yuqori panel: aktiv biznes nomi; bir nechta biznes bo'lsa bosilganda tanlash varag'i.
export function BusinessSwitcher() {
  const { me, switchBusiness } = useAuth();
  const { colors } = useTheme();
  const [ochiq, setOchiq] = useState(false);
  const [almashayotgan, setAlmashayotgan] = useState<string | null>(null);

  const aktiv = me?.businesses.find((b) => b.id === me.activeBusinessId) ?? me?.businesses[0];
  const koTanlov = (me?.businesses.length ?? 0) > 1;

  if (!aktiv) {
    return (
      <AppText variant="bodyLarge" weight="700">
        Balansa
      </AppText>
    );
  }

  const tanla = async (id: string) => {
    if (id === me?.activeBusinessId) {
      setOchiq(false);
      return;
    }
    setAlmashayotgan(id);
    try {
      await switchBusiness(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOchiq(false);
    } catch (e) {
      Alert.alert('Xatolik', e instanceof ApiError ? e.message : "Biznesni almashtirib bo'lmadi");
    } finally {
      setAlmashayotgan(null);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => koTanlov && setOchiq(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Biznes tanlash"
        disabled={!koTanlov}
      >
        <AppText variant="bodyLarge" weight="700" numberOfLines={1} style={{ maxWidth: 220 }}>
          {aktiv.nomi}
        </AppText>
        {koTanlov ? (
          <Ionicons name="chevron-down" size={16} color={colors.inkSoft} style={{ marginLeft: 4 }} />
        ) : null}
      </Pressable>

      <BottomSheet visible={ochiq} onClose={() => setOchiq(false)} title="Biznesni tanlang" scroll>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {me?.businesses.map((b) => {
            const tanlangan = b.id === me.activeBusinessId;
            return (
              <Pressable
                key={b.id}
                onPress={() => tanla(b.id)}
                style={[
                  styles.row,
                  {
                    backgroundColor: tanlangan ? colors.brandWash : colors.surface,
                    borderRadius: radius.card,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: tanlangan ? colors.brand : colors.line,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" weight="600">
                    {b.nomi}
                  </AppText>
                  {!b.isActive ? (
                    <AppText variant="small" tone="faint">
                      Nofaol
                    </AppText>
                  ) : null}
                </View>
                {almashayotgan === b.id ? (
                  <ActivityIndicator color={colors.brand} />
                ) : tanlangan ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
});
