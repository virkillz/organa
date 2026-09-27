import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, PAYMENT_LABELS } from '@organa/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useCart } from '@/lib/cart';
import { time } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function Success() {
  const order = useCart((s) => s.lastOrder);
  const [email, setEmail] = useState('');
  if (!order) return null;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.checkOuter}>
            <View style={styles.checkInner}>
              <Ionicons name="checkmark-circle" size={44} color={colors.white} />
            </View>
          </View>
          <Text style={styles.title}>Transaksi Sukses!</Text>
          <Text style={styles.note}>NOTE: Cek kembali nota dan nominal pembayaran.</Text>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>Metode Pembayaran: {PAYMENT_LABELS[order.method].toUpperCase()}</Text>
            <View style={styles.summaryDivider} />
            <Text style={styles.summaryText}>{order.method === 'CASH' ? `Kembalian: ${formatRupiah(order.change)}` : `Total: ${formatRupiah(order.total)}`}</Text>
          </View>
          <Text style={styles.meta}>
            No. {order.number} · {time(order.createdAt)} · {order.cashierName}
          </Text>
          {order.alerts.length ? (
            <View style={styles.alerts}>
              {order.alerts.map((a) => (
                <View key={a.ingredientId} style={styles.alertRow}>
                  <Ionicons name={a.kind === 'STOCKOUT' ? 'alert-circle' : 'warning'} size={16} color={colors.danger} />
                  <Text style={styles.alertText}>
                    {a.name} {a.kind === 'STOCKOUT' ? 'habis' : 'mencapai stok kritis'}; dapur sudah diberi tahu.
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.email} placeholderTextColor={colors.muted} />
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Kirim receipt', email ? `Receipt akan dikirim ke ${email} (simulasi untuk demo).` : 'Isi email pelanggan terlebih dahulu.')}
            style={styles.send}>
            <Text style={styles.sendText}>KIRIM RECEIPT</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Print receipt', 'Printer Bluetooth belum terhubung. Fitur cetak menyusul setelah demo.')} style={[styles.action, styles.actionOutline]}>
          <Text style={[styles.actionText, { color: colors.white }]}>PRINT RECEIPT</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/pos')} style={styles.action}>
          <Text style={styles.actionText}>NEXT ORDER</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryLight },
  content: { padding: space.lg, paddingTop: space.xl * 1.5 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: space.lg, alignItems: 'center', gap: space.sm },
  checkOuter: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#EEF3F8', alignItems: 'center', justifyContent: 'center' },
  checkInner: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.primaryDark },
  note: { fontSize: 12, color: colors.navy, textAlign: 'center' },
  summary: { alignSelf: 'stretch', backgroundColor: colors.primaryDark, borderRadius: 6, padding: space.md, gap: space.sm, marginTop: space.sm },
  summaryText: { fontFamily: fonts.medium, color: colors.white, textAlign: 'center' },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  meta: { fontSize: 12, color: colors.muted },
  alerts: { alignSelf: 'stretch', backgroundColor: colors.dangerBg, borderRadius: 8, padding: space.sm + 4, gap: 6 },
  alertRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  alertText: { flex: 1, fontSize: 12, color: colors.danger },
  email: { alignSelf: 'stretch', borderWidth: 1, borderColor: colors.line, borderRadius: 6, padding: space.sm + 4, textAlign: 'center', marginTop: space.md, fontFamily: fonts.regular, color: colors.ink },
  send: { alignSelf: 'stretch', backgroundColor: colors.suggestionBg, borderRadius: 6, padding: space.sm + 4, alignItems: 'center' },
  sendText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primaryDark },
  actions: { padding: space.lg, gap: space.md },
  action: { backgroundColor: colors.white, borderRadius: 6, paddingVertical: 16, alignItems: 'center' },
  actionOutline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.white },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primaryDark },
});
