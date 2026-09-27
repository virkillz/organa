import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah } from '@organa/shared';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { cartCount, cartTotal, useCart } from '@/lib/cart';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function Cart() {
  const insets = useSafeAreaInsets();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const clear = useCart((s) => s.clear);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Transaksi Saat Ini' }} />
      <FlatList
        data={lines}
        keyExtractor={(l) => l.key}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty icon="cart-outline" title="Keranjang kosong" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.name}
                {item.kind === 'manual' ? <Text style={styles.manual}> (manual)</Text> : null}
              </Text>
              <Text style={styles.price}>
                {formatRupiah(item.unitPrice)} × {item.qty} = {formatRupiah(item.unitPrice * item.qty)}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Kurangi ${item.name}`} hitSlop={6} onPress={() => setQty(item.key, item.qty - 1)} style={styles.step}>
                <Ionicons name={item.qty === 1 ? 'trash-outline' : 'remove'} size={18} color={colors.primary} />
              </Pressable>
              <Text style={styles.qty}>{item.qty}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Tambah ${item.name}`} hitSlop={6} onPress={() => setQty(item.key, item.qty + 1)} style={styles.step}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button title="+ INPUT MANUAL" variant="outline" onPress={() => router.push('/pos/manual')} />
            {lines.length ? <Button title="KOSONGKAN" variant="light" onPress={clear} /> : null}
          </View>
        }
      />
      <View style={[styles.footer, { paddingBottom: space.md + insets.bottom }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{cartCount(lines)} Items</Text>
          <Text style={styles.total}>{formatRupiah(cartTotal(lines))}</Text>
        </View>
        <Button title="BAYAR" onPress={() => router.push('/pos/pay')} disabled={!lines.length} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.md, padding: space.md },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  manual: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  price: { fontSize: 13, color: colors.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 16, minWidth: 22, textAlign: 'center' },
  footer: { backgroundColor: colors.white, padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: colors.navy },
  total: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary },
});
