import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/theme/tokens';

/** Placeholder for screens scheduled in a later sprint of the demo plan. */
export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Ionicons name="construct-outline" size={40} color={colors.primary} />
      </View>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      <Text style={[styles.center, styles.note]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  center: { textAlign: 'center' },
  note: { color: colors.muted },
});
