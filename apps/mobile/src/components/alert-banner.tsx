import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useAlertBanner } from '@/lib/alerts';
import { colors, fonts, radius, space } from '@/theme/tokens';

const SHOW_MS = 8000;

/** Top banner for the newest stock alert; tap opens the critical stock list. */
export function AlertBanner() {
  const insets = useSafeAreaInsets();
  const alert = useAlertBanner((s) => s.queue[0]);
  const dismiss = useAlertBanner((s) => s.dismiss);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(t);
  }, [alert, dismiss]);

  if (!alert) return null;
  const danger = alert.kind === 'STOCKOUT' || alert.kind === 'CRITICAL';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${alert.title}. ${alert.body}`}
        onPress={() => {
          dismiss();
          router.navigate(danger ? { pathname: '/stock/list', params: { status: 'critical' } } : '/stock/expired');
        }}
        style={[styles.banner, { borderLeftColor: danger ? colors.danger : colors.warning }]}>
        <Ionicons name={danger ? 'warning' : 'time'} size={22} color={danger ? colors.danger : colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.body}>{alert.body}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" hitSlop={10} onPress={dismiss}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 100 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderLeftWidth: 5,
    padding: space.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  body: { fontSize: 12, color: colors.navy },
});
