import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, ErrorView, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { shortDate, time } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** "Simpulan & Sugesti": the cached insight text for an analysis or forecast period. */
export function InsightView({ kind, period, periodLabel }: { kind: 'analysis' | 'forecast'; period: string; periodLabel: string }) {
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const key = ['insight', outletId, kind, period];
  const insight = useQuery({ queryKey: key, queryFn: () => api.insight(outletId, kind, period), enabled: !!outletId });
  const regenerate = useMutation({
    mutationFn: () => api.regenerateInsight(outletId, kind, period),
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });

  if (insight.isPending) return <Loading />;
  if (insight.isError) return <ErrorView error={insight.error} onRetry={() => insight.refetch()} />;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={insight.isRefetching} onRefresh={() => insight.refetch()} />}>
      <Text style={styles.period}>{periodLabel}</Text>
      {insight.data.sections.map((s) => {
        const strategic = s.title === 'Saran Strategis';
        return (
          <Card key={s.title} tone="plain" style={[styles.card, strategic && styles.strategic]}>
            <Text style={styles.title}>{s.title}</Text>
            {s.bullets.map((b, i) => (
              <View key={i} style={styles.bullet}>
                <View style={styles.dot} />
                <Text style={styles.text}>{b}</Text>
              </View>
            ))}
          </Card>
        );
      })}
      <View style={styles.footer}>
        <Text style={styles.meta}>
          {insight.data.source === 'claude' ? 'Ditulis oleh AI (Claude) dari data stok' : 'Dibuat otomatis dari data stok'} · {shortDate(insight.data.generatedAt)} {time(insight.data.generatedAt)}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => regenerate.mutate()} disabled={regenerate.isPending} style={styles.regen} hitSlop={8}>
          <Ionicons name="refresh" size={14} color={colors.primary} />
          <Text style={styles.regenText}>{regenerate.isPending ? 'Memperbarui…' : 'Perbarui'}</Text>
        </Pressable>
      </View>
      {insight.data.source === 'claude' ? <Text style={styles.meta}>Semua angka dihitung dari transaksi dan stok; AI hanya menyusun kalimat.</Text> : null}
      {regenerate.isError ? <Text variant="error">{regenerate.error.message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  period: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, textAlign: 'center' },
  card: { borderWidth: 1.5, borderColor: colors.primaryTint, gap: space.sm, borderRadius: radius.md },
  strategic: { backgroundColor: colors.suggestionBg },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  bullet: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryDark, marginTop: 7 },
  text: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.navy },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  meta: { flex: 1, fontSize: 11, color: colors.muted },
  regen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  regenText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
});
