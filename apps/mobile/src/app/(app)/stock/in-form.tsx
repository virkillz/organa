import DateTimePicker from '@react-native-community/datetimepicker';
import {
  STOCK_UNITS,
  STORAGE_INFO,
  STORAGE_TYPES,
  UNIT_INFO,
  unitsFor,
  type Ingredient,
  type StockUnit,
  type StorageType,
} from '@organa/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { OptionSheet } from '@/components/category-picker';
import { Button } from '@/components/ui/button';
import { BoxButton, BoxField, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api, ApiError } from '@/lib/api';
import { addDays, shortDate, todayJakarta } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Sheet = 'sub' | 'unit' | 'priceUnit' | 'storage' | null;
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

export default function StockInScreen() {
  const params = useLocalSearchParams<{ categoryId: string; ingredientId?: string }>();
  const ingredients = useQuery({ queryKey: ['ingredients', params.categoryId], queryFn: () => api.ingredients(params.categoryId) });
  // Wait for the ingredient list when pre-selecting one ("Tambah stok" from the detail screen).
  if (params.ingredientId && ingredients.isPending) return <Loading />;
  const preset = params.ingredientId ? ingredients.data?.find((i) => i.id === params.ingredientId) : undefined;
  return <StockInForm categoryId={params.categoryId} preset={preset} />;
}

/** Form values that follow from picking an existing ingredient. */
function fromIngredient(ing: Ingredient) {
  const units = unitsFor(ing.baseUnit);
  return { unit: units[0]!, priceUnit: units[units.length - 1]!, critical: String(Math.round(ing.criticalQty)), storage: ing.defaultStorage };
}

