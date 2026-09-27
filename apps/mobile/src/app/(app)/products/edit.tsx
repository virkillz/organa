import Ionicons from '@expo/vector-icons/Ionicons';
import {
  COST_LINE_LABELS,
  COST_LINE_TYPES,
  formatPercent,
  MANUAL_COST_UNITS,
  toBase,
  unitsFor,
  type CostLineInput,
  type CostLineType,
  type Ingredient,
  type ProductDetail,
  type StockUnit,
} from '@organa/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { OptionSheet } from '@/components/category-picker';
import { Button } from '@/components/ui/button';
import { BoxButton, BoxField, ErrorView, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api, ApiError, assetUrl } from '@/lib/api';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Form state for one cost line; numbers are kept as strings while editing. */
type Line = { key: string; type: CostLineType; ingredientId?: string; label: string; qty: string; unit: string; value: string };
let seq = 0;
const newLine = (type: CostLineType): Line => ({ key: `l${seq++}`, type, label: '', qty: type === 'INGREDIENT' ? '' : '1', unit: type === 'INGREDIENT' ? 'gr' : type === 'LABOUR' ? 'org' : 'pcs', value: '' });
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;
const rupiahDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

type Sheet = { kind: 'category' } | { kind: 'add' } | { kind: 'ingredient'; key: string } | { kind: 'unit'; key: string } | null;

export default function EditProduct() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const outletId = useOutletId();
  const existing = useQuery({ queryKey: ['product', params.id, outletId], queryFn: () => api.product(params.id!, outletId), enabled: !!params.id && !!outletId });
  if (params.id && existing.isPending) return <Loading />;
  if (existing.isError) return <ErrorView error={existing.error} onRetry={() => existing.refetch()} />;
  return <ProductForm key={params.id ?? 'new'} product={existing.data} initialCategoryId={params.categoryId} />;
}

