import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
// expo-router SDK 57 react-navigation'ni o'zi bilan olib yuradi — tip shu yerdan
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { AppText } from '../../components/AppText';
import { AddSheet } from '../../components/AddSheet';
import { crmKoradi } from '../../auth/rbac';
import { spacing } from '../../theme/tokens';
import { t } from '../../i18n/uz';

const IKONLAR: Record<string, { faol: keyof typeof Ionicons.glyphMap; oddiy: keyof typeof Ionicons.glyphMap }> = {
  index: { faol: 'home', oddiy: 'home-outline' },
  'kirim-chiqim': { faol: 'swap-vertical', oddiy: 'swap-vertical-outline' },
  crm: { faol: 'briefcase', oddiy: 'briefcase-outline' },
  menyu: { faol: 'grid', oddiy: 'grid-outline' },
};

function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [addOchiq, setAddOchiq] = useState(false);

  const routes = state.routes.filter((r: (typeof state.routes)[number]) => {
    const opts = descriptors[r.key].options;
    // href: null bilan yashirilgan tablar
    return (opts as { href?: unknown }).href !== null;
  });

  // Markaziy tugma o'rtaga: birinchi yarim / [+] / ikkinchi yarim
  const yarim = Math.ceil(routes.length / 2);

  const tabTugma = (route: (typeof routes)[number]) => {
    const { options } = descriptors[route.key];
    const label = options.title ?? route.name;
    const focused = state.routes[state.index].key === route.key;
    const ikon = IKONLAR[route.name] ?? IKONLAR.index;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        style={styles.tab}
      >
        <Ionicons
          name={focused ? ikon.faol : ikon.oddiy}
          size={23}
          color={focused ? colors.brand : colors.inkFaint}
        />
        <AppText
          variant="caption"
          weight={focused ? '600' : '500'}
          style={{ color: focused ? colors.brand : colors.inkFaint, marginTop: 2 }}
          numberOfLines={1}
        >
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.line,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        {routes.slice(0, yarim).map(tabTugma)}
        <View style={styles.addWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t().qoshish.sarlavha}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setAddOchiq(true);
            }}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.brand, transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}
          >
            <Ionicons name="add" size={30} color={colors.brandFg} />
          </Pressable>
        </View>
        {routes.slice(yarim).map(tabTugma)}
      </View>
      <AddSheet visible={addOchiq} onClose={() => setAddOchiq(false)} />
    </>
  );
}

export default function TabsLayout() {
  const { status, me } = useAuth();

  if (status === 'chiqqan') return <Redirect href="/login" />;
  if (me?.mustChangePassword) return <Redirect href="/parol-ozgartirish" />;

  const crmBor = crmKoradi(me);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t().tab.asosiy }} />
      <Tabs.Screen name="kirim-chiqim" options={{ title: t().tab.kirimChiqim }} />
      <Tabs.Screen name="crm" options={{ title: t().tab.crm, href: crmBor ? undefined : null }} />
      <Tabs.Screen name="menyu" options={{ title: t().tab.menyu }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 48,
  },
  addWrap: {
    width: 72,
    alignItems: 'center',
  },
  addButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
