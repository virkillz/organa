import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, PAYMENT_LABELS, type PaymentMethod } from '@organa/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keypad } from '@/components/keypad';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { cartTotal, useCart } from '@/lib/cart';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

const NON_CASH: { group: string; methods: PaymentMethod[] }[] = [
  { group: 'QRIS', methods: ['QRIS'] },
  { group: 'E-Wallet', methods: ['GOPAY', 'DANA', 'FLIP'] },
  { group: 'Bank / Kartu', methods: ['BCA', 'MAESTRO', 'MASTERCARD'] },
];
const SIMULATED_WAIT_MS = 2000;

export default function Pay() {
  const insets = useSafeAreaInsets();
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const lines = useCart((s) => s.lines);
  const total = cartTotal(lines);
  const [tab, setTab] = useState<'cash' | 'noncash'>('cash');
  const [digits, setDigits] = useState('');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);

  const tendered = Number(digits || 0);

  const submit = async (payment: { method: PaymentMethod; tendered?: number }) => {
    setError(null);
    const { checkoutId, setCheckoutId, finish } = useCart.getState();
    // One id per checkout attempt: a retry after a network error cannot create a second order.
    const clientId = checkoutId ?? Crypto.randomUUID();
    setCheckoutId(clientId);
    try {
      if (payment.method !== 'CASH') {
        setStatus('waiting');
        await new Promise((r) => setTimeout(r, SIMULATED_WAIT_MS));
      }
      setStatus('saving');
      const order = await api.createOrder({
        clientId,
        outletId,
        lines: lines.map((l) => (l.kind === 'product' ? { productId: l.productId, qty: l.qty } : { name: l.name, unitPrice: l.unitPrice, qty: l.qty })),
        payment,
      });
      finish(order);
      // Stock, dashboard and analysis all change after a sale.
      queryClient.invalidateQueries();
      router.dismissTo('/pos');
      router.push('/pos/success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pembayaran gagal');
      setStatus('idle');
    }
  };

  if (status !== 'idle') {
    return (
      <View style={styles.waiting}>
        <Stack.Screen options={{ title: 'Metode Pembayaran' }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="heading" style={{ textAlign: 'center' }}>
          {status === 'waiting' ? `Menunggu pembayaran ${method ? PAYMENT_LABELS[method] : ''}` : 'Menyimpan transaksi'}
        </Text>
        {status === 'waiting' ? <Text style={{ color: colors.muted, textAlign: 'center' }}>Simulasi: pembayaran non-tunai dikonfirmasi otomatis untuk demo.</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Metode Pembayaran' }} />
      <View style={styles.bill}>
        <Text style={styles.billLabel}>Total bill:</Text>
        <Text style={styles.billValue}>{formatRupiah(total)}</Text>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['cash', 'noncash'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'cash' ? 'Cash' : 'Non Cash'}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text variant="error" style={{ padding: space.md }}>{error}</Text> : null}

      {tab === 'cash' ? (
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" onPress={() => setDigits(String(total))} style={styles.exact}>
            <Ionicons name="wallet-outline" size={20} color={colors.navy} />
            <Text style={styles.exactText}>EXACT AMOUNT</Text>
          </Pressable>
          <View style={styles.display}>
            <Text style={styles.displayLabel}>Input Price</Text>
            <Text style={[styles.displayValue, !digits && { color: colors.primaryTint }]}>{formatRupiah(tendered)}</Text>
            {tendered >= total && digits ? <Text style={styles.change}>Kembalian: {formatRupiah(tendered - total)}</Text> : null}
            {digits && tendered < total ? <Text variant="error">Kurang {formatRupiah(total - tendered)}</Text> : null}
          </View>
          <View style={{ paddingBottom: insets.bottom }}>
            <Keypad value={digits} onChange={setDigits} enterDisabled={tendered < total || !lines.length} onEnter={() => submit({ method: 'CASH', tendered })} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.methods, { paddingBottom: insets.bottom + space.xl }]}>
          {NON_CASH.map((g) => (
            <View key={g.group} style={{ gap: space.sm }}>
              <Text style={styles.group}>{g.group}</Text>
              <View style={styles.methodRow}>
                {g.methods.map((m) => (
                  <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: method === m }} onPress={() => setMethod(m)} style={[styles.method, method === m && styles.methodOn]}>
                    <Text style={[styles.methodText, method === m && { color: colors.primary }]}>{PAYMENT_LABELS[m]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={!method || !lines.length}
            onPress={() => method && submit({ method })}
            style={[styles.enter, (!method || !lines.length) && { opacity: 0.5 }]}>
            <Text style={styles.enterText}>ENTER</Text>
          </Pressable>
          <Text variant="caption" style={{ textAlign: 'center' }}>
            Pembayaran non-tunai disimulasikan untuk demo; integrasi QRIS menyusul.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bill: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  billLabel: { fontSize: 14, color: colors.navy },
  billValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.primary },
  tabs: { flexDirection: 'row', backgroundColor: colors.white },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.navy },
  tabText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.line },
  tabTextOn: { color: colors.navy },
  exact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: colors.white, margin: space.sm, marginBottom: 0, padding: space.md, borderRadius: 8 },
  exactText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  display: { flex: 1, backgroundColor: colors.white, margin: space.sm, borderRadius: 8, padding: space.md, gap: 4 },
  displayLabel: { fontSize: 14, color: colors.navy },
  displayValue: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 40, color: colors.ink },
  change: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
  methods: { padding: space.md, gap: space.lg },
  group: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  methodRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  method: { flexGrow: 1, minWidth: '30%', alignItems: 'center', paddingVertical: space.md, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line },
  methodOn: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  methodText: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
  enter: { backgroundColor: colors.primaryLight, borderRadius: 8, alignItems: 'center', paddingVertical: 18 },
  enterText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
});
