import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { StockCount } from '@organa/shared';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Empty, ErrorView, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { longDate, qty, todayJakarta } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Physical count entry for one category: type what is on the shelf, then compare. */
export default function CountEntry() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const outletId = useOutletId();
  const userName = useSession((s) => s.user?.name);
  const categories = useQuery({ queryKey: ['stock-categories'], queryFn: api.stockCategories });
  const count = useQuery({ queryKey: ['count-open', outletId, categoryId], queryFn: () => api.startCount(outletId, categoryId), enabled: !!outletId, gcTime: 0 });
  if (count.isPending) return <Loading />;
  if (count.isError) return <ErrorView error={count.error} onRetry={() => count.refetch()} />;
  return <CountForm key={count.data.id} count={count.data} categoryName={categories.data?.find((c) => c.id === categoryId)?.name ?? ''} userName={userName ?? ''} />;
}

function CountForm({ count, categoryName, userName }: { count: StockCount; categoryName: string; userName: string }) {
  const categoryId = count.categoryId;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(count.lines.map((l) => [l.ingredientId, l.counted === null ? '' : String(Math.round(l.counted))])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = Object.values(values).filter((v) => v !== '').length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const lines = Object.entries(values)
        .filter(([, v]) => v !== '')
        .map(([ingredientId, v]) => ({ ingredientId, counted: Number(v.replace(',', '.')) }));
      await api.saveCountLines(count.id, { lines });
      await queryClient.invalidateQueries({ queryKey: ['count-latest'] });
      router.navigate({ pathname: '/comparison', params: { categoryId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Update Stok Opname' }} />
      <FlatList
        data={count.lines}
        keyExtractor={(l) => l.ingredientId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 2, marginBottom: space.sm }}>
            <Text style={styles.heading}>UPDATE STOK {categoryName.toUpperCase()}</Text>
            <Text style={styles.sub}>
              {longDate(todayJakarta())} · Input oleh {userName}
            </Text>
          </View>
        }
        ListEmptyComponent={<Empty title="Belum ada bahan di kategori ini" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons name="cube-outline" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{item.name}</Text>
              <Text style={styles.system}>Sistem: {qty(item.expected, item.baseUnit)}</Text>
            </View>
            <View style={styles.inputBox}>
              <TextInput
                accessibilityLabel={`Jumlah fisik ${item.name}`}
                value={values[item.ingredientId] ?? ''}
                onChangeText={(t) => setValues((v) => ({ ...v, [item.ingredientId]: t.replace(/[^\d.,]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.unit}>{item.baseUnit}</Text>
            </View>
          </View>
        )}
      />
      <View style={[styles.footer, { paddingBottom: space.md + insets.bottom }]}>
        {error ? <Text variant="error">{error}</Text> : null}
        <Text style={styles.sub}>
          {filled} dari {count.lines.length} bahan dihitung
        </Text>
        <Button title="SIMPAN & BANDINGKAN" onPress={save} loading={saving} disabled={!filled} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, gap: space.sm },
  heading: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 18, color: colors.navy },
  sub: { textAlign: 'center', fontSize: 12, color: colors.navy },
  system: { fontSize: 12, color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primaryTint, padding: space.sm + 4 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surfaceTint, borderRadius: radius.sm, paddingHorizontal: space.sm },
  input: { width: 80, fontFamily: fonts.semibold, fontSize: 17, textAlign: 'right', paddingVertical: 8, color: colors.ink },
  unit: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
  footer: { backgroundColor: colors.white, padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
});
