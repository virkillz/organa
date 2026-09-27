import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

/** Organa mark (check inside two rings) with the wordmark, drawn natively so it stays sharp. */
export function Logo({ size = 150, color = colors.white }: { size?: number; color?: string }) {
  const ring = Math.max(6, size * 0.07);
  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="Organa">
      <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: color }]}>
        <View
          style={[
            styles.center,
            { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, borderWidth: ring * 0.55, borderColor: color },
          ]}>
          <Ionicons name="checkmark" size={size * 0.4} color={color} />
        </View>
      </View>
      <Text style={[styles.word, { color, fontSize: size * 0.4, lineHeight: size * 0.5 }]}>Organa</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 4 },
  center: { alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: fonts.semibold, letterSpacing: 0.5 },
});
