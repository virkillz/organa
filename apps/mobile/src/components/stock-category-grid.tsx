import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Button } from '@/components/ui/button';
import { ErrorView, Loading, Tile, TileGrid } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** "Pilih kategori stok" grid, shared by stock-in and stock counts. */
export function StockCategoryGrid({ onPick, allowAdd }: { onPick: (categoryId: string) => void; allowAdd?: boolean }) {
  const categories = useQuery({ queryKey: ['stock-categories'], queryFn: api.stockCategories });
  const [adding, setAdding] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>PILIH KATEGORI STOK</Text>
      {categories.isPending ? (
        <Loading />
      ) : categories.isError ? (
        <ErrorView error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        <TileGrid>
          {categories.data
            .filter((c) => !c.parentId)
            .map((c) => (
              <Tile key={c.id} icon={c.icon as never} label={c.name} onPress={() => onPick(c.id)} />
            ))}
          {allowAdd ? <Tile icon="add" label="Tambah Kategori" dashed onPress={() => setAdding(true)} /> : null}
        </TileGrid>
      )}
      <AddCategory visible={adding} onClose={() => setAdding(false)} onCreated={() => categories.refetch()} />
    </ScrollView>
  );
}

function AddCategory({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api.createStockCategory({ name: name.trim() });
      setName('');
      onCreated();
      onClose();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dialog}>
          <Text variant="heading">Tambah Kategori</Text>
          <TextInput autoFocus value={name} onChangeText={setName} placeholder="Nama kategori" style={styles.input} placeholderTextColor={colors.muted} />
          <Button title="SIMPAN" onPress={submit} loading={saving} disabled={name.trim().length < 2} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xl * 2 },
  heading: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 18, color: colors.navy },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  dialog: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  input: { borderWidth: 1.5, borderColor: colors.primaryTint, borderRadius: radius.sm, padding: space.sm + 4, fontFamily: fonts.medium, fontSize: 16, backgroundColor: colors.surfaceTint },
});