function ProductForm({ product: p, initialCategoryId }: { product?: ProductDetail; initialCategoryId?: string }) {
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: api.productCategories });
  const ingredients = useQuery({ queryKey: ['ingredients'], queryFn: () => api.ingredients() });
  const stock = useQuery({ queryKey: ['stock', outletId, null, undefined], queryFn: () => api.stock(outletId), enabled: !!outletId });

  const [pickedCategoryId, setCategoryId] = useState<string | null>(p?.categoryId ?? initialCategoryId ?? null);
  const categoryId = pickedCategoryId ?? categories.data?.[0]?.id ?? null;
  const [name, setName] = useState(p?.name ?? '');
  const [price, setPrice] = useState(p ? rupiahDigits(p.price) : '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(p?.photoUrl ?? null);
  const [lines, setLines] = useState<Line[]>(() =>
    p
      ? p.costLines.map((l) => ({
          key: `l${seq++}`, type: l.type, ingredientId: l.ingredientId ?? undefined, label: l.label,
          qty: String(l.qty), unit: l.unit, value: l.type === 'INGREDIENT' ? '' : rupiahDigits(l.value),
        }))
      : [newLine('INGREDIENT')],
  );
  const [sheet, setSheet] = useState<Sheet>(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const ingById = useMemo(() => new Map((ingredients.data ?? []).map((i) => [i.id, i])), [ingredients.data]);
  const costById = useMemo(() => new Map((stock.data ?? []).map((s) => [s.ingredientId, s.avgCost])), [stock.data]);

  /** Ingredient lines are costed live from the outlet's average cost; others use the typed value. */
  const lineValue = (l: Line) => {
    if (l.type !== 'INGREDIENT') return num(l.value);
    const ing = l.ingredientId ? ingById.get(l.ingredientId) : undefined;
    if (!ing || !unitsFor(ing.baseUnit).includes(l.unit as StockUnit)) return 0;
    return toBase(num(l.qty), l.unit as StockUnit) * (costById.get(ing.id) ?? 0);
  };
  const hpp = Math.round(lines.reduce((s, l) => s + lineValue(l), 0));
  const margin = num(price) - hpp;
  const marginRatio = num(price) > 0 ? margin / num(price) : 0;

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    setUploading(true);
    try {
      const asset = res.assets[0];
      const { url } = await api.upload(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
      setPhotoUrl(url);
    } catch (e) {
      Alert.alert('Gagal mengunggah foto', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Isi nama produk';
    if (!categoryId) e.category = 'Pilih kategori';
    lines.forEach((l, i) => {
      if (l.type === 'INGREDIENT' && !l.ingredientId) e[`line${i}`] = 'Pilih bahan baku';
      else if (l.type !== 'INGREDIENT' && l.label.trim().length < 2) e[`line${i}`] = 'Isi keterangan';
      else if (!(num(l.qty) > 0)) e[`line${i}`] = 'Jumlah harus lebih dari 0';
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const costLines: CostLineInput[] = lines.map((l) =>
        l.type === 'INGREDIENT'
          ? { type: 'INGREDIENT', ingredientId: l.ingredientId!, qty: num(l.qty), unit: l.unit as StockUnit }
          : { type: l.type, label: l.label.trim(), qty: num(l.qty), unit: l.unit, value: Math.round(num(l.value)) },
      );
      await api.saveProduct(outletId, { categoryId: categoryId!, name: name.trim(), price: Math.round(num(price)), photoUrl, active: true, costLines }, p?.id);
      await Promise.all(['products', 'product', 'product-categories'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      router.back();
    } catch (err) {
      setErrors({ root: err instanceof ApiError && err.issues.length ? err.issues.map((i) => i.message).join(', ') : err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const counts: Record<CostLineType, number> = { INGREDIENT: 0, LABOUR: 0, OVERHEAD: 0, OTHER: 0 };
  const sheetLine = sheet && 'key' in sheet ? lines.find((l) => l.key === sheet.key) : undefined;
  const sheetIng = sheetLine?.ingredientId ? ingById.get(sheetLine.ingredientId) : undefined;
  const ingredientOptions = (ingredients.data ?? []).filter((i) => i.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase()));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Input / Edit HPP' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Harga Pokok Penjualan Produk:</Text>
        <BoxButton value={`Kategori: ${categories.data?.find((c) => c.id === categoryId)?.name ?? '-'}`} onPress={() => setSheet({ kind: 'category' })} error={errors.category} />
        <BoxField label="Keterangan" value={name} onChangeText={setName} placeholder="Nama produk" error={errors.name} />

        {lines.map((l, i) => {
          counts[l.type]++;
          const ing = l.ingredientId ? ingById.get(l.ingredientId) : undefined;
          return (
            <View key={l.key} style={styles.lineBox}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineTitle}>
                  {COST_LINE_LABELS[l.type].toUpperCase()} {l.type === 'INGREDIENT' ? counts[l.type] : ''}:
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Hapus baris" hitSlop={10} onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                </Pressable>
              </View>
              {l.type === 'INGREDIENT' ? (
                <BoxButton value={ing?.name} placeholder="Pilih bahan baku" onPress={() => { setIngredientSearch(''); setSheet({ kind: 'ingredient', key: l.key }); }} />
              ) : (
                <BoxField value={l.label} onChangeText={(t) => update(l.key, { label: t })} placeholder="Keterangan, mis. Gaji Koki" />
              )}
              <View style={styles.lineRow}>
                <BoxField style={{ flex: 1 }} label="Jumlah" value={l.qty} onChangeText={(t) => update(l.key, { qty: t })} keyboardType="decimal-pad" />
                <BoxButton style={{ width: 84 }} label="Unit" value={l.unit} onPress={() => setSheet({ kind: 'unit', key: l.key })} />
                {l.type === 'INGREDIENT' ? (
                  <View style={{ flex: 1.4, gap: 4 }}>
                    <Text style={styles.valueLabel}>Nilai</Text>
                    <View style={styles.valueBox}>
                      <Text style={styles.valueText} numberOfLines={1} adjustsFontSizeToFit>
                        Rp {rupiahDigits(lineValue(l))}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <BoxField style={{ flex: 1.4 }} label="Nilai" prefix="Rp" value={l.value} onChangeText={(t) => update(l.key, { value: rupiahDigits(num(t.replace(/\D/g, ''))) })} keyboardType="number-pad" />
                )}
              </View>
              {errors[`line${i}`] ? <Text variant="error">{errors[`line${i}`]}</Text> : null}
            </View>
          );
        })}

        <View style={styles.lineBox}>
          <BoxButton value="TAMBAH VARIABEL" onPress={() => setSheet({ kind: 'add' })} />
        </View>

        <View style={styles.totals}>
          <Total label="TOTAL HPP:" value={rupiahDigits(hpp)} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.valueLabel}>HARGA JUAL:</Text>
            <View style={[styles.valueBox, styles.priceBox]}>
              <Text style={styles.totalRp}>Rp</Text>
              <TextInput
                accessibilityLabel="Harga jual"
                value={price}
                onChangeText={(t) => setPrice(rupiahDigits(num(t.replace(/\D/g, ''))))}
                keyboardType="number-pad"
                style={styles.priceInput}
                placeholder="0"
              />
            </View>
          </View>
        </View>
        <View style={styles.totals}>
          <Total label="MARGIN:" value={rupiahDigits(margin)} danger={margin < 0} />
          <Text style={styles.marginNote}>
            Margin keuntungan:{'\n'}
            <Text style={[styles.marginPct, margin < 0 && { color: colors.danger }]}>{formatPercent(marginRatio)}</Text> dari harga jual
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={styles.valueLabel}>INPUT FOTO:</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Pilih foto produk" onPress={pickPhoto} style={styles.photo}>
              {photoUrl ? (
                <Image source={{ uri: assetUrl(photoUrl)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Ionicons name={uploading ? 'cloud-upload-outline' : 'camera-outline'} size={32} color={colors.primaryTint} />
              )}
            </Pressable>
          </View>
          <Button title="SIMPAN" onPress={save} loading={saving} disabled={uploading} style={{ minWidth: 120, borderRadius: radius.sm }} />
        </View>
        {errors.root ? <Text variant="error">{errors.root}</Text> : null}
      </ScrollView>

      <OptionSheet
        visible={sheet?.kind === 'category'}
        title="Kategori produk"
        value={categoryId}
        options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        onSelect={setCategoryId}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet?.kind === 'add'}
        title="Tambah variabel"
        value={null as CostLineType | null}
        options={COST_LINE_TYPES.map((t) => ({ value: t, label: COST_LINE_LABELS[t] }))}
        onSelect={(t) => t && setLines((ls) => [...ls, newLine(t)])}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet?.kind === 'unit'}
        title="Unit"
        value={sheetLine?.unit ?? null}
        options={(sheetLine?.type === 'INGREDIENT' ? (sheetIng ? unitsFor(sheetIng.baseUnit) : ['gr', 'kg', 'ml', 'L', 'pcs']) : MANUAL_COST_UNITS).map((u) => ({ value: u as string, label: u }))}
        onSelect={(u) => sheetLine && u && update(sheetLine.key, { unit: u })}
        onClose={() => setSheet(null)}
      />
      <IngredientSheet
        visible={sheet?.kind === 'ingredient'}
        search={ingredientSearch}
        onSearch={setIngredientSearch}
        options={ingredientOptions}
        onSelect={(ing) => {
          if (sheetLine) update(sheetLine.key, { ingredientId: ing.id, label: ing.name, unit: unitsFor(ing.baseUnit)[0]! });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

function Total({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.valueLabel}>{label}</Text>
      <View style={styles.valueBox}>
        <Text style={styles.totalRp}>Rp</Text>
        <Text style={[styles.totalValue, danger && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </View>
  );
}

function IngredientSheet({ visible, search, onSearch, options, onSelect, onClose }: { visible: boolean; search: string; onSearch: (s: string) => void; options: Ingredient[]; onSelect: (i: Ingredient) => void; onClose: () => void }) {
  return (
    <OptionSheet
      visible={visible}
      title="Pilih bahan baku"
      value={null as string | null}
      options={options.slice(0, 60).map((i) => ({ value: i.id, label: `${i.name} (${i.baseUnit})` }))}
      onSelect={(id) => {
        const ing = options.find((i) => i.id === id);
        if (ing) onSelect(ing);
      }}
      onClose={onClose}
      header={<TextInput value={search} onChangeText={onSearch} placeholder="Cari bahan" style={styles.sheetSearch} placeholderTextColor={colors.muted} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  heading: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 17, color: colors.navy },
  lineBox: { borderWidth: 1, borderColor: colors.primaryTint, borderRadius: radius.sm, padding: space.sm + 4, gap: space.sm, backgroundColor: colors.white },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.navy },
  lineRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  valueLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
  valueBox: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.sm, backgroundColor: colors.surfaceTint, paddingHorizontal: space.sm + 4 },
  valueText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, flex: 1, textAlign: 'center' },
  totals: { flexDirection: 'row', gap: space.md, alignItems: 'flex-end' },
  totalRp: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy },
  totalValue: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, flex: 1, textAlign: 'right' },
  priceBox: { backgroundColor: colors.surfaceTint },
  priceInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, textAlign: 'right', paddingVertical: 6 },
  marginNote: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.navy, paddingBottom: 6 },
  marginPct: { fontFamily: fonts.bold, fontStyle: 'italic', textDecorationLine: 'underline', color: colors.navy },
  footer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: space.sm },
  photo: { width: 96, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sheetSearch: { borderWidth: 1.5, borderColor: colors.primaryTint, borderRadius: radius.sm, padding: space.sm + 2, fontFamily: fonts.regular, fontSize: 15, marginBottom: space.sm, color: colors.ink },
});
