import { formatRupiah } from '@organa/shared';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keypad } from '@/components/keypad';
import { Text } from '@/components/ui/text';
import { useCart } from '@/lib/cart';
import { colors, fonts, space } from '@/theme/tokens';

/** Open-price item (not in the menu). It is sold without deducting any stock. */
export default function ManualInput() {
  const insets = useSafeAreaInsets();
  const addManual = useCart((s) => s.addManual);
  const [digits, setDigits] = useState('');
  const [name, setName] = useState('');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Input Manual' }} />
      <View style={styles.display}>
        <TextInput value={name} onChangeText={setName} placeholder="Nama item (opsional)" style={styles.name} placeholderTextColor={colors.muted} />
        <Text style={styles.label}>Input Price</Text>
        <Text style={[styles.amount, !digits && { color: colors.primaryTint }]}>{formatRupiah(Number(digits || 0))}</Text>
        <Text variant="caption">Item manual tidak mengurangi stok bahan.</Text>
      </View>
      <View style={{ paddingBottom: insets.bottom }}>
        <Keypad
          value={digits}
          onChange={setDigits}
          enterDisabled={!Number(digits)}
          onEnter={() => {
            addManual(name.trim() || 'Item Manual', Number(digits));
            router.back();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  display: { flex: 1, backgroundColor: colors.white, margin: space.sm, borderRadius: 8, padding: space.md, gap: space.sm },
  name: { fontFamily: fonts.medium, fontSize: 16, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8, color: colors.ink },
  label: { fontSize: 14, color: colors.navy, marginTop: space.sm },
  amount: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 40, color: colors.ink },
});
