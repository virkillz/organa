import { formatPercent, formatRupiah, type ItemShare } from '@organa/shared';
import { StyleSheet, View } from 'react-native';
import { ShareBar } from '@/components/charts';
import { Text } from '@/components/ui/text';
import { qty } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';

/** Ranked list with value, share of total and quantity (the design's "Akumulasi Unit Terbuang"). */
export function RankedItems({ items }: { items: ItemShare[] }) {
  if (!items.length) return <Text style={styles.empty}>Tidak ada bahan terbuang pada periode ini.</Text>;
  return (
    <View style={{ gap: space.md }}>
      {items.map((i) => (
        <View key={i.ingredientId} style={{ gap: 4 }}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {i.name}
            </Text>
            <Text style={styles.value}>{formatRupiah(i.value, { space: true })}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.share}>{formatPercent(i.share, 0)}</Text>
            <Text style={styles.qty}>{qty(i.qty, i.baseUnit)}</Text>
          </View>
          <ShareBar share={i.share} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  value: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  share: { fontSize: 12, color: colors.primary },
  qty: { fontSize: 12, color: colors.navy },
  empty: { color: colors.muted, fontSize: 13 },
});