function StockInForm({ categoryId: parentId, preset }: { categoryId: string; preset?: Ingredient }) {
  const params = { categoryId: parentId };
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['stock-categories'], queryFn: api.stockCategories });
  const ingredients = useQuery({ queryKey: ['ingredients', params.categoryId], queryFn: () => api.ingredients(params.categoryId) });

  const parent = categories.data?.find((c) => c.id === params.categoryId);
  const subs = useMemo(() => (categories.data ?? []).filter((c) => c.parentId === params.categoryId), [categories.data, params.categoryId]);
  const [pickedSubId, setSubId] = useState<string | null>(null);
  const subId = pickedSubId ?? subs[0]?.id ?? null;
  const initial = preset ? fromIngredient(preset) : null;
  const [name, setName] = useState(preset?.name ?? '');
  const [picked, setPicked] = useState<Ingredient | null>(preset ?? null);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<StockUnit>(initial?.unit ?? 'gr');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState<StockUnit>(initial?.priceUnit ?? 'kg');
  const [critical, setCritical] = useState(initial?.critical ?? '');
  const [storage, setStorage] = useState<StorageType>(initial?.storage ?? 'CHILLER');
  const [expiry, setExpiry] = useState(addDays(todayJakarta(), STORAGE_INFO[initial?.storage ?? 'CHILLER'].shelfLifeDays));
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** Storage suggests an expiry date until the user sets one by hand. */
  const changeStorage = (s: StorageType) => {
    setStorage(s);
    if (!expiryTouched) setExpiry(addDays(todayJakarta(), STORAGE_INFO[s].shelfLifeDays));
  };

  const choose = (ing: Ingredient) => {
    const v = fromIngredient(ing);
    setPicked(ing);
    setName(ing.name);
    setUnit(v.unit);
    setPriceUnit(v.priceUnit);
    setCritical(v.critical);
    changeStorage(v.storage);
  };

  const suggestions = (ingredients.data ?? []).filter(
    (i) => !picked && name.trim().length > 0 && i.name.toLowerCase().includes(name.trim().toLowerCase()),
  );
  const allowedUnits: readonly StockUnit[] = picked ? unitsFor(picked.baseUnit) : STOCK_UNITS;
  const allowedPriceUnits = allowedUnits.filter((u) => UNIT_INFO[u].base === UNIT_INFO[unit].base);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!picked && name.trim().length < 2) e.name = 'Isi nama bahan';
    if (!(num(amount) > 0)) e.qty = 'Jumlah harus lebih dari 0';
    if (!(num(price) >= 0) || price === '') e.price = 'Isi harga';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api.stockIn({
        outletId,
        ...(picked ? { ingredientId: picked.id } : { name: name.trim(), categoryId: subId ?? params.categoryId }),
        qty: num(amount),
        unit,
        price: Math.round(num(price)),
        priceUnit,
        ...(critical ? { criticalQty: num(critical), criticalUnit: UNIT_INFO[unit].base } : {}),
        storage,
        expiryDate: expiry,
      });
      await Promise.all(['stock', 'stock-summary', 'ingredients', 'ingredient-stock'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      router.dismissTo('/stock');
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) {
        setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      } else {
        setErrors({ root: err instanceof Error ? err.message : 'Terjadi kesalahan' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Input Stok' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>INPUT STOK {(parent?.name ?? '').toUpperCase()}</Text>
        {subs.length > 0 ? (
          <BoxButton value={subs.find((s) => s.id === subId)?.name} placeholder="Sub kategori" onPress={() => setSheet('sub')} />
        ) : null}
        <View>
          <BoxField
            label="Keterangan"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setPicked(null);
            }}
            placeholder="Nama bahan, mis. Paha Ayam Fillet"
            error={errors.name}
          />
          {suggestions.length > 0 ? (
            <View style={styles.suggest}>
              {suggestions.slice(0, 5).map((s) => (
                <Pressable key={s.id} accessibilityRole="button" onPress={() => choose(s)} style={styles.suggestRow}>
                  <Text>{s.name}</Text>
                  <Text variant="caption">stok terdaftar</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {picked ? <Text style={styles.hint}>Menambah stok bahan terdaftar ({picked.baseUnit})</Text> : null}
        </View>
        <View style={styles.row}>
          <BoxField style={styles.col} label="Jumlah" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" error={errors.qty} />
          <BoxButton style={styles.col} label="Unit" value={unit} onPress={() => setSheet('unit')} />
        </View>
        <View style={styles.row}>
          <BoxField style={styles.col} label="Harga*" prefix="Rp" value={price} onChangeText={(t) => setPrice(t.replace(/[^\d]/g, ''))} keyboardType="number-pad" placeholder="0" error={errors.price} />
          <BoxButton style={styles.col} label="Satuan" value={`per ${priceUnit}`} onPress={() => setSheet('priceUnit')} />
        </View>
        <View style={styles.row}>
          <BoxField style={styles.col} label="Critical Stock" value={critical} onChangeText={setCritical} keyboardType="decimal-pad" placeholder="0" suffix={UNIT_INFO[unit].base} />
          <View style={styles.col}>
            <BoxButton label="Penyimpanan" value={STORAGE_INFO[storage].label} onPress={() => setSheet('storage')} />
            <Text style={styles.hint}>
              Dapat tahan hingga <Text style={styles.hintStrong}>{STORAGE_INFO[storage].hint}</Text>*
            </Text>
          </View>
        </View>
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <View style={styles.col}>
            <BoxButton label="Expired Date*" value={shortDate(expiry)} onPress={() => setShowDate(true)} />
            <Text style={styles.hint}>{expiryTouched ? '*Input manual' : '*Saran dari jenis penyimpanan'}</Text>
          </View>
          <Button title="SIMPAN" onPress={submit} loading={saving} style={[styles.col, { borderRadius: radius.sm }]} />
        </View>
        {errors.root ? <Text variant="error">{errors.root}</Text> : null}
      </ScrollView>

      {showDate ? (
        <DateTimePicker
          value={new Date(`${expiry}T12:00:00Z`)}
          mode="date"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowDate(Platform.OS === 'ios');
            if (event.type === 'set' && date) {
              setExpiry(date.toISOString().slice(0, 10));
              setExpiryTouched(true);
            }
          }}
        />
      ) : null}
      <OptionSheet visible={sheet === 'sub'} title="Sub kategori" value={subId} options={subs.map((s) => ({ value: s.id, label: s.name }))} onSelect={setSubId} onClose={() => setSheet(null)} />
      <OptionSheet
        visible={sheet === 'unit'}
        title="Unit"
        value={unit}
        options={allowedUnits.map((u) => ({ value: u, label: u }))}
        onSelect={(u) => {
          setUnit(u);
          if (UNIT_INFO[u].base !== UNIT_INFO[priceUnit].base) setPriceUnit(u);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet visible={sheet === 'priceUnit'} title="Harga per" value={priceUnit} options={allowedPriceUnits.map((u) => ({ value: u, label: `per ${u}` }))} onSelect={setPriceUnit} onClose={() => setSheet(null)} />
      <OptionSheet
        visible={sheet === 'storage'}
        title="Penyimpanan"
        value={storage}
        options={STORAGE_TYPES.map((s) => ({ value: s, label: `${STORAGE_INFO[s].label} (± ${STORAGE_INFO[s].hint})` }))}
        onSelect={changeStorage}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  heading: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 18, color: colors.navy },
  row: { flexDirection: 'row', gap: space.md },
  col: { flex: 1 },
  hint: { fontSize: 11, color: colors.navy, marginTop: 2 },
  hintStrong: { fontFamily: fonts.bold, fontSize: 11, color: colors.primaryLight },
  suggest: { backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, marginTop: 4 },
  suggestRow: { flexDirection: 'row', justifyContent: 'space-between', padding: space.sm + 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
