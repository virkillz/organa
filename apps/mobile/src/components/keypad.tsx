import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '000'],
];
const MAX_DIGITS = 10;

/** Numeric keypad for rupiah amounts, with backspace and ENTER on the right. */
export function Keypad({ value, onChange, onEnter, enterDisabled }: { value: string; onChange: (v: string) => void; onEnter: () => void; enterDisabled?: boolean }) {
  const press = (k: string) => {
    if (k === 'C') return onChange('');
    const next = (value + k).replace(/^0+/, '');
    if (next.length <= MAX_DIGITS) onChange(next);
  };
  return (
    <View style={styles.pad}>
      <View style={styles.digits}>
        {KEYS.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((k) => (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === 'C' ? 'Hapus semua' : k} onPress={() => press(k)} style={({ pressed }) => [styles.key, pressed && styles.pressed]}>
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel="Hapus satu angka" onPress={() => onChange(value.slice(0, -1))} style={({ pressed }) => [styles.key, styles.back, pressed && styles.pressed]}>
          <Ionicons name="backspace-outline" size={28} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: enterDisabled }}
          disabled={enterDisabled}
          onPress={onEnter}
          style={({ pressed }) => [styles.key, styles.enter, enterDisabled && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}>
          <Text style={styles.enterText}>ENTER</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.backgroundAlt },
  digits: { flex: 3, gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  side: { flex: 1, gap: 4 },
  key: { flex: 1, minHeight: 58, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  pressed: { backgroundColor: colors.surfaceTint },
  keyText: { fontFamily: fonts.regular, fontSize: 22, color: colors.navy },
  back: { flex: 1 },
  enter: { flex: 1, backgroundColor: colors.primaryLight },
  enterText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
