import Ionicons from '@expo/vector-icons/Ionicons';
import { ROLE_LABELS } from '@organa/shared';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/fields';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { menuFor } from '@/lib/menu';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, space } from '@/theme/tokens';

const comingSoon = (feature: string) => Alert.alert(feature, 'Fitur ini segera hadir.');

export function AppDrawer({ state }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const activeOutletId = useSession((s) => s.activeOutletId);
  const outlets = useQuery({ queryKey: ['outlets'], queryFn: api.outlets, enabled: !!user });
  if (!user) return null;

  const activeRoute = state.routes[state.index]?.name;
  const isOwner = user.role === 'OWNER';

  const switchOutlet = async (id: string) => {
    // A cart belongs to one outlet's menu and stock.
    useCart.getState().clear();
    await useSession.getState().setActiveOutlet(id);
    // Every outlet-scoped query keys on the outlet, but clear anything cached without it.
    await queryClient.invalidateQueries();
  };

  const logout = async () => {
    const { refreshToken, signOut } = useSession.getState();
    if (refreshToken) api.logout(refreshToken).catch(() => {});
    queryClient.clear();
    useCart.getState().clear();
    await signOut();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
            <Text style={styles.brandText}>Organa</Text>
          </View>
          <View style={styles.plan}>
            <Text style={styles.planText}>{user.plan}</Text>
          </View>
        </View>
        <Text style={styles.tenant}>{user.tenantName ?? 'Bisnis saya'}</Text>

        <View style={styles.outlet}>
          {isOwner && outlets.data && outlets.data.length > 0 ? (
            <SelectField
              label="Pilih Cabang"
              tone="onPrimary"
              value={activeOutletId}
              onChange={switchOutlet}
              options={outlets.data.map((o) => ({ value: o.id, label: o.name }))}
            />
          ) : (
            <Text style={styles.outletText}>{outlets.data?.find((o) => o.id === activeOutletId)?.name ?? 'Cabang'}</Text>
          )}
        </View>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.userRole}>{ROLE_LABELS[user.role]}</Text>
          </View>
          {user.kind === 'employee' ? (
            <Pressable accessibilityRole="button" style={styles.attendance} onPress={() => comingSoon('Absensi')}>
              <Text style={styles.attendanceText}>Absensi</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.menu}>
          {menuFor(user.role).map((item) => {
            const active = activeRoute === item.route;
            return (
              <Pressable
                key={item.route}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(`/${item.route}` as never)}
                style={[styles.item, active && styles.itemActive]}>
                <Ionicons name={item.icon} size={22} color={colors.white} />
                <Text style={styles.itemText}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable accessibilityRole="button" onPress={logout} style={styles.item}>
          <Ionicons name="log-out-outline" size={22} color={colors.white} />
          <Text style={styles.itemText}>Keluar</Text>
        </Pressable>
        <Button title="UPGRADE TO PREMIUM" variant="light" onPress={() => comingSoon('Organa Premium')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryDark },
  scroll: { paddingHorizontal: space.md, paddingBottom: space.md },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  plan: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 2 },
  planText: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
  tenant: { fontFamily: fonts.bold, fontSize: 18, color: colors.white, marginTop: space.md },
  outlet: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginTop: space.sm,
  },
  outletText: { color: colors.white, fontSize: 13, paddingVertical: 8 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontFamily: fonts.semibold, color: colors.white },
  userRole: { fontSize: 12, color: colors.white },
  attendance: { backgroundColor: colors.white, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  attendanceText: { fontSize: 12, color: colors.primary },
  menu: { marginTop: space.md, gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11, paddingHorizontal: space.sm, borderRadius: radius.sm },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  itemText: { color: colors.white, fontSize: 15 },
  footer: { paddingHorizontal: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.3)', paddingTop: space.sm },
});
